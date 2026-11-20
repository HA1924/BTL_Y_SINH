"use client";
import { useEffect, useRef, useState } from "react";
import { Badge, card } from "./ui";

const WINDOW_S = 6; // độ rộng cửa sổ hiển thị
const DELAY_S = 1.5; // phát lại trễ để bù gói đến không đều
const LINE = "#22c55e"; // xanh lá như sóng trên LCD và thẻ ECG của template

/**
 * Sóng mạch PPG trực tiếp. Thiết bị gửi gói ~25 mẫu mỗi giây; trang hỏi /api/wave mỗi giây
 * rồi phát lại đều theo tần số lấy mẫu để đường chạy mượt (giống màn hình trên mạch).
 */
export function PpgWave() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let alive = true;
    let fs = 25;
    const buf: number[] = [];
    let base = 0; // seq của buf[0]
    let last = -1; // seq mới nhất đã nhận
    let head = -1; // vị trí phát (seq, có phần lẻ để cuộn mượt)
    let lo = -1, hi = 1; // thang dọc tự co giãn
    let prev = performance.now();

    const poll = async () => {
      try {
        const res = await fetch(`/api/wave?after=${last}`, { cache: "no-store" });
        if (res.status === 401) return void (location.href = "/login");
        const d: { fs: number; seq: number; live: boolean; samples: number[] } = await res.json();
        if (!alive) return;
        setLive(d.live);
        fs = d.fs;
        const first = d.seq - d.samples.length + 1;
        if (d.samples.length) {
          if (first !== last + 1) {
            buf.length = 0; // đứt quãng: bắt đầu lại
            base = first;
            head = -1;
          }
          buf.push(...d.samples);
          last = d.seq;
          const extra = buf.length - fs * 20;
          if (extra > 0) {
            buf.splice(0, extra);
            base += extra;
          }
        }
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 1000);

    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const c = canvas.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const W = c.clientWidth, H = c.clientHeight;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      }
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Lưới mờ
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= W; x += W / WINDOW_S) {
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, H);
        ctx.stroke();
      }
      for (let y = 0; y <= H; y += H / 4) {
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(W, Math.round(y) + 0.5);
        ctx.stroke();
      }

      const dt = Math.min(now - prev, 200);
      prev = now;
      if (last < 0) return;

      // Tiến đầu phát theo thời gian thực, kéo nhẹ về đích trễ DELAY_S để không trôi
      const target = last - fs * DELAY_S;
      if (head < 0 || Math.abs(head - target) > fs * 3) head = Math.max(base, target);
      const catchUp = Math.max(-0.2, Math.min(0.2, (target - head) / (fs * 5)));
      head = Math.min(last, head + (dt / 1000) * fs * (1 + catchUp));

      const span = fs * WINDOW_S;
      const start = head - span;
      const i0 = Math.max(base, Math.ceil(start)), i1 = Math.min(last, Math.floor(head));
      if (i1 - i0 < 2) return;

      let mn = Infinity, mx = -Infinity;
      for (let i = i0; i <= i1; i++) {
        const v = buf[i - base];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      const pad = (mx - mn) * 0.15 + 1;
      lo += (mn - pad - lo) * 0.05;
      hi += (mx + pad - hi) * 0.05;

      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = i0; i <= i1; i++) {
        const x = ((i - start) / span) * W;
        const y = H - ((buf[i - base] - lo) / (hi - lo)) * H;
        if (i === i0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);

    return () => {
      alive = false;
      clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className={`${card} p-4 sm:p-5`}>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white" aria-hidden>
          〰
        </span>
        <h2 className="flex-1 font-bold text-slate-900">Sóng mạch (PPG)</h2>
        {live ? <Badge tone="green">Trực tiếp</Badge> : <Badge tone="gray">Không có tín hiệu</Badge>}
      </div>
      <div className="relative rounded-2xl bg-navy-950 p-3">
        <canvas ref={canvas} className="block h-36 w-full sm:h-44" role="img" aria-label="Sóng mạch PPG trực tiếp từ thiết bị" />
        {!live && (
          <p className="absolute inset-0 grid place-items-center px-4 text-center text-sm font-semibold text-slate-400">
            Chưa có sóng: chưa đặt ngón tay hoặc thiết bị ngoại tuyến
          </p>
        )}
      </div>
    </section>
  );
}
