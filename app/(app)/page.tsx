"use client";
import Link from "next/link";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Alert, Reading } from "@/lib/store";
import { fmtTimeVN, fmtVN } from "@/lib/format";
import { AlertList } from "@/components/AlertList";
import { Badge, PageTitle, SectionLabel, card, usePoll } from "@/components/ui";

type Point = { t: number; pr: number | null; spo2: number | null };
const PR_COLOR = "#f43f5e"; // validated vs navy surface (dataviz validator)
const SPO2_COLOR = "#3b82f6";

export default function Dashboard() {
  const latest = usePoll<{ reading: Reading | null; online: boolean }>("/api/latest");
  const [range, setRange] = useState<"1h" | "24h">("1h");
  const series = usePoll<{ points: Point[] }>(`/api/readings?range=${range}`);
  const alerts = usePoll<{ alerts: Alert[] }>("/api/alerts");
  const r = latest?.reading ?? null;
  const noFinger = !!r && !r.finger;

  return (
    <>
      <PageTitle
        title="Theo dõi"
        sub="Chỉ số trực tiếp từ thiết bị"
        right={
          <div className="text-right text-xs text-slate-500">
            Cập nhật lúc
            <p className="text-sm font-bold text-slate-900">{r ? fmtTimeVN(r.ts) : "--"}</p>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-[20px] bg-navy-950 p-3 text-sm font-bold text-white">
        {latest?.online ? (
          <span className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-400" /> TRỰC TUYẾN
          </span>
        ) : (
          <span className="flex items-center gap-2 rounded-full border border-slate-500/30 bg-white/5 px-3 py-1.5 text-slate-300">
            <span className="size-2 rounded-full bg-slate-400" /> NGOẠI TUYẾN
          </span>
        )}
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
          📟 {r?.device_id ?? "Chưa có thiết bị"}
        </span>
      </div>

      <SectionLabel>Chỉ số hiện tại</SectionLabel>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_minmax(260px,0.8fr)]">
        <VitalCard
          icon="❤"
          iconBg="bg-rose-600"
          label="Nhịp mạch (PR)"
          value={r?.pr}
          unit="bpm"
          valueColor="text-rose-700"
          bar="bg-rose-500"
          pct={r ? (r.pr - 30) / 190 : 0}
          normal="Ngưỡng bình thường: 50 – 120 bpm"
          ok={!!r && r.pr >= 50 && r.pr <= 120}
          noFinger={noFinger}
          empty={!r}
        />
        <VitalCard
          icon="O₂"
          iconBg="bg-blue-600"
          label="Độ bão hòa oxy (SpO₂)"
          value={r?.spo2}
          unit="%"
          valueColor="text-blue-700"
          bar="bg-blue-500"
          pct={r ? (r.spo2 - 70) / 30 : 0}
          normal="Ngưỡng bình thường: ≥ 92%"
          ok={!!r && r.spo2 >= 92}
          noFinger={noFinger}
          empty={!r}
        />
        <div className="grid gap-4">
          <SmallCard
            icon="🔋"
            tint="from-orange-50 border-orange-100"
            iconBg="bg-orange-500"
            label="Pin"
            value={r ? `${Math.round(r.battery_pct)}` : "--"}
            unit={r ? `% · ${r.battery_v.toFixed(2)} V` : ""}
            badge={!r ? null : r.battery_pct < 20 ? <Badge tone="red">Pin yếu</Badge> : <Badge tone="green">Ổn định</Badge>}
          />
          <SmallCard
            icon="📶"
            tint="from-emerald-50 border-emerald-100"
            iconBg="bg-emerald-600"
            label="Chất lượng tín hiệu"
            value={r ? `${Math.round(r.signal_quality * 100)}` : "--"}
            unit={r ? "%" : ""}
            badge={
              !r ? null : r.signal_quality >= 0.7 ? (
                <Badge tone="green">Tốt</Badge>
              ) : r.signal_quality >= 0.4 ? (
                <Badge tone="amber">Trung bình</Badge>
              ) : (
                <Badge tone="red">Kém</Badge>
              )
            }
          />
        </div>
      </div>

      <SectionLabel>Biểu đồ</SectionLabel>
      <section className={`${card} p-4 sm:p-5`}>
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white" aria-hidden>
            〰
          </span>
          <h2 className="flex-1 font-bold text-slate-900">PR và SpO₂</h2>
          <div className="flex rounded-full bg-blue-50 p-1 text-xs font-bold">
            {(["1h", "24h"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setRange(k)}
                className={`rounded-full px-3 py-1 ${range === k ? "bg-brand text-white" : "text-blue-600"}`}
              >
                {k === "1h" ? "1 giờ" : "24 giờ"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2 rounded-2xl bg-navy-950 p-3 sm:p-4">
          <Chart points={series?.points} k="pr" color={PR_COLOR} title="PR (bpm)" unit="bpm" refs={[50, 120]} range={range} />
          <Chart points={series?.points} k="spo2" color={SPO2_COLOR} title="SpO₂ (%)" unit="%" refs={[92]} range={range} />
        </div>
      </section>

      <SectionLabel>Cảnh báo gần đây</SectionLabel>
      <AlertList alerts={alerts?.alerts} limit={3} />
      <Link href="/alerts" className="mt-3 inline-block text-sm font-semibold text-brand">
        Xem tất cả cảnh báo →
      </Link>
    </>
  );
}

function VitalCard(p: {
  icon: string;
  iconBg: string;
  label: string;
  value: number | undefined;
  unit: string;
  valueColor: string;
  bar: string;
  pct: number;
  normal: string;
  ok: boolean;
  noFinger: boolean;
  empty: boolean;
}) {
  return (
    <div className={`${card} flex items-center gap-5 p-5 sm:p-6 lg:min-h-64`}>
      <span className={`grid size-16 shrink-0 place-items-center rounded-2xl text-2xl font-extrabold text-white sm:size-20 ${p.iconBg}`} aria-hidden>
        {p.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-600">{p.label}</p>
          {!p.empty && !p.noFinger && (p.ok ? <Badge tone="green">Bình thường</Badge> : <Badge tone="red">Ngoài ngưỡng</Badge>)}
        </div>
        {p.noFinger ? (
          <p className="my-3 text-xl font-bold text-slate-500">Chưa đặt ngón tay</p>
        ) : (
          <p className={`text-5xl font-extrabold tracking-tight ${p.valueColor}`}>
            {p.empty ? "--" : p.value}
            <span className="ml-1 text-base font-semibold text-slate-400">{p.unit}</span>
          </p>
        )}
        <p className="text-xs text-slate-500">{p.normal}</p>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${p.bar} transition-[width]`}
            style={{ width: `${p.noFinger ? 0 : Math.max(0, Math.min(1, p.pct)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SmallCard(p: { icon: string; tint: string; iconBg: string; label: string; value: string; unit: string; badge: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-4 rounded-[20px] border bg-gradient-to-br to-white p-5 ${p.tint}`}>
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl text-xl ${p.iconBg}`} aria-hidden>
        {p.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-600">{p.label}</p>
          {p.badge}
        </div>
        <p className="text-3xl font-extrabold text-slate-900">
          {p.value}
          <span className="ml-1 text-sm font-semibold text-slate-400">{p.unit}</span>
        </p>
      </div>
    </div>
  );
}

function Chart(p: {
  points: Point[] | undefined;
  k: "pr" | "spo2";
  color: string;
  title: string;
  unit: string;
  refs: number[];
  range: "1h" | "24h";
}) {
  const now = Date.now();
  const span = p.range === "1h" ? 3600_000 : 86400_000;
  const domain: [number | ((v: number) => number), number | ((v: number) => number)] =
    p.k === "pr"
      ? [(v) => Math.min(40, Math.floor(v / 10) * 10), (v) => Math.max(140, Math.ceil(v / 10) * 10)]
      : [(v) => Math.min(85, Math.floor(v)), 100];
  return (
    <div>
      <p className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-300">
        <span className="h-0.5 w-4 rounded" style={{ background: p.color }} />
        {p.title}
      </p>
      <div className="h-40 sm:h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={p.points ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[now - span, now]}
              tickFormatter={(t) => fmtTimeVN(t).slice(0, 5)}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis domain={domain} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            {p.refs.map((y) => (
              <ReferenceLine key={y} y={y} stroke="rgba(148,163,184,0.5)" strokeDasharray="4 4" />
            ))}
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.35)" }}
              contentStyle={{ background: "#111a33", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e2e8f0" }}
              labelStyle={{ color: "#94a3b8" }}
              labelFormatter={(t) => fmtVN(Number(t))}
              formatter={(v) => [`${v} ${p.unit}`, p.title]}
            />
            <Line
              dataKey={p.k}
              stroke={p.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "#0b1224", strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
