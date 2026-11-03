"""Self-check for integrations/bin/agent-session-label: python3 -I tests/test_label.py"""
import importlib.machinery, importlib.util, os, types

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "integrations", "bin", "agent-session-label")
loader = importlib.machinery.SourceFileLoader("asl", path)
m = importlib.util.module_from_spec(importlib.util.spec_from_loader("asl", loader))
loader.exec_module(m)

# The ps fallback (macOS): comm can be a path and contain spaces.
real_exists, real_run = m.os.path.exists, m.subprocess.run
m.os.path.exists = lambda p: False
m.subprocess.run = lambda cmd, **kw: types.SimpleNamespace(stdout="  300   412   400 /Applications/Some App/bin/claude\n")
assert m.stat(412) == ("claude", 300, 412, 400)
m.os.path.exists, m.subprocess.run = real_exists, real_run
assert m.stat(os.getpid())[1] == os.getppid()  # the real /proc (or ps) path

# pid -> (comm, ppid, pgrp, tpgid); terminal shell 10, its foreground job 20
procs = {
    20: ("claude", 10, 20, 20),        # Claude Code in front: labels
    21: ("sh", 20, 20, 20),            # its hook shell
    30: ("node", 20, 30, -1),          # a child of the front agent (Codex app-server, PiG's node): labels as its parent
    40: ("bash", 50, 40, -1),          # a Hermes tool shell (no tty)
    41: ("claude", 40, 41, -1),        # claude -p started by Hermes: no label
    60: ("-zsh", 20, 60, 20),          # a login shell inside the front agent
    61: ("codex", 60, 61, 20),         # codex started by that agent through a shell: no label
    50: ("python3", 1, 50, -1), 10: ("zsh", 1, 10, 20), 1: ("systemd", 0, 1, -1),
}
m.stat = lambda pid: procs[pid]
assert m.agent_pid(21) == 20 and m.leader(20) == 20
assert m.leader(30) == 20
assert m.agent_pid(40) == 50 and m.leader(41) == 0
assert m.leader(61) == 0

calls = []
m.subprocess.run = lambda cmd, **kw: calls.append(cmd)
os.environ["HC_TERMINAL_ID"] = "t9"
m.os.getppid = lambda: 21
assert m.main(["x", "sid-1"]) == 0 and calls == [["hc", "label", "t9", "agent.session=sid-1", "agent.app=claude"]]
calls.clear()
m.main(["x", "sid-1", "30"]); assert calls[0][-1] == "agent.app=claude"  # the leader's name, not node's
calls.clear()
m.main(["x", "sid-1", "30", "pig"]); assert calls[0][-1] == "agent.app=pig"  # explicit app wins
calls.clear()
m.main(["x", "sid-1", "-", "opencode"]); assert calls[0][-1] == "agent.app=opencode"  # "-": find the agent
calls.clear(); m.os.getppid = lambda: 40
m.main(["x", "sid-2"]); assert calls == []
calls.clear(); del os.environ["HC_TERMINAL_ID"]
m.main(["x", "sid-3", "20"]); assert calls == []
print("ok")
