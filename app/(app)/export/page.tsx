"use client";
import { useState } from "react";
import { todayVN } from "@/lib/format";
import { PageTitle, card } from "@/components/ui";

export default function ExportPage() {
  const [from, setFrom] = useState(() => todayVN(-6));
  const [to, setTo] = useState(() => todayVN());
  const [msg, setMsg] = useState<{ err: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    const days = (Date.parse(to) - Date.parse(from)) / 86400_000 + 1;
    if (!from || !to) return setMsg({ err: true, text: "Chọn đủ hai ngày." });
    if (days < 1) return setMsg({ err: true, text: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." });
    if (days > 31) return setMsg({ err: true, text: "Khoảng tối đa 31 ngày." });
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/export?from=${from}&to=${to}`);
      if (res.status === 401) return void (location.href = "/login");
      if (!res.ok) return setMsg({ err: true, text: (await res.json()).error ?? "Lỗi xuất file" });
      const name = /filename="(.+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "spo2.xlsx";
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ err: false, text: `Đã tải ${name}` });
    } catch {
      setMsg({ err: true, text: "Không kết nối được máy chủ." });
    } finally {
      setBusy(false);
    }
  }

  const input = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800";
  return (
    <>
      <PageTitle title="Xuất dữ liệu" sub="Tải bản ghi và cảnh báo theo khoảng ngày (giờ Việt Nam)" />
      <div className={`${card} flex flex-wrap items-end gap-4 p-4 sm:p-5`}>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Từ ngày
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={input} />
        </label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          Đến ngày
          <input type="date" value={to} max={todayVN()} onChange={(e) => setTo(e.target.value)} className={input} />
        </label>
        <button
          onClick={download}
          disabled={busy}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-10px_rgba(47,107,255,0.8)] hover:bg-blue-600 disabled:opacity-60"
        >
          📄 {busy ? "Đang tạo file…" : "Tải Excel"}
        </button>
        {msg && (
          <p role="status" className={`basis-full text-sm font-semibold ${msg.err ? "text-rose-600" : "text-emerald-600"}`}>
            {msg.text}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        File gồm 2 sheet: “Du lieu” và “Canh bao”. Khoảng tối đa 31 ngày.
      </p>
    </>
  );
}
