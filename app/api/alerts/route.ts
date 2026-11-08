import { store } from "@/lib/store";

// Cảnh báo trong 24 giờ gần nhất (dùng cho dashboard và trang /alerts).
export async function GET() {
  const now = Date.now();
  return Response.json({ alerts: await store.getAlerts(new Date(now - 86400_000), new Date(now)) });
}
