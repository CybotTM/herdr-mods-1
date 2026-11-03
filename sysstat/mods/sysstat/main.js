// CPU (with a one-minute sparkline), memory and, on amdgpu, GPU load and VRAM of the machine the
// shown space lives on, read from its /proc and /sys every 2 s (a remote space's through herdr-core).
// Click: btop (else htop, else top) in a new tab of the shown space.
import { View, div } from "gpui-kit";
import { h_flex } from "gpui-base";
import { exec, readTextFile, run, spaces, theme } from "herdr";
import { SAMPLES, cpuPercent, cpuTimes, gib, gpu, memory, push } from "./logic.mjs";

const read = (path, on) => readTextFile(path, { on }).catch(() => null);

// The amdgpu card's sysfs folder on that machine, or null (other GPUs: not shown).
async function findGpu(on) {
  for (let n = 0; n < 4; n++) {
    const dir = `/sys/class/drm/card${n}/device`;
    if ((await read(`${dir}/gpu_busy_percent`, on)) !== null) return dir;
  }
  return null;
}

export default class Sysstat extends View {
  init(_props, cx) {
    this.machine = undefined;
    this.refresh(cx);
    cx.timer.every(2000, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    const on = spaces().find((s) => s.active)?.machine ?? null;
    if (on !== this.machine) {
      Object.assign(this, { machine: on, previous: null, cpu: null, hist: [], mem: null, gpu: null, gpuDir: undefined, error: false });
      cx.notify();
    }
    if (this.busy) return;
    this.busy = true;
    cx.spawn(async (cx) => {
      try {
        const [stat, mem] = await Promise.all([read("/proc/stat", on), read("/proc/meminfo", on)]);
        if (on !== this.machine) return; // the shown space moved to another machine while reading
        const now = cpuTimes(stat);
        this.mem = memory(mem);
        this.error = !now || !this.mem;
        this.cpu = cpuPercent(this.previous, now);
        this.previous = now;
        if (this.cpu !== null) this.hist = push(this.hist, this.cpu);
        if (this.gpuDir === undefined) this.gpuDir = await findGpu(on);
        if (this.gpuDir) {
          const d = this.gpuDir;
          const [b, u, t] = await Promise.all([read(`${d}/gpu_busy_percent`, on), read(`${d}/mem_info_vram_used`, on), read(`${d}/mem_info_vram_total`, on)]);
          this.gpu = gpu(b, u, t);
        }
      } finally {
        this.busy = false;
      }
      cx.notify();
    });
  }

  openMonitor() {
    const space = spaces().find((s) => s.active);
    // herdr's exec takes an argument list (no shell from us); the sh -c script is a constant.
    exec("sh", ["-c", "command -v btop || command -v htop || echo top"], { on: this.machine })
      .then((r) => run("tab.new", { space: space?.id, name: "monitor", argv: [r.stdout.trim().split("\n")[0] || "top"] }))
      .catch(() => {});
  }

  render() {
    const t = theme();
    const label = (s) => div().flex_none().text_color(t.dim).child(s);
    const value = (s) => div().flex_none().text_color(t.muted).child(s);
    const spark = h_flex().flex_none().w(SAMPLES * 3).h(14).gap(1).items_end()
      .children(this.hist.map((v, i) => div().id(`s${i}`).w(2).h(Math.max(1, Math.round((v * 14) / 100))).bg(v >= 90 ? t.blocked : t.accent)));
    const g = this.gpu;
    const m = this.mem;
    const tip = [this.machine ? `On ${this.machine}` : "This computer"];
    if (m) tip.push(`Memory ${Math.round((100 * m.used) / m.total)}% used`);
    tip.push("Click: open btop in a new tab");
    return h_flex().id("sysstat").size_full().px(14).gap(6).items_center().bg(t.chrome).border_t(1).border_color(t.border)
      .text_size(11.8).hover((s) => s.bg(t.hover)).tooltip(tip.join("\n"))
      .on_click(() => this.openMonitor())
      .when(Boolean(this.machine), (el) => el.child(div().flex_shrink(1).min_w(0).truncate().text_color(t.accent).child(this.machine)))
      .when(this.error, (el) => el.child(value("CPU / MEM unavailable")))
      .when(!this.error, (el) => el
        .child(label("CPU")).child(value(this.cpu === null ? "—" : `${this.cpu}%`)).child(spark)
        .child(label("MEM")).child(value(m ? `${gib(m.used)}/${gib(m.total)}G` : "—"))
        .when(Boolean(g), (el) => el.child(label("GPU")).child(value(`${g.busy}%${g.used !== null && g.total ? ` ${gib(g.used)}/${gib(g.total)}G` : ""}`))));
  }
}
