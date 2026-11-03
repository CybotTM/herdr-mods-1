// Pi / PiG extension: label this herdr-app terminal with the Pi session id (agent.session),
// for the agents-ids mod. Install: link this file into ~/.pi/agent/extensions/ (and ~/.pig/agent/extensions/).
// @ts-nocheck

import { execFile } from "node:child_process";
import { basename } from "node:path";

export default function (pi) {
  if (!process.env.HC_TERMINAL_ID) return; // not in herdr-app
  pi.on("session_start", (_event, ctx) => {
    if (ctx?.mode !== "tui") return; // headless modes (print, json, rpc) have no pane to label
    const id = ctx?.sessionManager?.getSessionId?.();
    if (typeof id !== "string" || !id) return;
    // fire and forget: the label must never slow Pi down. The app ("pi" or "pig") is the process
    // title, which `ps` on macOS doesn't show.
    execFile("agent-session-label", [id, String(process.pid), basename(process.title || "pi")], { timeout: 4000 }, () => {});
  });
}
