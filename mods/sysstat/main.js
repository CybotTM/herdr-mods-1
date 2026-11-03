import { View } from "gpui-kit";
import { h_flex } from "gpui-base";
import { readTextFile, theme } from "herdr";

export default class Sysstat extends View {
  init(_props, cx) {
    this.text = "CPU —  MEM —";
    this.cpu = null;
    this.refresh(cx);
    cx.timer.every(2000, cx => this.refresh(cx));
  }

  refresh(cx) {
    if (this.busy) return;
    this.busy = true;
    cx.spawn(async cx => {
      let text;
      try {
        const [stat, mem] = await Promise.all([readTextFile("/proc/stat"), readTextFile("/proc/meminfo")]);
        const fields = stat?.match(/^cpu\s+(.+)$/m)?.[1].trim().split(/\s+/).slice(0, 8).map(Number);
        const total = Number(mem?.match(/^MemTotal:\s+(\d+)/m)?.[1]);
        const available = Number(mem?.match(/^MemAvailable:\s+(\d+)/m)?.[1]);
        if (!fields || fields.length < 4 || fields.some(n => !Number.isFinite(n)) || !total || !Number.isFinite(available) || available > total) throw new Error("Invalid proc data");
        const sum = fields.reduce((a, b) => a + b, 0);
        const idle = fields[3] + (fields[4] || 0);
        if (this.previous && sum > this.previous.sum) this.cpu = Math.max(0, Math.min(100, Math.round(100 * (1 - (idle - this.previous.idle) / (sum - this.previous.sum)))));
        this.previous = {sum, idle};
        const used = total - available;
        text = `CPU ${this.cpu === null ? "—" : `${this.cpu}%`}  MEM ${(used / 1048576).toFixed(1)}/${(total / 1048576).toFixed(1)} GiB (${Math.round(100 * used / total)}%)`;
      } catch (_) {
        this.previous = null;
        this.cpu = null;
        text = "CPU / MEM unavailable";
      }
      this.busy = false;
      if (text !== this.text) { this.text = text; cx.notify(); }
    });
  }

  render() {
    const t = theme();
    return h_flex().size_full().px(14).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted).child(this.text);
  }
}
