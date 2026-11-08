"""Label the herdr-app terminal a Hermes session runs in with its session id (agent.session) and
agent.app=hermes, for the agents-ids mod (github.com/DarkoKuzmanovic/herdr-mods).

Hermes can run TUI sessions inside a shared gateway whose own environment has no terminal; the
terminal then comes from the session's client environment (pass HC_TERMINAL_ID and
HC_TERMINAL_SOCKET through with terminal.client_env_passthrough). Labels once per session, on
interactive platforms only, never for subagents. Does nothing outside herdr-app.
"""

from __future__ import annotations

import os
import queue
import subprocess
import threading
import time

_INTERACTIVE = {"cli", "tui", "desktop", "local"}
_lock = threading.Lock()
_labelled: dict[str, str] = {}  # terminal -> session id last written
_sessions = {}  # session id -> (terminal, client environment)
_doing_last = {}
_doing_at = {}
_queue = queue.Queue()
_worker_started = False


def _send(cmd, env):
    global _worker_started
    _queue.put((cmd, env))
    if not _worker_started:
        _worker_started = True
        def work():
            while True:
                command, environment = _queue.get()
                try:
                    subprocess.run(command, env=environment, timeout=2, stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, check=False)
                except Exception:
                    pass
        threading.Thread(target=work, daemon=True).start()


def _env() -> dict:
    try:
        from agent.session_client_env import bound_client_env

        bound = bound_client_env()
    except Exception:
        bound = None
    env = dict(os.environ)
    if bound:
        for k in ("PATH", "HC_TERMINAL_ID", "HC_TERMINAL_SOCKET"):
            if bound.get(k):
                env[k] = bound[k]
    return env


def _label(**kwargs) -> None:
    if kwargs.get("platform") not in _INTERACTIVE or kwargs.get("parent_session_id"):
        return
    sid = str(kwargs.get("session_id") or "")
    env = _env()
    term = (env.get("HC_TERMINAL_ID") or "").strip()
    if not sid or not term:
        return
    with _lock:
        _sessions[sid] = (term, env)
        if _labelled.get(term) == sid:
            return
        _labelled[term] = sid
        _doing_last.pop(term, None)
        _doing_at.pop(term, None)
        _send(["hc", "label", term, f"agent.session={sid}", "agent.app=hermes"], env)


def _doing(text, **kwargs):
    sid = str(kwargs.get("session_id") or "")
    with _lock:
        session = _sessions.get(sid)
        if not session:
            return
        term, env = session
        if _labelled.get(term) != sid or _doing_last.get(term) == text:
            return
        previous = _doing_last.get(term, "")
        now = time.monotonic()
        # shortcut: a rapid second tool may be hidden until the next state, add trailing updates if needed.
        if text.startswith("running:") and previous.startswith("running:") and now - _doing_at.get(term, 0) < 2:
            return
        _doing_last[term] = text
        _doing_at[term] = now
        _send(["hc", "label", term, f"agent.doing={text}", f"agent.doing.since={int(time.time())}"], env)


def _pre(**kwargs):
    if kwargs.get("platform") not in _INTERACTIVE or kwargs.get("parent_session_id"):
        return
    _label(**kwargs)
    _doing("thinking", **kwargs)


def _tool(**kwargs):
    name = kwargs.get("tool_name")
    if name not in {"terminal", "read_file", "write_file", "patch", "search_files", "web_search", "web_extract"}:
        name = "tool"
    args = kwargs.get("args") or {}
    command = args.get("command", "") if isinstance(args, dict) else ""
    first = command.split()[0] if isinstance(command, str) and command.split() else ""
    target = f" {first}" if first in {"git", "npm", "node", "python", "python3", "pytest", "cargo", "go"} else ""
    _doing(f"running: {name}{target}", **kwargs)


def register(ctx):
    ctx.register_hook("pre_llm_call", _pre)
    ctx.register_hook("pre_tool_call", _tool)
    ctx.register_hook("on_human_input_request", lambda **kw: _doing("waiting for you", **kw))
    ctx.register_hook("on_human_input_resolved", lambda **kw: _doing("thinking", **kw))
    ctx.register_hook("post_llm_call", lambda **kw: _doing("done", **kw))
    ctx.register_hook("agent_loop_stopped", lambda **kw: _doing("done", **kw))
