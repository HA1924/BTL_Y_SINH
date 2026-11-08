// Client-safe helpers (no node: imports).

export const ALERT_LABEL = {
  spo2_low: "SpO₂ thấp (< 92%)",
  pr_abnormal: "PR ngoài 50–120 bpm",
  battery_low: "Pin yếu (< 20%)",
  offline: "Mất kết nối",
} as const;

export const TZ ="Asia/Ho_Chi_Minh";
export const VN_OFFSET_MS = 7 * 3600_000; // VN has no DST

const dtf = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** dd/mm/yyyy HH:mm:ss in Vietnam time */
export const fmtVN = (iso: string | number | Date) => dtf.format(new Date(iso)).replace(",", "");
export const fmtTimeVN = (iso: string | number | Date) => fmtVN(iso).slice(11);

/** YYYY-MM-DD of "today" in Vietnam */
export const todayVN = (offsetDays = 0) =>
  new Date(Date.now() + VN_OFFSET_MS + offsetDays * 86400_000).toISOString().slice(0, 10);

/** Parse YYYY-MM-DD as midnight Vietnam time; null if invalid. */
export function parseDayVN(s: string | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00+07:00`);
  return isNaN(d.getTime()) || new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10) !== s ? null : d;
}
