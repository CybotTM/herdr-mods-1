// Kuota collector JSON, kept separate from Herdr so it can be tested with Node.
export function parse(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Invalid collector output"); }
  if (!data || !Array.isArray(data.providers)) throw new Error("Invalid collector output");
  return data.providers.filter((p) => p && typeof p.id === "string" && typeof p.state === "string");
}

const windows = (p) => Array.isArray(p.windows) ? p.windows.filter((w) => w && typeof w.usedPercent === "number" && Number.isFinite(w.usedPercent) && w.usedPercent >= 0 && w.usedPercent <= 100) : [];

export function busiest(providers) {
  let best = null;
  for (const p of providers) if (p.state === "ok") for (const w of windows(p)) {
    if (!best || w.usedPercent > best.percent) best = { id: p.id, percent: w.usedPercent };
  }
  return best;
}

export function resetIn(date, now = Date.now()) {
  const time = Date.parse(date);
  if (!Number.isFinite(time)) return null;
  const minutes = Math.ceil((time - now) / 60000);
  if (minutes <= 0) return "now";
  const days = Math.floor(minutes / 1440), hours = Math.floor(minutes % 1440 / 60);
  if (days) return `${days}d${hours ? ` ${hours}h` : ""}`;
  if (hours) return `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
  return `${minutes}m`;
}

export function tooltip(providers, now = Date.now()) {
  return providers.flatMap((p) => {
    if (p.state !== "ok") return [`${p.id}: ${p.state === "auth-needed" ? "needs login" : "unavailable"}`];
    return windows(p).map((w) => {
      const reset = resetIn(w.resetAt, now);
      return `${p.id}: ${w.label || w.id || "Usage"} ${w.usedPercent}%${reset ? ` · resets ${reset === "now" ? "now" : `in ${reset}`}` : ""}`;
    });
  }).join("\n");
}
