"""Label the herdr-app terminal a Hermes session runs in with its session id (agent.session) and
agent.app=hermes, for the agents-ids mod (github.com/DarkoKuzmanovic/herdr-mods).

Hermes can run TUI sessions inside a shared gateway whose own environment has no terminal; the
terminal then comes from the session's client environment (pass HC_TERMINAL_ID and
HC_TERMINAL_SOCKET through with terminal.client_env_passthrough). Labels once per session, on
interactive platforms only, never for subagents. Does nothing outside herdr-app.
"""

from __future__ import annotations

import os
import subprocess
import threading

_INTERACTIVE = {"cli", "tui", "desktop", "local"}
_lock = threading.Lock()
_labelled: dict[str, str] = {}  # terminal -> session id last written


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
        if _labelled.get(term) == sid:
            return
        _labelled[term] = sid
    try:
        subprocess.run(["hc", "label", term, f"agent.session={sid}", "agent.app=hermes"], env=env, timeout=2,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    except Exception:
        pass  # never slow down or break a turn


def register(ctx):
    ctx.register_hook("pre_llm_call", _label)
