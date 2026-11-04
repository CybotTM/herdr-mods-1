// agents-ids' own helpers, kept out of main.js so Herdr's `agents` updates merge cleanly.
// Pure (no herdr imports): `node test_logic.mjs` loads them.

/** Short session id. Hermes drops "local-"; UUIDv7 ids (Pi, PiG, Codex) keep 13 chars, as their
 *  first 8 repeat for ~65 s; OpenCode's time-ordered "ses_…" ids show their last 8 (the random part). */
export const shortSid = (sid) => {
  const s = (sid ?? "").replace(/^local-/, "");
  if (/^ses_/.test(s)) return s.slice(-8);
  return s.slice(0, /^[0-9a-f]{8}-[0-9a-f]{4}-7/i.test(s) ? 13 : 8);
};

const RESUME = {
  claude: (id) => ["claude", "--resume", id],
  codex: (id) => ["codex", "resume", id],
  pi: (id) => ["pi", "--session", id],
  pig: (id) => ["pig", "--session", id],
  opencode: (id) => ["opencode", "--session", id],
  hermes: (id) => ["hermes", "--resume", id],
};

/** The command that reopens a session, or null for an unknown agent or an id that isn't plain
 *  letters, digits, `-`, `_`, `.` (labels are written by any program, and Resume may type this
 *  into a shell). */
export function resumeArgv(app, id) {
  const key = (app ?? "").toLowerCase().replace(/^.*\//, "").replace(/-code$/, "");
  return RESUME[key] && /^[\w.-]{4,128}$/.test(id ?? "") ? RESUME[key](id) : null;
}

const SHELLS = new Set(["sh", "bash", "dash", "zsh", "fish", "nu", "ksh"]);
const KEEP = 20;
const DAYS = 14;

/** A live terminal that runs an agent now (it reports a status), as opposed to a bare shell or
 *  another program. Shells and other programs report none. */
const running = (k, agentAddresses) => agentAddresses.has(k.address) || (k.state === "live" && Boolean(k.status) && k.status !== "unknown");

const entry = (k) => {
  const app = k.labels?.["agent.app"];
  const sid = k.labels?.["agent.session"];
  return resumeArgv(app, sid) ? { sid, app, address: k.address, cwd: k.cwd ?? null, space: k.labels?.["herdr.space"] ?? null } : null;
};

/** The remembered sessions (sid -> entry with `seen` ms) updated from the terminals now listed,
 *  so a session stays resumable after its terminal is gone, across restarts. The same object back
 *  when nothing changed (no write needed). */
export function rememberSessions(store, all, agentAddresses, now) {
  const next = { ...store };
  let changed = false;
  for (const k of all) {
    const e = entry(k);
    if (!e) continue;
    const old = next[e.sid];
    // Running: seen now, but at most once a minute (each change is a localStorage write).
    const seen = running(k, agentAddresses) ? (old && now - old.seen < 60000 ? old.seen : now) : old?.seen ?? k.status_ms ?? now;
    if (old && old.seen === seen && old.address === e.address && old.cwd === e.cwd && old.space === e.space) continue;
    next[e.sid] = { ...e, seen };
    changed = true;
  }
  const keep = Object.values(next).filter((e) => now - e.seen < DAYS * 86400000).sort((a, b) => b.seen - a.seen).slice(0, KEEP);
  if (keep.length !== Object.keys(next).length) changed = true;
  return changed ? Object.fromEntries(keep.map((e) => [e.sid, e])) : store;
}

/** The store with `sid` hidden from Recent sessions. Kept, not deleted, so a shell that still
 *  carries its label doesn't bring it back; running it again clears `hidden` (rememberSessions
 *  rewrites the entry when `seen` moves). */
export const hideSession = (store, sid) => (store[sid] ? { ...store, [sid]: { ...store[sid], hidden: true } } : store);

/** Agent sessions that ended and can be resumed, newest first, at most `max`: remembered ones
 *  whose agent isn't running anywhere now. `atShell`: the terminal is open at a bare shell, so
 *  Resume can type the command there; otherwise it opens a new tab. */
export function recentSessions(all, agentAddresses, store, max = 5) {
  const byAddress = new Map(all.map((k) => [k.address, k]));
  const runningSids = new Set(all.filter((k) => running(k, agentAddresses)).map((k) => k.labels?.["agent.session"]).filter(Boolean));
  return Object.values(store)
    .filter((e) => !e.hidden && !runningSids.has(e.sid) && resumeArgv(e.app, e.sid))
    .sort((a, b) => b.seen - a.seen)
    .slice(0, max)
    .map((e) => {
      const k = byAddress.get(e.address);
      const here = k?.labels?.["agent.session"] === e.sid;
      return { ...e, atShell: here && k.state === "live" && SHELLS.has(k.agent), argv: resumeArgv(e.app, e.sid) };
    });
}
