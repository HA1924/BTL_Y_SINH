import { store, type CalPoint } from "@/lib/store";
import { CAL_WINDOW_MS, summarizeWindow } from "@/lib/calibration";
import { fmtVN } from "@/lib/format";

async function currentWindow() {
  const now = Date.now();
  return summarizeWindow(await store.getRange(new Date(now - CAL_WINDOW_MS), new Date(now)), now);
}

// GET: danh sách điểm + trạng thái số đo hiện tại. ?format=csv để tải file cho bước huấn luyện.
export async function GET(req: Request) {
  const points = await store.listCalPoints();
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const head = "thoi_gian,nguoi_do,ghi_chu,spo2_tham_chieu,pr_tham_chieu,r,pi,spo2_thiet_bi,pr_thiet_bi,chat_luong,so_mau";
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = points.map((p) =>
      [q(fmtVN(p.ts)), q(p.subject), q(p.note), p.ref_spo2, p.ref_pr ?? "", p.r, p.pi ?? "", p.dev_spo2, p.dev_pr, p.quality, p.n].join(","),
    );
    // BOM để Excel đọc đúng tiếng Việt
    return new Response("﻿" + [head, ...lines].join("\r\n") + "\r\n", {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hieu_chuan_spo2.csv"`,
      },
    });
  }
  return Response.json({ points, window: await currentWindow() });
}

const int = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;

// POST: lưu một điểm = số máy tham chiếu + trung bình 15 giây gần nhất của thiết bị.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const subject = typeof b?.subject === "string" ? b.subject.trim() : "";
  const note = typeof b?.note === "string" ? b.note.trim().slice(0, 64) : "";
  if (!subject || subject.length > 32) return Response.json({ error: "Nhập mã người đo (tối đa 32 ký tự)" }, { status: 400 });
  if (!int(b?.ref_spo2, 70, 100)) return Response.json({ error: "SpO₂ tham chiếu phải là số nguyên 70–100" }, { status: 400 });
  if (b?.ref_pr != null && !int(b.ref_pr, 30, 220)) return Response.json({ error: "PR tham chiếu phải là số nguyên 30–220" }, { status: 400 });

  const w = await currentWindow();
  if (!w.ready) return Response.json({ error: w.reason, window: w }, { status: 409 });

  const p: CalPoint = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    subject,
    note,
    ref_spo2: b.ref_spo2,
    ref_pr: b.ref_pr ?? null,
    r: w.r!,
    pi: w.pi,
    dev_spo2: w.spo2!,
    dev_pr: w.pr!,
    quality: w.quality!,
    n: w.n,
  };
  await store.addCalPoint(p);
  return Response.json({ point: p, count: (await store.listCalPoints()).length }, { status: 201 });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return (await store.deleteCalPoint(id))
    ? Response.json({ ok: true })
    : Response.json({ error: "Không tìm thấy điểm" }, { status: 404 });
}
