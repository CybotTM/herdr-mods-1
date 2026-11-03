// Self-check for spaces-plus' pure helpers (no window needed): node mods/spaces-plus/test_logic.mjs
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const src = readFileSync(new URL("./main.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const tilde"), src.indexOf("// What a stored color name")).replace(/export /g, "");
// new Function on this mod's own source file (local, trusted), only to test its helpers without gpui-kit.
const { tilde, changedCount, tabLabel, spaceName, duration } = new Function(`${block}; return { tilde, changedCount, tabLabel, spaceName, duration };`)();

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
console.log("ok");
