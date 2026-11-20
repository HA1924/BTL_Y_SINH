import { safeEqual } from "@/lib/auth";
import { pushWave, readWave } from "@/lib/wave";

// POST (thiết bị, X-Device-Key): { device_id, fs, s: number[] } mỗi giây. Trả 204.
export async function POST(req: Request) {
  const key = process.env.DEVICE_KEY;
  if (!key || !(await safeEqual(req.headers.get("x-device-key") ?? "", key))) {
    return Response.json({ error: "Sai khóa thiết bị" }, { status: 401 });
  }
  const b = await req.json().catch(() => null);
  const fs = b?.fs, s = b?.s;
  if (!Number.isInteger(fs) || fs < 10 || fs > 100) return Response.json({ error: "fs phải là số nguyên 10–100" }, { status: 400 });
  if (!Array.isArray(s) || s.length < 1 || s.length > 200 || !s.every((v) => Number.isFinite(v) && Math.abs(v) <= 100_000)) {
    return Response.json({ error: "s phải là mảng 1–200 số" }, { status: 400 });
  }
  pushWave(fs, s);
  return new Response(null, { status: 204 });
}

// GET (đã đăng nhập): ?after=<seq> trả các mẫu mới hơn seq đó.
export async function GET(req: Request) {
  const after = Number(new URL(req.url).searchParams.get("after") ?? -1);
  return Response.json(readWave(Number.isFinite(after) ? after : -1));
}
