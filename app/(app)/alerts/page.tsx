"use client";
import type { Alert } from "@/lib/store";
import { AlertList } from "@/components/AlertList";
import { PageTitle, usePoll } from "@/components/ui";

export default function AlertsPage() {
  const data = usePoll<{ alerts: Alert[] }>("/api/alerts");
  return (
    <>
      <PageTitle
        title="Cảnh báo"
        sub="24 giờ gần nhất · SpO₂ < 92% hoặc PR ngoài 50–120 bpm kéo dài trên 10 giây, pin < 20%, mất kết nối"
      />
      <AlertList alerts={data?.alerts} />
    </>
  );
}
