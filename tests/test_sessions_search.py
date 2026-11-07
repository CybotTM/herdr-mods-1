import json
import sqlite3
import subprocess
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'sessions/mods/sessions/search.py'

class SearchTest(unittest.TestCase):
    def test_searches_both_sources_and_rejects_empty_sessions(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / '.hermes').mkdir()
            db = sqlite3.connect(root / '.hermes/state.db')
            db.executescript('CREATE TABLE sessions(id TEXT, title TEXT, started_at REAL, cwd TEXT); CREATE TABLE messages(id INTEGER, session_id TEXT, role TEXT, content TEXT, timestamp REAL);')
            db.execute('INSERT INTO sessions VALUES(?,?,?,?)', ('hermes-123', 'A title', 100, '/home/alex/acme'))
            db.execute('INSERT INTO sessions VALUES(?,?,?,?)', ('empty-123', 'empty', 101, None))
            db.execute('INSERT INTO messages VALUES(?,?,?,?,?)', (1, 'hermes-123', 'user', 'find the needle', 100))
            db.commit()
            db.close()
            pi = root / '.pi/agent/sessions/project'
            pi.mkdir(parents=True)
            (pi / '2024-01-01T00-00-00Z_pi-12345.jsonl').write_text('\n'.join(json.dumps(x) for x in [
                {'type':'session','id':'pi-12345','cwd':'/home/alex/acme','timestamp':'2024-01-01T00:00:00Z'},
                {'type':'message','message':{'role':'user','content':[{'type':'text','text':'a needle here'}]}}]))
            result = subprocess.run(['python3', str(SCRIPT), '--root', d, 'needle'], text=True, capture_output=True, check=True)
            rows = json.loads(result.stdout)
            self.assertEqual({r['id'] for r in rows}, {'hermes-123', 'pi-12345'})
            self.assertTrue(all('needle' in r['snippet'] for r in rows))
            all_rows = json.loads(subprocess.check_output(['python3', str(SCRIPT), '--root', d, ''], text=True))
            self.assertNotIn('empty-123', {r['id'] for r in all_rows})
            db = sqlite3.connect(root / '.hermes/state.db')
            db.execute("CREATE VIRTUAL TABLE messages_fts_trigram USING fts5(content, tokenize='trigram')")
            db.execute("INSERT INTO messages_fts_trigram(rowid, content) VALUES(1, 'find the needle')")
            db.commit()
            db.close()
            fts_rows = json.loads(subprocess.check_output(['python3', str(SCRIPT), '--root', d, 'needle'], text=True))
            self.assertEqual({r['id'] for r in fts_rows}, {'hermes-123', 'pi-12345'})

if __name__ == '__main__': unittest.main()
