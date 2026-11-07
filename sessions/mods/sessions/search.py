#!/usr/bin/env python3
"""Read Hermes and Pi session history; no files are changed."""
import argparse
import datetime
import json
import os
from pathlib import Path
import re
import sqlite3
import time

ID = re.compile(r'^[\w.-]{4,128}$', re.ASCII)

def text(value):
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return ' '.join(p.get('text', '') for p in value if isinstance(p, dict) and p.get('type') == 'text' and isinstance(p.get('text'), str))
    return ''

def snippet(value, query):
    value = ' '.join(value.split())
    at = value.lower().find(query.lower()) if query else 0
    start = max(0, at - 45)
    return value[start:start + 160]

def hermes(root, query, deadline):
    path = root / '.hermes/state.db'
    if not path.is_file():
        return []
    db = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=0.5)
    db.set_progress_handler(lambda: int(time.monotonic() > deadline), 10000)
    try:
        cols = {r[1] for r in db.execute('pragma table_info(sessions)')}
        title = 's.title' if 'title' in cols else "''"
        cwd = 's.cwd' if 'cwd' in cols else "''"
        # FTS narrows the message scan before sessions are joined; LIKE handles short queries.
        pattern = '%' + query.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        use_fts = len(query) >= 3 and 'messages_fts_trigram' in tables
        if not query:
            matching = "SELECT NULL AS session_id, NULL AS content WHERE 0"
            match_args = ()
        elif use_fts:
            matching = "SELECT m.session_id, m.content FROM messages_fts_trigram f JOIN messages m ON m.id=f.rowid WHERE messages_fts_trigram MATCH ? GROUP BY m.session_id"
            match_args = ('"' + query.replace('"', '""') + '"',)
        else:
            matching = "SELECT session_id, content FROM messages WHERE content LIKE ? ESCAPE '\\' GROUP BY session_id"
            match_args = (pattern,)
        sql = f"""WITH matches AS ({matching})
            SELECT s.id, {title}, s.started_at, {cwd},
            (SELECT content FROM messages u WHERE u.session_id=s.id AND u.role='user' ORDER BY u.id LIMIT 1), matches.content
            FROM sessions s LEFT JOIN matches ON matches.session_id=s.id
            WHERE EXISTS (SELECT 1 FROM messages u WHERE u.session_id=s.id AND u.role='user')
            AND (? = '' OR matches.session_id IS NOT NULL OR {title} LIKE ? ESCAPE '\\' OR {cwd} LIKE ? ESCAPE '\\')
            ORDER BY s.started_at DESC LIMIT 50"""
        rows = []
        for sid, name, started, folder, first, match in db.execute(sql, (*match_args, query, pattern, pattern)):
            first, match = text(first), text(match)
            if query and not match and query.lower() not in (str(name or '') + ' ' + str(folder or '')).lower():
                continue
            if isinstance(sid, str) and ID.fullmatch(sid):
                rows.append(dict(app='hermes', id=sid, title=name or first, cwd=folder or '', folder_exists=bool(folder and os.path.isdir(folder)), timestamp=started or 0, snippet=snippet(match or first, query)))
                if len(rows) == 50:
                    break
        return rows
    finally:
        db.close()

def pi(root, query, deadline):
    files = []
    for app in ('pi', 'pig'):
        base = root / ('.' + app) / 'agent/sessions'
        if base.is_dir():
            for p in base.rglob('*.jsonl'):
                if time.monotonic() > deadline:
                    break
                try:
                    files.append((p.stat().st_mtime, app, p))
                except OSError:
                    pass
    rows = []
    # shortcut: only the newest 2000 files are searched, upgrade to an index for older history.
    for modified, app, path in sorted(files, reverse=True)[:2000]:
        if time.monotonic() > deadline or len(rows) >= 50:
            break
        try:
            with path.open(encoding='utf-8') as f:
                header = json.loads(next(f))
                sid = header.get('id') or path.stem.rsplit('_', 1)[-1]
                if header.get('type') != 'session' or not isinstance(sid, str) or not ID.fullmatch(sid):
                    continue
                first = ''
                match = ''
                for line in f:
                    if time.monotonic() > deadline:
                        break
                    try:
                        entry = json.loads(line)
                    except ValueError:
                        continue
                    msg = entry.get('message', {}) if isinstance(entry, dict) else {}
                    content = text(msg.get('content')) if isinstance(msg, dict) else ''
                    if msg.get('role') == 'user' and not first:
                        first = content
                    if query and query.lower() in content.lower() and not match:
                        match = content
                folder = header.get('cwd') or ''
                if not first or (query and not match and query.lower() not in (first + ' ' + str(folder)).lower()):
                    continue
                try:
                    started = datetime.datetime.fromisoformat(header['timestamp'].replace('Z', '+00:00')).timestamp()
                except (KeyError, ValueError, TypeError):
                    started = modified
                rows.append(dict(app=app, id=sid, title=first, cwd=folder, folder_exists=bool(folder and os.path.isdir(folder)), timestamp=started, snippet=snippet(match or first, query)))
        except (OSError, ValueError, StopIteration, AttributeError):
            continue
    return rows

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--root', default=os.environ.get('HERDR_SESSIONS_ROOT', os.path.expanduser('~')))
    p.add_argument('query')
    args = p.parse_args()
    root, deadline = Path(args.root), time.monotonic() + 3
    rows = []
    for source in (hermes, pi):
        try:
            rows.extend(source(root, args.query.strip(), deadline))
        except (OSError, sqlite3.Error):
            continue
    print(json.dumps(sorted(rows, key=lambda x: x['timestamp'], reverse=True)[:50]))

if __name__ == '__main__':
    main()
