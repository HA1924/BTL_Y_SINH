import { NextResponse, type NextRequest } from "next/server";
import { auth } from "./lib/auth";

const PUBLIC = ["/login", "/api/auth/login", "/api/ingest"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await auth.readSession(req.cookies);

  if (PUBLIC.includes(pathname)) {
    // Đã đăng nhập mà vào /login thì về dashboard
    return session && pathname === "/login" ? NextResponse.redirect(new URL("/", req.url)) : NextResponse.next();
  }
  // Thiết bị gửi sóng PPG bằng X-Device-Key (route tự kiểm tra); xem sóng thì cần đăng nhập.
  if (pathname === "/api/wave" && req.method === "POST") return NextResponse.next();
  if (session) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  // Mọi thứ trừ asset build và file tĩnh trong public/ (logo, favicon)
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|logo\\.(?:png|jpg)).*)"],
};
