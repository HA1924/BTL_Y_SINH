import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const font = Plus_Jakarta_Sans({ subsets: ["latin", "vietnamese"], variable: "--font-jakarta" });

export const metadata: Metadata = { title: "Pulse Oximeter Monitor" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="min-h-dvh pb-10 font-sans antialiased">
        {children}
        <p className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 px-4 py-2 text-center text-xs text-slate-500 backdrop-blur">
          Thiết bị phục vụ học tập, không dùng để chẩn đoán y tế.
        </p>
      </body>
    </html>
  );
}
