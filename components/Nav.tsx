"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Theo dõi", icon: "❤️" },
  { href: "/alerts", label: "Cảnh báo", icon: "🚨" },
  { href: "/export", label: "Xuất dữ liệu", icon: "📊" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="bg-navy-950 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] lg:w-64 lg:shrink-0 lg:bg-gradient-to-b lg:from-navy-950 lg:to-navy-900">
      <p className="hidden px-6 pb-2 pt-6 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 lg:block">Theo dõi</p>
      <ul className="flex gap-2 overflow-x-auto px-4 pb-3 pt-1 lg:flex-col lg:px-4 lg:py-0">
        {ITEMS.map((it) => {
          const active = path === it.href;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`flex items-center gap-3 whitespace-nowrap rounded-[14px] px-3 py-2 text-sm font-semibold lg:py-3 lg:text-base ${
                  active ? "bg-brand text-white shadow-[0_8px_24px_-8px_rgba(47,107,255,0.7)]" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <span className="grid size-7 place-items-center rounded-lg bg-white/10 text-sm lg:size-9" aria-hidden>
                  {it.icon}
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
