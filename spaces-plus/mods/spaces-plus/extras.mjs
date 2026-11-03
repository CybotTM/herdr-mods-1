// spaces-plus' own helpers (ports, pull requests, machine load), kept out of main.js so Herdr's
// `spaces` updates merge cleanly. Pure (no herdr imports): `node test_logic.mjs` loads them.

export const tilde = (path) => (path || "~").replace(/^\/home\/[^/]+|^\/Users\/[^/]+/, "~");
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

export function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// A tab's label: its name, or the title its lead program set (as the agents mod does).
export function tabLabel(tab, ps) {
  const mine = ps.filter((p) => p.tab === tab.id && p.terminal);
  const l = mine.find((p) => p.program?.agent) ?? mine.find((p) => p.focused) ?? mine[0];
  const live = clean(l?.title);
  const telling = live && live !== l?.program?.name && !/^[~/]/.test(live) && !live.includes("@");
  return tab.named || !telling ? tab.name : `${tab.index} \u00b7 ${live}`;
}

// What a space is called: its name, or for an unnamed home space ("~") the agent in it.
export function spaceName(w, ps) {
  if (w.named || w.name !== "~") return w.name;
  const tabs = new Set(w.tabs.map((t) => t.id));
  return ps.find((p) => tabs.has(p.tab) && p.program?.agent)?.program?.name?.toLowerCase() || w.name;
}

// Changed files in `git status --porcelain=v2` output: tracked changes, conflicts and untracked.
export function changedCount(out) {
  return out.split("\n").filter((l) => /^[12u?] /.test(l)).length;
}
/** Prints one line per listening TCP socket of this user's processes: address, pid, program, its
 *  folder (tab-separated). `ss` and /proc on Linux, `lsof` elsewhere (macOS). A constant script,
 *  run with `sh -c` on the space's machine; nothing from a space goes into it. */
export const PORTS_SCRIPT = `
if command -v ss >/dev/null 2>&1; then
  ss -ltnpH 2>/dev/null | while read -r _ _ _ addr _ users; do
    printf '%s\\n' "$users" | grep -o '"[^"]*",pid=[0-9]*' | sort -u | while IFS= read -r pair; do
      name=\${pair%%\\",pid=*}; pid=\${pair##*pid=}
      printf '%s\\t%s\\t%s\\t%s\\n' "$addr" "$pid" "\${name#\\"}" "$(readlink /proc/$pid/cwd 2>/dev/null)"
    done
  done
else
  lsof -nP -iTCP -sTCP:LISTEN -Fpcn 2>/dev/null | awk '/^p/{p=substr($0,2)} /^c/{c=substr($0,2)} /^n/{print substr($0,2) "\\t" p "\\t" c}' | sort -u |
  while IFS="$(printf '\\t')" read -r addr pid name; do
    printf '%s\\t%s\\t%s\\t%s\\n' "$addr" "$pid" "$name" "$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
  done
fi`;

// Coding agents and their helpers listen too (OpenCode's server, IDE bridges); not a space's app.
const AGENTS = new Set(["claude", "codex", "opencode", "pi", "pig", "hermes", "herdr-core", "herdr-app"]);
const ANY = new Set(["*", "0.0.0.0", "::", "127.0.0.1", "::1", "localhost"]);

/** PORTS_SCRIPT's output as [{ host, port, pid, name, cwd }]. Ephemeral ports (32768 and up: a
 *  program's private socket, not something to open) and agents' own are left out. */
export function parseListeners(out) {
  const list = [];
  for (const line of (out ?? "").split("\n")) {
    const [addr, pid, name, cwd] = line.split("\t");
    const m = addr?.match(/^\[?(.*?)\]?(?:%[^:]*)?:(\d+)$/);
    if (!m || !cwd) continue;
    const port = Number(m[2]);
    if (!(port > 0 && port < 32768) || AGENTS.has(name)) continue;
    list.push({ host: ANY.has(m[1]) ? "localhost" : m[1], port, pid: Number(pid), name, cwd });
  }
  return list;
}

const isHome = (f) => /^(\/home\/[^/]+|\/Users\/[^/]+|\/root|\/)\/?$/.test(f);

/** Folder -> its listening ports ([{ host, port, name }], by port): a socket belongs to the space
 *  whose folder holds the program's folder most closely (a worktree's server goes to the worktree,
 *  not the checkout around it). Home folders take none: everything runs under home. */
export function assignPorts(listeners, folders) {
  const usable = [...new Set(folders)].filter((f) => f && !isHome(f)).map((f) => f.replace(/\/+$/, ""));
  const out = new Map();
  for (const l of listeners) {
    const best = usable.filter((f) => l.cwd === f || l.cwd.startsWith(`${f}/`)).sort((a, b) => b.length - a.length)[0];
    if (!best) continue;
    const mine = out.get(best) ?? [];
    if (!mine.some((p) => p.port === l.port)) mine.push({ host: l.host, port: l.port, name: l.name });
    out.set(best, mine.sort((a, b) => a.port - b.port));
  }
  return out;
}

export const portUrl = (p, machine) => `http://${p.host === "localhost" && machine ? machine : p.host}:${p.port}`;

/** `gh pr list --json number,headRefName,state,isDraft,url` output as branch -> the newest PR from it
 *  ({ number, state, draft, url }); closed-unmerged ones are left out. */
export function prsByBranch(json) {
  const out = new Map();
  let list = [];
  try { list = JSON.parse(json ?? "[]"); } catch {}
  for (const p of Array.isArray(list) ? list : []) {
    if (!p?.headRefName || out.has(p.headRefName) || p.state === "CLOSED") continue;
    out.set(p.headRefName, { number: p.number, state: p.state, draft: Boolean(p.isDraft), url: p.url });
  }
  return out;
}

/** /proc/stat's first line as [busy, total] jiffies, or null. */
export function cpuTimes(stat) {
  const f = stat?.match(/^cpu\s+(.+)$/m)?.[1].trim().split(/\s+/).slice(0, 8).map(Number);
  if (!f || f.length < 4 || f.some((n) => !Number.isFinite(n))) return null;
  const total = f.reduce((a, b) => a + b, 0);
  return [total - f[3] - (f[4] || 0), total];
}

export function cpuPercent(prev, now) {
  if (!prev || !now || now[1] <= prev[1]) return null;
  return Math.max(0, Math.min(100, Math.round((100 * (now[0] - prev[0])) / (now[1] - prev[1]))));
}

/** Memory in use, % of total, from /proc/meminfo, or null. */
export function memPercent(meminfo) {
  const kib = (key) => Number(meminfo?.match(new RegExp(`^${key}:\\s+(\\d+)`, "m"))?.[1]);
  const total = kib("MemTotal");
  const avail = kib("MemAvailable");
  return total > 0 && avail >= 0 && avail <= total ? Math.round((100 * (total - avail)) / total) : null;
}
