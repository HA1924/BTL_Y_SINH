// npm run selftest — kiểm tra nhanh logic cảnh báo và chữ ký phiên.
import assert from "node:assert/strict";
import { computeAlerts, type Reading } from "../lib/store";
import { signToken, verifyToken } from "../lib/auth";
import { parseDayVN, fmtVN } from "../lib/format";
import { summarizeWindow } from "../lib/calibration";
import { pushWave, readWave } from "../lib/wave";

process.env.SESSION_SECRET = "selftest-secret-0123456789abcdef";
const T0 = Date.parse("2026-01-01T00:00:00Z");
const r = (s: number, o: Partial<Reading> = {}): Reading => ({
  device_id: "x", ts: new Date(T0 + s * 1000).toISOString(), pr: 80, spo2: 97,
  battery_v: 4, battery_pct: 80, signal_quality: 0.9, finger: true, ...o,
});

// SpO2 < 92 tại 0,5,10 (kéo dài đúng 10 s) -> chưa cảnh báo; thêm 15 s -> có
let a = computeAlerts([r(0, { spo2: 90 }), r(5, { spo2: 89 }), r(10, { spo2: 90 }), r(15)], T0 + 20_000);
assert.equal(a.filter((x) => x.type === "spo2_low").length, 0);
a = computeAlerts([0, 5, 10, 15].map((s) => r(s, { spo2: 88 + s / 5 })).concat(r(20)), T0 + 25_000);
assert.deepEqual(a.map((x) => [x.type, x.value]), [["spo2_low", "SpO₂ thấp nhất 88%"]]);

// finger=false cắt đoạn bất thường
a = computeAlerts([r(0, { pr: 130 }), r(5, { pr: 130 }), r(10, { finger: false }), r(15, { pr: 130 }), r(20, { pr: 130 })], T0 + 25_000);
assert.equal(a.length, 0);

// PR thấp kéo dài, đang diễn ra -> end null
a = computeAlerts([0, 5, 10, 15].map((s) => r(s, { pr: 45 })), T0 + 16_000);
assert.equal(a[0].type, "pr_abnormal");
assert.equal(a[0].end, null);

// Mất kết nối giữa hai bản ghi + đang mất kết nối
a = computeAlerts([r(0), r(60)], T0 + 120_000);
assert.deepEqual(a.map((x) => [x.type, x.end === null]), [["offline", true], ["offline", false]]);

// Pin < 20%
a = computeAlerts([r(0, { battery_pct: 19 })], T0 + 1000);
assert.equal(a[0].type, "battery_low");

// Phiên: ký/kiểm, sửa token, hết hạn
const tok = await signToken({ email: "a@b.c", exp: Date.now() + 1000 });
assert.equal((await verifyToken(tok))?.email, "a@b.c");
assert.equal(await verifyToken(tok.slice(0, -2) + "xx"), null);
assert.equal(await verifyToken(tok, Date.now() + 2000), null);

// Ngày giờ VN
assert.equal(parseDayVN("2026-02-30"), null);
assert.equal(parseDayVN("2026-03-01")?.toISOString(), "2026-02-28T17:00:00.000Z");
assert.equal(fmtVN("2026-02-28T17:00:05Z"), "01/03/2026 00:00:05");

// Hiệu chuẩn: chỉ cho lưu khi thiết bị trực tuyến, có ngón tay, đủ R, tín hiệu tốt và ổn định
const now = T0 + 15_000;
const ok = [5, 10, 15].map((s) => r(s, { r: 0.52, pi: 2 }));
let w = summarizeWindow(ok, now);
assert.equal(w.ready, true);
assert.equal(w.r, 0.52);
assert.equal(summarizeWindow(ok, now + 60_000).reason, "Thiết bị đang ngoại tuyến");
assert.equal(summarizeWindow([...ok.slice(0, 2), r(15, { finger: false })], now).ready, false);
assert.equal(summarizeWindow([5, 10, 15].map((s) => r(s)), now).ready, false); // firmware cũ, không có r
assert.equal(summarizeWindow([5, 10, 15].map((s) => r(s, { r: 0.5, signal_quality: 0.3 })), now).ready, false);
w = summarizeWindow([r(5, { r: 0.4 }), r(10, { r: 0.5 }), r(15, { r: 0.6 })], now); // dao động 40%
assert.equal(w.ready, false);
assert.match(w.reason!, /chưa ổn định/);

// Sóng PPG: đọc tiếp theo seq, đứt quãng thì trả 8 giây gần nhất, hết sóng sau 3 giây
pushWave(25, [1, 2, 3], 1000);
let wv = readWave(-1, 1000);
assert.equal(wv.live, true);
const s0 = wv.seq;
pushWave(25, [4, 5], 1500);
assert.deepEqual(readWave(s0, 1500).samples, [4, 5]);
assert.deepEqual(readWave(s0 + 2, 1500).samples, []);
assert.equal(readWave(s0, 5000).live, false);

console.log("selftest OK");
