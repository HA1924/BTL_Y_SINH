import { store } from "@/lib/store";

type Point = { t: number; pr: number | null; spo2: number | null };

export async function GET(req: Request) {
  const range = new URL(req.url).searchParams.get("range");
  if (range !== "1h" && range !== "24h") return Response.json({ error: "range phải là 1h hoặc 24h" }, { status: 400 });

  const now = Date.now();
  const rows = await store.getRange(new Date(now - (range === "1h" ? 3600_000 : 86400_000)), new Date(now));

  // 1h: raw points (~720). 24h: 1-minute averages (~1440) so polling stays light.
  // finger=false -> null so the line breaks instead of dropping to 0.
  const bucket = range === "1h" ? 5_000 : 60_000;
  const map = new Map<number, { pr: number; spo2: number; n: number }>();
  for (const r of rows) {
    const k = Math.floor(Date.parse(r.ts) / bucket) * bucket;
    const m = map.get(k) ?? { pr: 0, spo2: 0, n: 0 };
    if (r.finger) {
      m.pr += r.pr;
      m.spo2 += r.spo2;
      m.n++;
    }
    map.set(k, m);
  }
  const points: Point[] = [...map].map(([t, m]) => ({
    t,
    pr: m.n ? Math.round(m.pr / m.n) : null,
    spo2: m.n ? Math.round((m.spo2 / m.n) * 10) / 10 : null,
  }));
  return Response.json({ points });
}
