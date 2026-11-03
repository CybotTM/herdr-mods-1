// Self-check for agents-ids: node mods/agents-ids/test_logic.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const start = src.indexOf("export const shortSid");
const block = src.slice(start, src.indexOf("const clean", start)).replace("export ", "");
// new Function on this mod's own source file (local, trusted), only to test the helper without gpui-kit.
const shortSid = new Function(`${block}; return shortSid;`)();

assert.equal(shortSid("local-e257df53a91b0666d3c2470352eebf013ed731f57b3b98d1f7314aea1783db1d"), "e257df53");
assert.equal(shortSid("d00d75b6-815e-4fca-b4b0-637a75b0ffd9"), "d00d75b6");        // Claude Code (v4)
assert.equal(shortSid("01a1a2fa-1f31-7890-b970-031ba094b970"), "01a1a2fa-1f31");   // Codex, Pi, PiG (v7)
assert.equal(shortSid("ses_e5d03aa98ffezZtVyF4DviEcOM"), "4DviEcOM");             // OpenCode
assert.equal(shortSid(undefined), "");
console.log("ok");
