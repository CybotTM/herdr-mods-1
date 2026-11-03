// Self-check for agents-ids: node mods/agents-ids/test_logic.mjs
import assert from "node:assert/strict";
import { recentSessions, rememberSessions, resumeArgv, shortSid } from "./extras.mjs";

assert.equal(shortSid("local-e257df53a91b0666d3c2470352eebf013ed731f57b3b98d1f7314aea1783db1d"), "e257df53");
assert.equal(shortSid("d00d75b6-815e-4fca-b4b0-637a75b0ffd9"), "d00d75b6");        // Claude Code (v4)
assert.equal(shortSid("01a1a2fa-1f31-7890-b970-031ba094b970"), "01a1a2fa-1f31");   // Codex, Pi, PiG (v7)
assert.equal(shortSid("ses_e5d03aa98ffezZtVyF4DviEcOM"), "4DviEcOM");             // OpenCode
assert.equal(shortSid(undefined), "");

assert.deepEqual(resumeArgv("claude", "d00d75b6-815e-4fca"), ["claude", "--resume", "d00d75b6-815e-4fca"]);
assert.deepEqual(resumeArgv("claude-code", "abcd1234"), ["claude", "--resume", "abcd1234"]);
assert.deepEqual(resumeArgv("/usr/bin/codex", "abcd1234"), ["codex", "resume", "abcd1234"]);
assert.deepEqual(resumeArgv("opencode", "ses_e5d03aa98ffe"), ["opencode", "--session", "ses_e5d03aa98ffe"]);
assert.deepEqual(resumeArgv("hermes", "local-e257df53"), ["hermes", "--resume", "local-e257df53"]);
assert.equal(resumeArgv("vim", "abcd1234"), null);
assert.equal(resumeArgv("claude", "x; rm -rf ~"), null); // never typed into a shell
assert.equal(resumeArgv("claude", "$(id)"), null);
assert.equal(resumeArgv(undefined, "abcd1234"), null);

const all = [
  { address: "t1", state: "live", agent: "zsh", labels: { "agent.app": "claude", "agent.session": "aaaa1111" }, status_ms: 10 },
  { address: "t3", state: "live", agent: "codex", labels: { "agent.app": "codex", "agent.session": "cccc3333" }, status_ms: 20 },
  { address: "t4", state: "live", labels: { "agent.session": "dddd4444" } },            // no app: can't resume
  { address: "t5", state: "live", labels: {} },
  { address: "t6", state: "live", agent: "opencode", status: "idle", labels: { "agent.app": "opencode", "agent.session": "ses_x1234" } }, // a sub-agent, running
  { address: "t7", state: "live", agent: "vim", labels: { "agent.app": "claude", "agent.session": "eeee5555" }, status_ms: 5 },          // agent quit, vim open
];
const listed = new Set(["t3"]);
const gone = { bbbb2222: { sid: "bbbb2222", app: "pi", address: "t2", cwd: "/w", space: "s1", seen: 30 } }; // its terminal closed
let store = rememberSessions(gone, all, listed, 100);
assert.deepEqual(Object.keys(store).sort(), ["aaaa1111", "bbbb2222", "cccc3333", "eeee5555", "ses_x1234"]);
assert.equal(store.cccc3333.seen, 100);                       // running: seen now
assert.equal(store.aaaa1111.seen, 10);                        // ended: its last report
assert.equal(rememberSessions(store, all, listed, 100), store); // unchanged: same object, no write
assert.equal(rememberSessions(store, all, listed, 30000), store); // running, but seen < 1 min ago: no write
assert.equal(rememberSessions(store, all, listed, 70000).cccc3333.seen, 70000);
const recent = recentSessions(all, listed, store);
assert.deepEqual(recent.map((r) => r.address), ["t2", "t1", "t7"]); // codex and opencode run now; newest first
assert.deepEqual(recent[0], { sid: "bbbb2222", app: "pi", address: "t2", cwd: "/w", space: "s1", seen: 30, atShell: false, argv: ["pi", "--session", "bbbb2222"] });
assert.equal(recent[1].atShell, true);
assert.equal(recent[2].atShell, false); // never typed into vim
assert.equal(recentSessions(all, listed, store, 1).length, 1);
// Resumed in a new terminal: the same id runs again, so it leaves the list.
const resumed = [...all, { address: "t9", state: "live", agent: "pi", status: "working", labels: { "agent.app": "pi", "agent.session": "bbbb2222" } }];
assert.ok(!recentSessions(resumed, listed, rememberSessions(store, resumed, listed, 200)).some((r) => r.sid === "bbbb2222"));
// Old ones age out; at most 20 are kept.
assert.deepEqual(rememberSessions({ old1: { sid: "old1", app: "pi", address: "t0", seen: 0 } }, [], new Set(), 15 * 86400000), {});
const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`ssss${i}xx`, { sid: `ssss${i}xx`, app: "pi", address: `t${i}`, seen: 1000 + i }]));
assert.equal(Object.keys(rememberSessions(many, [], new Set(), 2000)).length, 20);
console.log("ok");
