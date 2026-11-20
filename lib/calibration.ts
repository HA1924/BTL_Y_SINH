// Logic thuần (không đọc file) cho trang Hiệu chuẩn: kiểm tra số đo của thiết bị có đủ ổn định để ghép với máy tham chiếu.
import type { Reading } from "./store";

export const CAL_WINDOW_MS = 15_000; // ~3 bản ghi ở nhịp 5 giây
const MIN_QUALITY = 0.5;
const MAX_R_SPREAD = 0.1; // (max-min)/trung bình

export type Window = {
  ready: boolean;
  reason: string | null; // vì sao chưa lưu được
  n: number;
  r: number | null;
  pi: number | null;
  spo2: number | null;
  pr: number | null;
  quality: number | null;
};

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

/** `rows`: bản ghi trong CAL_WINDOW_MS gần nhất, đã sắp theo thời gian. */
export function summarizeWindow(rows: Reading[], now: number): Window {
  const empty = { n: 0, r: null, pi: null, spo2: null, pr: null, quality: null };
  const last = rows.at(-1);
  if (!last || now - Date.parse(last.ts) > CAL_WINDOW_MS) return { ready: false, reason: "Thiết bị đang ngoại tuyến", ...empty };
  if (rows.some((x) => !x.finger)) return { ready: false, reason: "Chưa đặt ngón tay, hoặc vừa rút ngón tay ra", ...empty };

  const withR = rows.filter((x) => typeof x.r === "number" && x.r > 0);
  const rs = withR.map((x) => x.r!);
  const pis = withR.filter((x) => typeof x.pi === "number").map((x) => x.pi!);
  const w = {
    n: withR.length,
    r: rs.length ? round(avg(rs), 4) : null,
    pi: pis.length ? round(avg(pis), 2) : null,
    spo2: round(avg(rows.map((x) => x.spo2)), 1),
    pr: Math.round(avg(rows.map((x) => x.pr))),
    quality: round(avg(rows.map((x) => x.signal_quality)), 2),
  };
  if (withR.length < 2) return { ready: false, reason: "Chưa đủ số đo R. Chờ thêm vài giây (thiết bị phải chạy firmware có gửi r)", ...w };
  if (w.quality < MIN_QUALITY) return { ready: false, reason: "Tín hiệu kém, chỉnh lại ngón tay trên cảm biến", ...w };
  if ((Math.max(...rs) - Math.min(...rs)) / w.r! > MAX_R_SPREAD) return { ready: false, reason: "Số đo chưa ổn định, giữ yên tay thêm vài giây", ...w };
  return { ready: true, reason: null, ...w };
}
