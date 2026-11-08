"""Self-check for integrations/hermes/agent-session-label: python3 -I tests/test_hermes_plugin.py"""
import importlib.util, os, sys

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "integrations", "hermes", "agent-session-label", "__init__.py")
spec = importlib.util.spec_from_file_location("hermes_asl", path)
assert spec and spec.loader
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
os.environ.pop("HC_TERMINAL_SOCKET", None)

calls = []
m._send = lambda cmd, env: calls.append((cmd, env.get("HC_TERMINAL_SOCKET")))
m.time.time = lambda: 1234
hooks = {}
m.register(type("Ctx", (), {"register_hook": lambda self, name, fn: hooks.setdefault(name, fn)})())
label = hooks["pre_llm_call"]

os.environ.pop("HC_TERMINAL_ID", None)
label(platform="tui", session_id="s1")
assert calls == []  # outside herdr-app

os.environ["HC_TERMINAL_ID"] = "t9"
label(platform="tui", session_id="s1")
label(platform="tui", session_id="s1")            # once per session
label(platform="tui", session_id="sub", parent_session_id="s1")  # subagent: no
label(platform="telegram", session_id="s2")      # not interactive: no
assert calls == [(["hc", "label", "t9", "agent.session=s1", "agent.app=hermes"], None),
                 (["hc", "label", "t9", "agent.doing=thinking", "agent.doing.since=1234"], None)], calls
calls.clear()
hooks["pre_tool_call"](session_id="s1", tool_name="terminal", args={"command": "git status secret-token"})
hooks["pre_tool_call"](session_id="s1", tool_name="terminal", args={"command": "git status another-secret"})
assert calls == [(["hc", "label", "t9", "agent.doing=running: terminal git", "agent.doing.since=1234"], None)]
hooks["on_human_input_request"](session_id="s1")
hooks["post_llm_call"](session_id="s1")
assert calls[-2][0][-2] == "agent.doing=waiting for you" and calls[-1][0][-2] == "agent.doing=done"

# A shared gateway: the session's client env names the terminal.
calls.clear()
del os.environ["HC_TERMINAL_ID"]
sys.modules["agent"] = type(sys)("agent")
sys.modules["agent.session_client_env"] = mod = type(sys)("agent.session_client_env")
mod.bound_client_env = lambda: {"HC_TERMINAL_ID": "t4", "HC_TERMINAL_SOCKET": "/run/x.sock"}
label(platform="local", session_id="s3")
assert calls == [(["hc", "label", "t4", "agent.session=s3", "agent.app=hermes"], "/run/x.sock"),
                 (["hc", "label", "t4", "agent.doing=thinking", "agent.doing.since=1234"], "/run/x.sock")], calls
print("ok")
