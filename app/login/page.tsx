"use client";
import { useState } from "react";
import { Logo } from "@/components/ui";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: f.get("email"), password: f.get("password") }),
      });
      if (res.ok) return void location.replace("/");
      setError((await res.json().catch(() => null))?.error ?? "Đăng nhập thất bại");
    } catch {
      setError("Không kết nối được máy chủ");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
  const label = "grid gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500";

  return (
    <main className="grid min-h-[calc(100dvh-2.5rem)] lg:grid-cols-2">
      <section className="flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-navy-950 to-navy-900 px-6 py-10 text-center text-white">
        <Logo h={80} />
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Đại học Giao thông Vận tải</p>
        <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl">Pulse Oximeter Monitor</h1>
        <p className="max-w-sm text-sm text-slate-400">Theo dõi SpO₂ và nhịp mạch từ thiết bị ESP32 + MAX30102</p>
      </section>
      <section className="flex items-center justify-center px-4 py-10">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm space-y-4 rounded-[20px] bg-white p-6 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] sm:p-8"
        >
          <h2 className="text-xl font-extrabold text-slate-900">Đăng nhập</h2>
          <label className={label}>
            Email
            <input name="email" type="email" required autoComplete="username" className={input} />
          </label>
          <label className={label}>
            Mật khẩu
            <input name="password" type="password" required autoComplete="current-password" className={input} />
          </label>
          {error && (
            <p role="alert" className="rounded-xl border-l-4 border-rose-500 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-10px_rgba(47,107,255,0.8)] hover:bg-blue-600 disabled:opacity-60"
          >
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
      </section>
    </main>
  );
}
