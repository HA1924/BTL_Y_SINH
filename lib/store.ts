import fs from "node:fs";
import path from "node:path";

export type Reading = {
  device_id: string;
  ts: string; // ISO8601
  pr: number;
  spo2: number;
  battery_v: number;
  battery_pct: number;
  signal_quality: number;
  finger: boolean;
};

export type AlertType = "spo2_low" | "pr_abnormal" | "battery_low" | "offline";

export type Alert = {
  type: AlertType;
  start: string;
  end: string | null; // null = đang diễn ra
  value: string;
};

export interface Store {
  addReading(r: Reading): Promise<void>;
  getLatest(): Promise<Reading | null>;
  getRange(from: Date, to: Date): Promise<Reading[]>;
  getAlerts(from: Date, to: Date): Promise<Alert[]>;
}

export const ONLINE_WINDOW_MS = 15_000;
export const ALERT_MIN_MS = 10_000;

const t = (r: Reading) => Date.parse(r.ts);

/** Pure: derive alerts from time-sorted readings. Shared by any Store implementation. */
export function computeAlerts(rs: Reading[], now: number): Alert[] {
  const out: Alert[] = [];
  const iso = (ms: number) => new Date(ms).toISOString();

  // Episode tracker: consecutive readings matching a condition, broken by gaps or finger=false.
  type Ep = { start: number; end: number; worst: number };
  const track = (
    type: AlertType,
    match: (r: Reading) => boolean,
    worse: (a: number, b: number) => number,
    pick: (r: Reading) => number,
    fmt: (v: number) => string,
    minMs: number,
    needFinger: boolean,
  ) => {
    let ep: Ep | null = null;
    const close = (ongoing: boolean) => {
      if (ep && (minMs === 0 || ep.end - ep.start > minMs)) {
        out.push({ type, start: iso(ep.start), end: ongoing ? null : iso(ep.end), value: fmt(ep.worst) });
      }
      ep = null;
    };
    let prev: number | null = null;
    for (const r of rs) {
      const ms = t(r);
      if (prev !== null && ms - prev > ONLINE_WINDOW_MS) close(false);
      prev = ms;
      if ((!needFinger || r.finger) && match(r)) {
        const v = pick(r);
        if (ep) {
          ep.end = ms;
          ep.worst = worse(ep.worst, v);
        } else ep = { start: ms, end: ms, worst: v };
      } else close(false);
    }
    const last = rs.at(-1);
    close(!!last && now - t(last) <= ONLINE_WINDOW_MS);
  };

  track("spo2_low", (r) => r.spo2 < 92, Math.min, (r) => r.spo2, (v) => `SpO₂ thấp nhất ${v}%`, ALERT_MIN_MS, true);
  track(
    "pr_abnormal",
    (r) => r.pr < 50 || r.pr > 120,
    (a, b) => (Math.abs(b - 85) > Math.abs(a - 85) ? b : a),
    (r) => r.pr,
    (v) => `PR ${v} bpm`,
    ALERT_MIN_MS,
    true,
  );
  track("battery_low", (r) => r.battery_pct < 20, Math.min, (r) => r.battery_pct, (v) => `Pin ${v}%`, 0, false);

  // Mất kết nối: khoảng trống > 15 s giữa hai bản ghi, hoặc bản ghi cuối đã cũ.
  for (let i = 1; i < rs.length; i++) {
    const gap = t(rs[i]) - t(rs[i - 1]);
    if (gap > ONLINE_WINDOW_MS) {
      out.push({ type: "offline", start: rs[i - 1].ts, end: rs[i].ts, value: `Mất ${fmtDur(gap)}` });
    }
  }
  const last = rs.at(-1);
  if (last && now - t(last) > ONLINE_WINDOW_MS) {
    out.push({ type: "offline", start: last.ts, end: null, value: `Mất ${fmtDur(now - t(last))}` });
  }

  return out.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
}

function fmtDur(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} giây`;
  if (s < 3600) return `${Math.round(s / 60)} phút`;
  return `${(s / 3600).toFixed(1)} giờ`;
}

/** Local implementation: append-only NDJSON file + in-memory sorted index. */
class LocalStore implements Store {
  private rows: Reading[] = [];
  constructor(private file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) {
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        if (!line.trim()) continue;
        try {
          this.insert(JSON.parse(line));
        } catch {
          // ponytail: skip a torn last line (e.g. crash mid-write) instead of failing startup
        }
      }
    }
  }

  // first index with ts >= ms
  private lower(ms: number) {
    let lo = 0, hi = this.rows.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (t(this.rows[mid]) < ms) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private insert(r: Reading) {
    const last = this.rows.at(-1);
    if (!last || t(last) <= t(r)) this.rows.push(r);
    else this.rows.splice(this.lower(t(r) + 1), 0, r);
  }

  async addReading(r: Reading) {
    fs.appendFileSync(this.file, JSON.stringify(r) + "\n");
    this.insert(r);
  }
  async getLatest() {
    return this.rows.at(-1) ?? null;
  }
  async getRange(from: Date, to: Date) {
    return this.rows.slice(this.lower(from.getTime()), this.lower(to.getTime() + 1));
  }
  async getAlerts(from: Date, to: Date) {
    return computeAlerts(await this.getRange(from, to), Math.min(Date.now(), to.getTime()));
  }
}

// One instance per process (Next dev may load this module in several bundles).
const g = globalThis as unknown as { __store?: Store };
export const store: Store = (g.__store ??= new LocalStore(path.join(process.cwd(), "data", "readings.ndjson")));
