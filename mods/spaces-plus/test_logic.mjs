// Self-check for spaces-plus' pure helpers (no window needed): node mods/spaces-plus/test_logic.mjs
import assert from "node:assert/strict";
import { assignPorts, changedCount, cpuPercent, cpuTimes, duration, memPercent, parseListeners, portUrl, prsByBranch, spaceName, tabLabel, tilde } from "./extras.mjs";

assert.equal(tilde("/home/alex/code/x"), "~/code/x");
assert.equal(changedCount("# branch.head main\n1 .M N... a b\n? new.txt\nu UU x\n2 R. y\n# branch.ab +0 -0\n"), 4);
assert.equal(changedCount("# branch.head main\n"), 0);
assert.equal(duration(90 * 60000), "1h");

const ps = [{ tab: "t1", terminal: "t1n", title: "⠋ Open herdr-app session", program: { name: "Hermes", agent: true } }];
assert.equal(tabLabel({ id: "t1", index: 1, name: "1", named: false }, ps), "1 · Open herdr-app session");
assert.equal(tabLabel({ id: "t1", index: 1, name: "fix", named: true }, ps), "fix");
assert.equal(tabLabel({ id: "t2", index: 2, name: "2", named: false }, ps), "2");
assert.equal(spaceName({ name: "~", named: false, tabs: [{ id: "t1" }] }, ps), "hermes");
assert.equal(spaceName({ name: "~", named: true, tabs: [{ id: "t1" }] }, ps), "~");
assert.equal(spaceName({ name: "api", named: false, tabs: [{ id: "t1" }] }, ps), "api");

// Ports: what PORTS_SCRIPT prints (ss on Linux; lsof on macOS prints the same shape).
const out = [
  "127.0.0.1:5173\t11\tnode\t/home/alex/code/web",
  "[::1]:5173\t11\tnode\t/home/alex/code/web",               // the same server on IPv6: once
  "*:8000\t12\tuvicorn\t/home/alex/code/api/.worktrees/fix",  // a worktree inside the checkout
  "0.0.0.0:3000\t13\tnode\t/home/alex/code/api/web",
  "100.64.0.2%tailscale0:9000\t14\tpython3\t/home/alex/code/api",
  "127.0.0.1:41234\t15\tnode\t/home/alex/code/web",            // ephemeral: left out
  "127.0.0.1:4096\t16\topencode\t/home/alex/code/web",         // an agent's own server: left out
  "127.0.0.1:2222\t17\tsshd-ish\t/home/alex",                  // under home only: no space
  "garbage",
].join("\n");
const listeners = parseListeners(out);
assert.equal(listeners.length, 6);
assert.deepEqual(listeners[4], { host: "100.64.0.2", port: 9000, pid: 14, name: "python3", cwd: "/home/alex/code/api" });
const ports = assignPorts(listeners, ["/home/alex/code/web", "/home/alex/code/api", "/home/alex/code/api/.worktrees/fix/", "/home/alex", null]);
assert.deepEqual(ports.get("/home/alex/code/web"), [{ host: "localhost", port: 5173, name: "node" }]);
assert.deepEqual(ports.get("/home/alex/code/api").map((p) => p.port), [3000, 9000]);   // web/ is inside api
assert.deepEqual(ports.get("/home/alex/code/api/.worktrees/fix").map((p) => p.port), [8000]); // the closest folder wins
assert.equal(ports.get("/home/alex"), undefined);
assert.equal(portUrl({ host: "localhost", port: 5173 }, null), "http://localhost:5173");
assert.equal(portUrl({ host: "localhost", port: 5173 }, "vps"), "http://vps:5173");
assert.equal(portUrl({ host: "100.64.0.2", port: 9000 }, "vps"), "http://100.64.0.2:9000");

// Pull requests: the newest per branch; closed-unmerged ones go.
const prs = prsByBranch(JSON.stringify([
  { number: 12, headRefName: "fix", state: "OPEN", isDraft: true, url: "https://github.com/o/r/pull/12" },
  { number: 9, headRefName: "fix", state: "MERGED", isDraft: false, url: "u9" },
  { number: 8, headRefName: "old", state: "CLOSED", isDraft: false, url: "u8" },
  { number: 7, headRefName: "done", state: "MERGED", isDraft: false, url: "u7" },
]));
assert.deepEqual(prs.get("fix"), { number: 12, state: "OPEN", draft: true, url: "https://github.com/o/r/pull/12" });
assert.equal(prs.get("old"), undefined);
assert.equal(prs.get("done").state, "MERGED");
assert.equal(prsByBranch("not json").size, 0);

// Machine load.
const a = cpuTimes("cpu  100 0 100 700 100 0 0 0\n");
assert.equal(cpuPercent(a, cpuTimes("cpu  150 0 150 750 150 0 0 0\n")), 50);
assert.equal(cpuPercent(null, a), null);
assert.equal(memPercent("MemTotal: 1000 kB\nMemAvailable: 250 kB\n"), 75);
assert.equal(memPercent(null), null);
console.log("ok");
