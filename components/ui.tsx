"use client";
import Image from "next/image";
import { useEffect, useState } from "react";

/** School logo, original file untouched, in a white rounded frame (logo has a white background). */
export function Logo({ h }: { h: number }) {
  return (
    <span className="inline-flex shrink-0 rounded-[10px] bg-white p-1 shadow-sm">
      <Image
        src="/logo.jpg"
        alt="Đại học Giao thông Vận tải"
        width={800}
        height={566}
        unoptimized // serve the original file: no recompression, stays sharp at 2x/3x
        style={{ height: h, width: "auto" }}
      />
    </span>
  );
}

/** Fetch JSON now and every `ms`; on 401 go to /login. */
export function usePoll<T>(url: string, ms = 5000) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      fetch(url, { cache: "no-store" })
        .then((r) => {
          if (r.status === 401) location.href = "/login";
          return r.ok ? r.json() : null;
        })
        .then((d) => alive && d && setData(d))
        .catch(() => {});
    tick();
    const id = setInterval(tick, ms);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, ms]);
  return data;
}

export function PageTitle({ title, sub, right }: { title: string; sub: string; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{sub}</p>
      </div>
      {right}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
      <span className="size-2 rounded-full bg-emerald-500" />
      {children}
    </p>
  );
}

const TONE = {
  green: "bg-emerald-50 text-emerald-600",
  red: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-700",
  gray: "bg-slate-100 text-slate-500",
  blue: "bg-blue-50 text-blue-600",
};
export function Badge({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${TONE[tone]}`}>
      {children}
    </span>
  );
}

export const card = "rounded-[20px] border border-white bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]";
