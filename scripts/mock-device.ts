// Giả lập ESP32: npm run mock              -> gửi 1 bản ghi / 5 giây
//                npm run mock -- --backfill=7 -> sinh 7 ngày dữ liệu quá khứ rồi thoát
//                thêm --url=http://192.168.1.10:3000 để gửi tới máy khác
process.loadEnvFile(".env.local");

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const BASE = arg("url") ?? "http://localhost:3000";
const KEY = process.env.DEVICE_KEY ?? "";
const STEP_MS = 5_000;

type Reading = {
  device_id: string;
  ts: string;
  pr: number;
  spo2: number;
  battery_v: number;
  battery_pct: number;
  signal_quality: number;
  finger: boolean;
};

const jitter = (n: number) => (Math.random() - 0.5) * 2 * n;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Kịch bản theo số thứ tự bản ghi (chu kỳ 24 bản ghi = 2 phút):
 *  0–9 bình thường · 10–15 SpO₂ < 92% (30 s) · 16–17 bỏ ngón tay · 18–23 PR > 120 (30 s)
 */
function make(i: number, ms: number, batteryPct: number): Reading {
  const phase = i % 24;
  const finger = !(phase === 16 || phase === 17);
  let pr = 78 + jitter(6), spo2 = 97.5 + jitter(1.2);
  if (phase >= 10 && phase <= 15) spo2 = 88 + jitter(1.5);
  if (phase >= 18) pr = 132 + jitter(6);
  return {
    device_id: "esp32-mock",
    ts: new Date(ms).toISOString(),
    pr: finger ? Math.round(pr) : 0,
    spo2: finger ? round1(Math.min(100, spo2)) : 0,
    battery_v: round1(3.3 + (batteryPct / 100) * 0.9) ,
    battery_pct: Math.max(0, Math.round(batteryPct)),
    signal_quality: finger ? round1(0.75 + jitter(0.2)) : 0,
    finger,
  };
}

async function send(r: Reading) {
  const res = await fetch(`${BASE}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Device-Key": KEY },
    body: JSON.stringify(r),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

async function backfill(days: number) {
  const end = Date.now() - 60_000;
  const start = end - days * 86400_000;
  const total = Math.floor((end - start) / STEP_MS);
  console.log(`Backfill ${days} ngày = ${total} bản ghi tới ${BASE} ...`);
  const items: Reading[] = [];
  for (let i = 0; i < total; i++) {
    const ms = start + i * STEP_MS;
    const hourVN = (new Date(ms).getUTCHours() + 7) % 24;
    if (hourVN === 3 && new Date(ms).getUTCMinutes() < 10) continue; // mỗi ngày mất kết nối 10 phút lúc 03:00
    // Mỗi 6 giờ sạc đầy, xả dần -> có đoạn pin < 20%
    const battery = 100 - ((ms / 3600_000) % 6) * 15;
    // Phần lớn thời gian bình thường; ~5% chu kỳ dùng kịch bản bất thường
    const abnormal = Math.floor(i / 24) % 20 === 0;
    items.push(make(abnormal ? i : i % 10, ms, battery));
  }
  // Gửi theo thứ tự thời gian, 32 request song song mỗi đợt
  for (let k = 0; k < items.length; k += 32) {
    await Promise.all(items.slice(k, k + 32).map(send));
    if (k % 6400 === 0) process.stdout.write(`\r${Math.round((k / items.length) * 100)}%`);
  }
  console.log(`\rXong: ${items.length} bản ghi.`);
}

async function live() {
  console.log(`Gửi 1 bản ghi / 5 giây tới ${BASE}/api/ingest (Ctrl+C để dừng)`);
  let i = 0, battery = 26; // bắt đầu gần ngưỡng để thấy cảnh báo pin yếu sau ~3 phút
  const tick = async () => {
    const r = make(i++, Date.now(), battery);
    battery = battery <= 5 ? 100 : battery - 0.15;
    try {
      await send(r);
      console.log(`${r.ts}  PR=${r.pr}  SpO2=${r.spo2}  pin=${r.battery_pct}%  finger=${r.finger}`);
    } catch (e) {
      console.error("Lỗi gửi:", (e as Error).message);
    }
  };
  await tick();
  setInterval(tick, STEP_MS);
}

const days = Number(arg("backfill"));
(days > 0 ? backfill(days) : live()).catch((e) => {
  console.error(e);
  process.exit(1);
});
