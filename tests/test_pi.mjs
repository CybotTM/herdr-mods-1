import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// PiG's runtime sets this and plain Pi doesn't; the extension reads it at import time.
process.env.PIG_EXT_HOST_INFO = '{"configDirName":".pig"}';
const extension = (await import("../integrations/pi/agent-session.ts")).default;

const dir = mkdtempSync(join(tmpdir(), "herdr-pi-test-"));
const log = join(dir, "calls");
writeFileSync(join(dir, "agent-session-label"), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$PI_TEST_LOG"\n', { mode: 0o755 });
// A fake hc too: on Linux the extension may label through hc directly (foreground leader), and the
// test must never reach the real one. Which path runs depends on the environment; both must label.
writeFileSync(join(dir, "hc"), '#!/bin/sh\nprintf "hc %s\\n" "$*" >> "$PI_TEST_LOG"\n', { mode: 0o755 });
process.env.PATH = `${dir}:${process.env.PATH}`;
process.env.PI_TEST_LOG = log;
process.env.HC_TERMINAL_ID = "t9";
const hooks = {};
extension({ on: (name, fn) => { hooks[name] = fn; } });
hooks.session_start({}, { mode: "tui", sessionManager: { getSessionId: () => "sid" } });
hooks.turn_start();
hooks.tool_call({ toolName: "bash", input: { command: "npm test secret-token" } });
hooks.tool_call({ toolName: "bash", input: { command: "npm test other-secret" } });
hooks.tool_call({ toolName: "read", input: { path: "/secret" } });
hooks.agent_settled();
for (let i = 0; i < 100 && (!existsSync(log) || readFileSync(log, "utf8").trim().split("\n").length < 4); i++) await new Promise(r => setTimeout(r, 20));
const lines = readFileSync(log, "utf8").trim().split("\n");
assert.equal(lines.length, 4);
// The session label carries the app name (pig --session resumes it); the doing labels carry the
// activity. Direct hc calls read "hc label t9 k=v ...", helper calls "--doing <text> <pid>".
const all = lines.join("\n");
assert(lines.some(s => s.includes("agent.session=sid") || /^sid /.test(s)));
assert(lines.some(s => s.includes("agent.app=pig") || /(^| )sid \d+ pig$/.test(s)));
assert(/agent\.doing=thinking|--doing thinking /.test(all));
assert(/agent\.doing=running: bash npm|--doing running: bash npm /.test(all));
assert(/agent\.doing=waiting for you|--doing waiting for you /.test(all));
assert(!all.includes("secret"));
console.log("ok");
