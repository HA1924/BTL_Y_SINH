import { safeEqual } from "@/lib/auth";
import { store, type Reading } from "@/lib/store";

const num = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;

/** Returns an error message, or null when valid. */
function validate(b: Record<string, unknown>): string | null {
  if (typeof b.device_id !== "string" || !b.device_id.trim() || b.device_id.length > 64) return "device_id không hợp lệ";
  if (typeof b.ts !== "string" || isNaN(Date.parse(b.ts))) return "ts phải là ISO8601";
  if (typeof b.finger !== "boolean") return "finger phải là boolean";
  // Khi chưa đặt ngón tay cảm biến không đo được, nên chỉ kiểm tra khoảng khi finger=true.
  if (!num(b.pr, b.finger ? 30 : 0, 220)) return "pr ngoài khoảng 30–220";
  if (!num(b.spo2, b.finger ? 70 : 0, 100)) return "spo2 ngoài khoảng 70–100";
  if (!num(b.battery_v, 0, 10)) return "battery_v không hợp lệ";
  if (!num(b.battery_pct, 0, 100)) return "battery_pct ngoài khoảng 0–100";
  if (!num(b.signal_quality, 0, 1)) return "signal_quality ngoài khoảng 0–1";
  return null;
}

export async function POST(req: Request) {
  const key = process.env.DEVICE_KEY;
  if (!key || !(await safeEqual(req.headers.get("x-device-key") ?? "", key))) {
    return Response.json({ error: "Sai khóa thiết bị" }, { status: 401 });
  }
  let b: Record<string, unknown>;
  try {
    b = await req.json();
    if (!b || typeof b !== "object" || Array.isArray(b)) throw 0;
  } catch {
    return Response.json({ error: "JSON không hợp lệ" }, { status: 400 });
  }
  const err = validate(b);
  if (err) return Response.json({ error: err }, { status: 400 });

  const r: Reading = {
    device_id: (b.device_id as string).trim(),
    ts: new Date(b.ts as string).toISOString(),
    pr: b.pr as number,
    spo2: b.spo2 as number,
    battery_v: b.battery_v as number,
    battery_pct: b.battery_pct as number,
    signal_quality: b.signal_quality as number,
    finger: b.finger as boolean,
  };
  await store.addReading(r);
  return Response.json({ ok: true }, { status: 201 });
}
