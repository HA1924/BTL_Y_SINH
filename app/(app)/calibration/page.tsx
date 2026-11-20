"use client";
import { useState } from "react";
import type { CalPoint } from "@/lib/store";
import type { Window } from "@/lib/calibration";
import { fmtVN } from "@/lib/format";
import { Badge, PageTitle, SectionLabel, card, usePoll } from "@/components/ui";

const TARGET_POINTS = 100;
const TARGET_PEOPLE = 8;

export default function CalibrationPage() {
  // Poll 2 giây để thấy ngay khi số đo đã ổn định
  const data = usePoll<{ points: CalPoint[]; window: Window }>("/api/calibration", 2000);
  const [extra, setExtra] = useState<{ added: CalPoint[]; removed: Set<string> }>({ added: [], removed: new Set() });
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");
  const [refSpo2, setRefSpo2] = useState("");
  const [refPr, setRefPr] = useState("");
  const [msg, setMsg] = useState<{ err: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Gộp danh sách từ server với thay đổi vừa làm (để không phải chờ lần poll sau)
  const server = data?.points ?? [];
  const ids = new Set(server.map((p) => p.id));
  const points = [...server, ...extra.added.filter((p) => !ids.has(p.id))].filter((p) => !extra.removed.has(p.id));
  const people = new Set(points.map((p) => p.subject.toLowerCase())).size;
  const w = data?.window;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/calibration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          note,
          ref_spo2: Number(refSpo2),
          ref_pr: refPr ? Number(refPr) : null,
        }),
      });
      if (res.status === 401) return void (location.href = "/login");
      const d = await res.json();
      if (!res.ok) return setMsg({ err: true, text: d.error ?? "Không lưu được" });
      setExtra((x) => ({ ...x, added: [...x.added, d.point] }));
      setRefSpo2("");
      setRefPr("");
      setMsg({ err: false, text: `Đã lưu điểm #${d.count}: SpO₂ tham chiếu ${d.point.ref_spo2}%, R = ${d.point.r}` });
    } catch {
      setMsg({ err: true, text: "Không kết nối được máy chủ." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: CalPoint) {
    if (!confirm(`Xóa điểm lúc ${fmtVN(p.ts)} (${p.subject}, SpO₂ ${p.ref_spo2}%)?`)) return;
    const res = await fetch(`/api/calibration?id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
    if (res.ok || res.status === 404) setExtra((x) => ({ ...x, removed: new Set(x.removed).add(p.id) }));
  }

  const input = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold text-slate-800";
  const label = "grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500";

  return (
    <>
      <PageTitle
        title="Hiệu chuẩn SpO₂"
        sub="Ghép số của máy đo tham chiếu với tỉ số R của thiết bị để huấn luyện hồi quy tuyến tính"
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Trạng thái số đo hiện tại */}
        <section className={`${card} p-5`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-bold text-slate-900">
              Thiết bị của nhóm (ESP32)
              <span className="block text-xs font-medium text-slate-500">Tự cập nhật qua WiFi · trung bình 15 giây gần nhất</span>
            </h2>
            {!w ? <Badge tone="gray">Đang tải</Badge> : w.ready ? <Badge tone="green">Sẵn sàng lưu</Badge> : <Badge tone="amber">Chưa sẵn sàng</Badge>}
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="R" value={w?.r ?? "--"} />
            <Stat label="SpO₂ thiết bị" value={w?.spo2 != null ? `${w.spo2}%` : "--"} />
            <Stat label="PR thiết bị" value={w?.pr ?? "--"} />
            <Stat label="Chất lượng" value={w?.quality != null ? `${Math.round(w.quality * 100)}%` : "--"} />
          </dl>
          {w?.reason && <p className="mt-3 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{w.reason}</p>}
          <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Kẹp máy tham chiếu và cảm biến của nhóm vào hai ngón cạnh nhau, cùng một tay.</li>
            <li>Ngồi yên, tay đặt trên bàn, chờ đến khi hiện “Sẵn sàng lưu”.</li>
            <li>Nhập số đang hiện trên máy tham chiếu rồi bấm Lưu. Chờ khoảng 20 giây trước điểm tiếp theo.</li>
          </ol>
        </section>

        {/* Nhập số tham chiếu */}
        <form onSubmit={save} className={`${card} grid gap-4 p-5 sm:grid-cols-2`}>
          <h2 className="font-bold text-slate-900 sm:col-span-2">
            Máy đo tham chiếu (mua sẵn)
            <span className="block text-xs font-medium text-slate-500">Đọc số trên màn hình máy rồi nhập vào đây</span>
          </h2>
          <label className={label}>
            Mã người đo *
            <input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={32} placeholder="VD: N01" className={input} />
          </label>
          <label className={label}>
            Ghi chú
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={64} placeholder="VD: trỏ phải, tay lạnh" className={input} />
          </label>
          <label className={label}>
            SpO₂ máy tham chiếu (%) *
            <input
              value={refSpo2}
              onChange={(e) => setRefSpo2(e.target.value)}
              required
              type="number"
              inputMode="numeric"
              min={70}
              max={100}
              step={1}
              className={`${input} text-2xl`}
            />
          </label>
          <label className={label}>
            PR máy tham chiếu (bpm)
            <input
              value={refPr}
              onChange={(e) => setRefPr(e.target.value)}
              type="number"
              inputMode="numeric"
              min={30}
              max={220}
              step={1}
              className={`${input} text-2xl`}
            />
          </label>
          <button
            disabled={busy || !w?.ready}
            className="rounded-xl bg-brand py-3 text-base font-bold text-white shadow-[0_8px_24px_-10px_rgba(47,107,255,0.8)] hover:bg-blue-600 disabled:opacity-50 sm:col-span-2"
          >
            {busy ? "Đang lưu…" : "Lưu điểm"}
          </button>
          {msg && (
            <p role="status" className={`text-sm font-semibold sm:col-span-2 ${msg.err ? "text-rose-600" : "text-emerald-600"}`}>
              {msg.text}
            </p>
          )}
        </form>
      </div>

      <SectionLabel>Dữ liệu đã thu</SectionLabel>
      <div className={`${card} p-5`}>
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Progress label="Số điểm" value={points.length} target={TARGET_POINTS} />
          <Progress label="Số người" value={people} target={TARGET_PEOPLE} />
          <a
            href="/api/calibration?format=csv"
            className="ml-auto rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            📄 Tải CSV
          </a>
        </div>
        {points.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Thời gian</th>
                  <th className="pr-3">Người đo</th>
                  <th className="pr-3">Ghi chú</th>
                  <th className="pr-3 text-right">SpO₂ tham chiếu</th>
                  <th className="pr-3 text-right">R</th>
                  <th className="pr-3 text-right">SpO₂ thiết bị</th>
                  <th className="pr-3 text-right">PR tham chiếu / thiết bị</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {points
                  .slice()
                  .reverse()
                  .map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-600">{fmtVN(p.ts)}</td>
                      <td className="pr-3 font-semibold">{p.subject}</td>
                      <td className="pr-3 text-slate-600">{p.note}</td>
                      <td className="pr-3 text-right font-bold">{p.ref_spo2}</td>
                      <td className="pr-3 text-right tabular-nums">{p.r.toFixed(4)}</td>
                      <td className="pr-3 text-right">{p.dev_spo2}</td>
                      <td className="pr-3 text-right">
                        {p.ref_pr ?? "–"} / {p.dev_pr}
                      </td>
                      <td className="text-right">
                        <button onClick={() => remove(p)} className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Chưa có điểm nào.</p>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-xl font-extrabold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function Progress({ label, value, target }: { label: string; value: number; target: number }) {
  return (
    <div className="min-w-40">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}: <span className="text-slate-900">{value}</span> / {target}
      </p>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
      </div>
    </div>
  );
}
