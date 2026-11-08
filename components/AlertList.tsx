"use client";
import type { Alert } from "@/lib/store";
import { ALERT_LABEL, fmtVN } from "@/lib/format";
import { Badge, card } from "./ui";

const STYLE = {
  spo2_low: { icon: "🫁", border: "border-l-rose-500", bg: "from-rose-50/70", box: "bg-rose-100" },
  pr_abnormal: { icon: "❤️", border: "border-l-orange-500", bg: "from-orange-50/70", box: "bg-orange-100" },
  battery_low: { icon: "🔋", border: "border-l-amber-400", bg: "from-amber-50/70", box: "bg-amber-100" },
  offline: { icon: "📡", border: "border-l-slate-400", bg: "from-slate-100/70", box: "bg-slate-200" },
};

export function AlertList({ alerts, limit }: { alerts: Alert[] | undefined; limit?: number }) {
  if (!alerts) return <p className="text-sm text-slate-400">Đang tải…</p>;
  if (!alerts.length)
    return <p className={`${card} px-5 py-4 text-sm text-slate-500`}>Không có cảnh báo trong 24 giờ qua.</p>;
  return (
    <ul className="space-y-3">
      {alerts.slice(0, limit).map((a) => {
        const s = STYLE[a.type];
        return (
          <li
            key={a.type + a.start}
            className={`${card} flex items-start gap-4 border-l-4 bg-gradient-to-r to-white p-4 ${s.border} ${s.bg}`}
          >
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${s.box}`} aria-hidden>
              {s.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900">{ALERT_LABEL[a.type]}</p>
              <p className="text-sm text-slate-600">{a.value}</p>
              <p className="mt-1 text-xs text-slate-500">
                {fmtVN(a.start)} → {a.end ? fmtVN(a.end) : "nay"}
              </p>
            </div>
            {a.end ? <Badge tone="gray">Đã kết thúc</Badge> : <Badge tone="red">Đang diễn ra</Badge>}
          </li>
        );
      })}
    </ul>
  );
}
