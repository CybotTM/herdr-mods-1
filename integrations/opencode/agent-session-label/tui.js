// OpenCode TUI plugin: label this herdr-app terminal with the session shown in the TUI
// (agent.session), for the agents-ids mod. Install: link this folder into ~/.config/opencode/
// and add "./agent-session-label" to "plugins" in ~/.config/opencode/cli.json.
// Supports both TUI plugin shapes: V1 `tui(api)` (api.route) and V2 `setup(api)` (api.ui.router).
import { execFile } from "node:child_process";

function watch(currentRoot) {
  if (!process.env.HC_TERMINAL_ID) return () => {}; // not in herdr-app
  let last;
  const poll = setInterval(() => {
    let id;
    try { id = currentRoot(); } catch { return; }
    if (typeof id !== "string" || !id || id === last) return;
    last = id;
    execFile("agent-session-label", [id], { timeout: 4000 }, () => {}); // fire and forget
  }, 1000);
  poll.unref?.();
  return () => clearInterval(poll);
}

// The root of a session tree: a subagent's child session belongs to the session that started it.
function root(id, get) {
  const seen = new Set();
  while (typeof id === "string" && !seen.has(id)) {
    seen.add(id);
    const s = get(id);
    if (!s?.parentID) return id;
    id = s.parentID;
  }
}

async function tui(api) {
  const stop = watch(() => {
    const r = api.route.current;
    return r?.name === "session" ? root(r.params?.sessionID, (id) => api.state.session.get(id)) : undefined;
  });
  api.lifecycle?.onDispose?.(stop);
}

function setup(api) {
  return watch(() => {
    const r = api.ui.router.current();
    return r?.type === "session" ? root(r.sessionID, (id) => api.data.session.get(id)) : undefined;
  });
}

export default { id: "agent-session-label", setup, tui };
