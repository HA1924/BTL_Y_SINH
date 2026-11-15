"use client";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import type { Alert } from "@/lib/store";
import { ALERT_LABEL, VN_OFFSET_MS, fmtTimeVN, fmtVN } from "@/lib/format";
import { Logo, PageTitle, card } from "@/components/ui";

type Stat = { avg: number; min: number; max: number } | null;
type Report = {
  from: string;
  to: string;
  device_id: string | null;
  total: number;
  valid: number;
  pr: Stat;
  spo2: Stat;
  quality: number | null;
  alerts: Alert[];
  points: { t: number; pr: number; spo2: number }[];
};

// Giá trị cho <input type="datetime-local"> theo giờ Việt Nam
const localVN = (ms: number) => new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 16);
const fromLocalVN = (s: string) => new Date(`${s}:00+07:00`);
const vi = (n: number) => String(n).replace(".", ",");

export default function ReportPage() {
  const [from, setFrom] = useState(() => localVN(Date.now() - 15 * 60_000));
  const [to, setTo] = useState(() => localVN(Date.now()));
  const [who, setWho] = useState({ name: "", age: "", gender: "", note: "" });
  const [rep, setRep] = useState<Report | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function build() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(
        `/api/report?from=${encodeURIComponent(fromLocalVN(from).toISOString())}&to=${encodeURIComponent(fromLocalVN(to).toISOString())}`,
      );
      if (res.status === 401) return void (location.href = "/login");
      const d = await res.json();
      if (!res.ok) return setErr(d.error ?? "Không tạo được phiếu");
      setRep(d);
      setCode("PK-" + localVN(Date.now()).replace(/[-:]/g, "").replace("T", "-"));
    } catch {
      setErr("Không kết nối được máy chủ.");
    } finally {
      setBusy(false);
    }
  }

  const input = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800";
  const label = "grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500";
  const set = (k: keyof typeof who) => (e: React.ChangeEvent<HTMLInputElement>) => setWho({ ...who, [k]: e.target.value });

  return (
    <>
      <div className="print:hidden">
        <PageTitle title="Phiếu kết quả" sub="Tạo phiếu kết quả đo theo khoảng thời gian, in hoặc lưu thành PDF" />
        <div className={`${card} flex flex-wrap items-end gap-4 p-4 sm:p-5`}>
          <label className={label}>
            Từ
            <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
          </label>
          <label className={label}>
            Đến
            <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
          </label>
          <label className={label}>
            Họ tên người đo
            <input value={who.name} onChange={set("name")} className={input} />
          </label>
          <label className={label}>
            Tuổi
            <input value={who.age} onChange={set("age")} inputMode="numeric" className={`${input} w-20`} />
          </label>
          <label className={label}>
            Giới tính
            <select value={who.gender} onChange={(e) => setWho({ ...who, gender: e.target.value })} className={input}>
              <option value="">— Chọn —</option>
              <option>Nam</option>
              <option>Nữ</option>
              <option>Khác</option>
            </select>
          </label>
          <label className={`${label} min-w-48 flex-1`}>
            Ghi chú
            <input value={who.note} onChange={set("note")} className={input} />
          </label>
          <button
            onClick={build}
            disabled={busy}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {busy ? "Đang tạo…" : "Tạo phiếu"}
          </button>
          {rep && (
            <button
              onClick={() => window.print()}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
            >
              🖨 In phiếu / Lưu PDF
            </button>
          )}
          {err && <p role="alert" className="basis-full text-sm font-semibold text-rose-600">{err}</p>}
        </div>
        <p className="mb-4 mt-3 text-xs text-slate-500">
          Thông tin người đo chỉ in trên phiếu, không lưu lại. Trong hộp thoại in, chọn máy in “Lưu thành PDF”.
        </p>
      </div>

      {rep && (
        <div className="overflow-x-auto print:overflow-visible">
          <Sheet rep={rep} who={who} code={code} />
        </div>
      )}
    </>
  );
}

