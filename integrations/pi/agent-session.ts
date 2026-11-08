// Pi / PiG extension: label this herdr-app terminal with the Pi session id (agent.session),
// for the agents-ids mod. Install: link this file into ~/.pi/agent/extensions/ (and ~/.pig/agent/extensions/).
// @ts-nocheck

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

// PiG runs TS extensions in a Node cell that has PIG_EXT_HOST_INFO set; plain Pi doesn't. The app
// name decides how agents-ids resumes a session (pig --session vs pi --session), and the process
// title alone can't be trusted for it.
const APP = process.env.PIG_EXT_HOST_INFO ? "pig" : basename(process.title || "pi");

// Linux only: is the agent (this process, or its Pi/PiG parent) the terminal's foreground job
// leader? The same check agent-session-label makes before labeling, done here once so the doing
// updates can go straight to `hc` instead of through the python helper on every tool call.
function isForegroundLeader() {
  try {
    const stat = (pid) => {
      const raw = readFileSync(`/proc/${pid}/stat`, "utf8");
      const f = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
      return { pgrp: Number(f[2]), tpgid: Number(f[5]) };
    };
    const me = stat(process.pid);
    if (process.pid === me.pgrp && me.pgrp === me.tpgid) return true;
    const parent = stat(process.ppid);
    return process.ppid > 1 && process.ppid === parent.pgrp && parent.pgrp === parent.tpgid;
  } catch {
    return false; // no /proc (macOS): let agent-session-label decide
  }
}

export default function (pi) {
  if (!process.env.HC_TERMINAL_ID) return; // not in herdr-app
  const term = process.env.HC_TERMINAL_ID;
  let active = false, direct = false, last = "", lastAt = 0, pending = [], writing = false;
  const write = (text) => {
    if (!active || text === last) return;
    const now = Date.now();
    // shortcut: a rapid second tool may be hidden until the next state, add trailing updates if needed.
    if (text.startsWith("running:") && last.startsWith("running:") && now - lastAt < 2000) return;
    last = text;
    lastAt = now;
    pending.push(text);
    const drain = () => {
      if (writing || !pending.length) return;
      writing = true;
      const next = pending.shift();
      const done = () => { writing = false; drain(); };
      if (direct) {
        // fast path: straight to hc, no python helper per update
        execFile("hc", ["label", term, `agent.doing=${next}`, `agent.doing.since=${Math.floor(Date.now() / 1000)}`], { timeout: 4000 }, done);
      } else {
        execFile("agent-session-label", ["--doing", next, String(process.pid)], { timeout: 4000 }, done);
      }
    };
    drain();
  };
  pi.on("session_start", (_event, ctx) => {
    if (ctx?.mode !== "tui") return; // headless modes (print, json, rpc) have no pane to label
    const id = ctx?.sessionManager?.getSessionId?.();
    if (typeof id !== "string" || !id) return;
    // fire and forget: the label must never slow Pi down.
    active = true;
    if (isForegroundLeader()) {
      // we may label, so skip the helper's process walk: one hc call per session instead of one
      // python spawn per update. The helper would only run the same hc call, so a failed hc write
      // is not retried — the next update overwrites it, as before.
      direct = true;
      execFile("hc", ["label", term, `agent.session=${id}`, `agent.app=${APP}`], { timeout: 4000 }, () => {});
    } else {
      execFile("agent-session-label", [id, String(process.pid), APP], { timeout: 4000 }, () => {});
    }
  });
  pi.on("turn_start", () => write("thinking"));
  pi.on("tool_call", (event) => {
    const name = ["bash", "read", "write", "edit", "grep", "find", "ls"].includes(event.toolName) ? event.toolName : "tool";
    const command = typeof event.input?.command === "string" ? event.input.command.split(/\s+/)[0] : "";
    const target = ["git", "npm", "node", "python", "python3", "pytest", "cargo", "go"].includes(command) ? ` ${command}` : "";
    write(`running: ${name}${target}`);
  });
  // settled in the TUI means sitting at the prompt: say so instead of a "done" that reads like the
  // session ended.
  pi.on("agent_settled", () => write("waiting for you"));
}
