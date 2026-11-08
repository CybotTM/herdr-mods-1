// Pi / PiG extension: label this herdr-app terminal with the Pi session id (agent.session),
// for the agents-ids mod. Install: link this file into ~/.pi/agent/extensions/ (and ~/.pig/agent/extensions/).
// @ts-nocheck

import { execFile } from "node:child_process";
import { basename } from "node:path";

export default function (pi) {
  if (!process.env.HC_TERMINAL_ID) return; // not in herdr-app
  let active = false, last = "", lastAt = 0, pending = [], writing = false;
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
      try {
        execFile("agent-session-label", ["--doing", pending.shift(), String(process.pid)], { timeout: 4000 }, () => { writing = false; drain(); });
      } catch { writing = false; drain(); }
    };
    drain();
  };
  pi.on("session_start", (_event, ctx) => {
    if (ctx?.mode !== "tui") return; // headless modes (print, json, rpc) have no pane to label
    const id = ctx?.sessionManager?.getSessionId?.();
    if (typeof id !== "string" || !id) return;
    // fire and forget: the label must never slow Pi down. The app ("pi" or "pig") is the process
    // title, which `ps` on macOS doesn't show.
    active = true;
    execFile("agent-session-label", [id, String(process.pid), basename(process.title || "pi")], { timeout: 4000 }, () => {});
  });
  pi.on("turn_start", () => write("thinking"));
  pi.on("tool_call", (event) => {
    const name = ["bash", "read", "write", "edit", "grep", "find", "ls"].includes(event.toolName) ? event.toolName : "tool";
    const command = typeof event.input?.command === "string" ? event.input.command.split(/\s+/)[0] : "";
    const target = ["git", "npm", "node", "python", "python3", "pytest", "cargo", "go"].includes(command) ? ` ${command}` : "";
    write(`running: ${name}${target}`);
  });
  pi.on("agent_settled", () => write("done"));
}
