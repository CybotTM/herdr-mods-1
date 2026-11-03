"""Self-check for integrations/bin/agent-session-label: python3 -I tests/test_label.py"""
import importlib.machinery, importlib.util, os

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "integrations", "bin", "agent-session-label")
loader = importlib.machinery.SourceFileLoader("asl", path)
m = importlib.util.module_from_spec(importlib.util.spec_from_loader("asl", loader))
loader.exec_module(m)

# pid -> (comm, ppid, pgrp, tpgid); terminal shell 10, its foreground job 20
procs = {
    20: ("claude", 10, 20, 20),        # Claude Code in front: labels
    21: ("sh", 20, 20, 20),            # its hook shell
    30: ("codex", 20, 30, -1),         # Codex app-server child of the front codex: labels
    40: ("bash", 50, 40, -1),          # a Hermes tool shell (no tty)
    41: ("claude", 40, 41, -1),        # claude -p started by Hermes: no label
    60: ("bash", 20, 60, 20),          # a shell inside the front agent
    61: ("codex", 60, 61, 20),         # codex started by that agent through a shell: no label
    50: ("python3", 1, 50, -1), 10: ("zsh", 1, 10, 20), 1: ("systemd", 0, 1, -1),
}
m.stat = lambda pid: procs[pid]
assert m.agent_pid(21) == 20 and m.visible(20)
assert m.visible(30)
assert m.agent_pid(40) == 50 and not m.visible(41)
assert not m.visible(61)

calls = []
m.subprocess.run = lambda cmd, **kw: calls.append(cmd)
os.environ["HC_TERMINAL_ID"] = "t9"
m.os.getppid = lambda: 21
assert m.main(["x", "sid-1"]) == 0 and calls == [["hc", "label", "t9", "agent.session=sid-1"]]
calls.clear(); m.os.getppid = lambda: 40
m.main(["x", "sid-2"]); assert calls == []
calls.clear(); del os.environ["HC_TERMINAL_ID"]
m.main(["x", "sid-3", "20"]); assert calls == []
print("ok")
