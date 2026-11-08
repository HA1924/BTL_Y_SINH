import { Logo } from "@/components/ui";
import { Nav } from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-navy-950 text-white">
        <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
          <Logo h={40} />
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">Pulse Oximeter Monitor</p>
            <p className="hidden text-xs text-slate-400 sm:block">Đại học Giao thông Vận tải</p>
          </div>
          <form action="/api/auth/logout" method="post" className="ml-auto">
            <button
              className="flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
              aria-label="Đăng xuất"
            >
              <span aria-hidden>⎋</span>
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </form>
        </div>
      </header>
      <div className="lg:flex">
        <Nav />
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </>
  );
}
