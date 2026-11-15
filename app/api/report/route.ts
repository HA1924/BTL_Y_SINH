import { store } from "@/lib/store";

const MAX_SPAN_MS = 24 * 3600_000;
const stat = (xs: number[]) =>
  xs.length
    ? { avg: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10, min: Math.min(...xs), max: Math.max(...xs) }
    : null;

// Số liệu cho phiếu kết quả đo: thống kê, cảnh báo và chuỗi điểm trong [from, to].
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const from = new Date(q.get("from") ?? ""), to = new Date(q.get("to") ?? "");
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return Response.json({ error: "from/to phải là thời gian ISO8601" }, { status: 400 });
  if (from >= to) return Response.json({ error: "Thời gian bắt đầu phải trước thời gian kết thúc" }, { status: 400 });
  if (to.getTime() - from.getTime() > MAX_SPAN_MS) return Response.json({ error: "Khoảng tối đa 24 giờ" }, { status: 400 });

  const [rows, alerts] = await Promise.all([store.getRange(from, to), store.getAlerts(from, to)]);
  const ok = rows.filter((r) => r.finger); // chỉ tính khi có ngón tay

  // Tối đa ~240 điểm cho biểu đồ in
  const bucket = Math.max(5_000, Math.ceil((to.getTime() - from.getTime()) / 240 / 5_000) * 5_000);
  const map = new Map<number, { pr: number; spo2: number; n: number }>();
  for (const r of ok) {
    const k = Math.floor(Date.parse(r.ts) / bucket) * bucket;
    const m = map.get(k) ?? { pr: 0, spo2: 0, n: 0 };
    m.pr += r.pr;
    m.spo2 += r.spo2;
    m.n++;
    map.set(k, m);
  }

  return Response.json({
    from: from.toISOString(),
    to: to.toISOString(),
    device_id: rows.at(-1)?.device_id ?? null,
    total: rows.length,
    valid: ok.length,
    pr: stat(ok.map((r) => r.pr)),
    spo2: stat(ok.map((r) => r.spo2)),
    quality: stat(ok.map((r) => r.signal_quality))?.avg ?? null,
    alerts,
    points: [...map].map(([t, m]) => ({ t, pr: Math.round(m.pr / m.n), spo2: Math.round((m.spo2 / m.n) * 10) / 10 })),
  });
}