function Sheet({ rep, who, code }: { rep: Report; who: { name: string; age: string; gender: string; note: string }; code: string }) {
  const dots = "…………………………";
  const th = "border border-slate-400 bg-slate-100 px-2 py-1.5 text-left font-bold";
  const td = "border border-slate-400 px-2 py-1.5";
  const verdict = (inRange: boolean | null) => (inRange === null ? "—" : inRange ? "Trong ngưỡng" : "Có lúc ngoài ngưỡng");
  return (
    <article
      className="mx-auto w-[186mm] bg-white p-[8mm] text-[13px] leading-snug text-black shadow-lg print:w-auto print:p-0 print:shadow-none"
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      <header className="flex items-center gap-4 border-b-2 border-black pb-3">
        <Logo h={64} />
        <div className="flex-1">
          <p className="text-base font-extrabold uppercase">Trường Đại học Giao thông Vận tải</p>
          <p className="font-semibold">Đề tài: Pulse Oximeter Monitor</p>
          <p className="text-xs">Thiết bị đo SpO₂ và nhịp mạch dùng ESP32 + MAX30102</p>
        </div>
        <div className="text-right text-xs">
          <p>
            Mã phiếu: <b>{code}</b>
          </p>
          <p>Ngày in: {fmtVN(Date.now())}</p>
        </div>
      </header>

      <h1 className="my-4 text-center text-xl font-extrabold uppercase">Phiếu kết quả đo SpO₂ và nhịp mạch</h1>

      <section className="grid grid-cols-[2fr_1fr_1fr] gap-x-4 gap-y-1.5">
        <p>
          Họ tên người đo: <b>{who.name || dots}</b>
        </p>
        <p>
          Tuổi: <b>{who.age || "………"}</b>
        </p>
        <p>
          Giới tính: <b>{who.gender || "………"}</b>
        </p>
        <p>
          Thời gian đo: <b>{fmtVN(rep.from)}</b> – <b>{fmtVN(rep.to)}</b>
        </p>
        <p className="col-span-2">
          Thiết bị: <b>{rep.device_id ?? "—"}</b> · {rep.valid}/{rep.total} bản ghi hợp lệ
        </p>
      </section>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>Chỉ số</th>
            <th className={th}>Trung bình</th>
            <th className={th}>Thấp nhất – Cao nhất</th>
            <th className={th}>Khoảng tham chiếu</th>
            <th className={th}>Đánh giá</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={td}>SpO₂ (%)</td>
            <td className={`${td} font-bold`}>{rep.spo2 ? vi(rep.spo2.avg) : "—"}</td>
            <td className={td}>{rep.spo2 ? `${vi(rep.spo2.min)} – ${vi(rep.spo2.max)}` : "—"}</td>
            <td className={td}>≥ 92</td>
            <td className={td}>{verdict(rep.spo2 && rep.spo2.min >= 92)}</td>
          </tr>
          <tr>
            <td className={td}>Nhịp mạch (bpm)</td>
            <td className={`${td} font-bold`}>{rep.pr ? vi(rep.pr.avg) : "—"}</td>
            <td className={td}>{rep.pr ? `${rep.pr.min} – ${rep.pr.max}` : "—"}</td>
            <td className={td}>50 – 120</td>
            <td className={td}>{verdict(rep.pr && rep.pr.min >= 50 && rep.pr.max <= 120)}</td>
          </tr>
          <tr>
            <td className={td}>Chất lượng tín hiệu (%)</td>
            <td className={`${td} font-bold`}>{rep.quality !== null ? Math.round(rep.quality * 100) : "—"}</td>
            <td className={td}>—</td>
            <td className={td}>—</td>
            <td className={td}>—</td>
          </tr>
        </tbody>
      </table>
      {!rep.valid && <p className="mt-2 font-semibold">Không có bản ghi hợp lệ trong khoảng thời gian đã chọn.</p>}

      {rep.points.length > 1 && (
        <section className="mt-4 grid grid-cols-2 gap-4">
          <MiniChart points={rep.points} k="spo2" title="SpO₂ (%)" color="#2563eb" refs={[92]} from={rep.from} to={rep.to} />
          <MiniChart points={rep.points} k="pr" title="Nhịp mạch (bpm)" color="#e11d48" refs={[50, 120]} from={rep.from} to={rep.to} />
        </section>
      )}

      <section className="mt-4">
        <p className="font-bold">Cảnh báo trong thời gian đo:</p>
        {rep.alerts.length ? (
          <ul className="ml-5 list-disc">
            {rep.alerts.slice(0, 8).map((a) => (
              <li key={a.type + a.start}>
                {fmtTimeVN(a.start)} – {a.end ? fmtTimeVN(a.end) : "hết khoảng đo"}: {ALERT_LABEL[a.type]} ({a.value})
              </li>
            ))}
            {rep.alerts.length > 8 && <li>… và {rep.alerts.length - 8} cảnh báo khác</li>}
          </ul>
        ) : (
          <p>Không có.</p>
        )}
      </section>

      <p className="mt-3">
        <b>Ghi chú:</b> {who.note || `${dots}${dots}${dots}`}
      </p>

      <footer className="mt-8 flex justify-end">
        <div className="w-[110mm] text-center">
          <p className="font-bold uppercase">Sinh viên thực hiện</p>
          <div className="mt-16 grid grid-cols-2 font-semibold">
            <p>Dương Hoàng Anh</p>
            <p>Phạm Đức Hảo</p>
          </div>
        </div>
      </footer>
    </article>
  );
}

// Kích thước cố định để bản in không phụ thuộc việc co giãn theo cửa sổ.
function MiniChart(p: {
  points: Report["points"];
  k: "pr" | "spo2";
  title: string;
  color: string;
  refs: number[];
  from: string;
  to: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-xs font-bold">
        <span className="h-0.5 w-4" style={{ background: p.color }} />
        {p.title}
      </p>
      <LineChart width={300} height={150} data={p.points} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
        <CartesianGrid stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={[Date.parse(p.from), Date.parse(p.to)]}
          tickFormatter={(t) => fmtTimeVN(t).slice(0, 5)}
          tick={{ fill: "#334155", fontSize: 10 }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          domain={p.k === "pr" ? [(v: number) => Math.min(40, Math.floor(v / 10) * 10), (v: number) => Math.max(140, Math.ceil(v / 10) * 10)] : [(v: number) => Math.min(85, Math.floor(v)), 100]}
          tick={{ fill: "#334155", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        {p.refs.map((y) => (
          <ReferenceLine key={y} y={y} stroke="#64748b" strokeDasharray="4 4" />
        ))}
        <Line dataKey={p.k} stroke={p.color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </div>
  );
}
