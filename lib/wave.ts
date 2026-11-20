// Sóng PPG trực tiếp: chỉ giữ ~20 giây gần nhất trong RAM, không ghi file (dữ liệu rất dày, chỉ để xem).
// ponytail: nằm ngoài interface Store; khi lên Vercel cần kênh realtime (vd. Supabase Realtime) thay cho RAM.

const KEEP_S = 20;
export const WAVE_LIVE_MS = 3_000; // không có gói mới trong 3 giây => coi như không có sóng

type Wave = { fs: number; seq: number; samples: number[]; lastAt: number };
const g = globalThis as unknown as { __wave?: Wave };
const w = (g.__wave ??= { fs: 25, seq: 0, samples: [], lastAt: 0 });

/** seq = số thứ tự của mẫu cuối cùng (tăng dần, không reset). */
export function pushWave(fs: number, s: number[], now = Date.now()) {
  if (fs !== w.fs) w.samples = [];
  w.fs = fs;
  w.samples.push(...s);
  w.seq += s.length;
  if (w.samples.length > fs * KEEP_S) w.samples.splice(0, w.samples.length - fs * KEEP_S);
  w.lastAt = now;
}

/** Các mẫu có seq > after (hoặc 8 giây gần nhất nếu after quá cũ / không có). */
export function readWave(after: number, now = Date.now()) {
  const live = now - w.lastAt <= WAVE_LIVE_MS;
  const firstSeq = w.seq - w.samples.length + 1;
  const from = after >= firstSeq - 1 && after <= w.seq ? after + 1 : Math.max(firstSeq, w.seq - w.fs * 8 + 1);
  return { fs: w.fs, seq: w.seq, live, samples: w.samples.slice(from - firstSeq) };
}
