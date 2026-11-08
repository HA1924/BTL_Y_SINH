import { PassThrough, Readable } from "node:stream";
import ExcelJS from "exceljs";
import { store } from "@/lib/store";
import { ALERT_LABEL, VN_OFFSET_MS, parseDayVN } from "@/lib/format";

const DATE_FMT = "dd/mm/yyyy hh:mm:ss";
// Excel has no time zone: shift UTC by +7h so the cell shows Vietnam wall-clock time.
const vnCell = (iso: string) => new Date(Date.parse(iso) + VN_OFFSET_MS);

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const fromS = q.get("from"), toS = q.get("to");
  const from = parseDayVN(fromS), toDay = parseDayVN(toS);
  if (!from || !toDay) return Response.json({ error: "from/to phải có dạng YYYY-MM-DD" }, { status: 400 });
  if (from > toDay) return Response.json({ error: "Ngày bắt đầu sau ngày kết thúc" }, { status: 400 });
  const days = (toDay.getTime() - from.getTime()) / 86400_000 + 1;
  if (days > 31) return Response.json({ error: "Khoảng tối đa 31 ngày" }, { status: 400 });

  const to = new Date(toDay.getTime() + 86400_000 - 1); // hết ngày `to` (giờ VN)
  const [rows, alerts] = await Promise.all([store.getRange(from, to), store.getAlerts(from, to)]);

  const dataRows = rows.map((r) => [
    vnCell(r.ts),
    r.finger ? r.pr : null,
    r.finger ? r.spo2 : null,
    r.battery_v,
    r.battery_pct,
    r.signal_quality,
    r.finger ? "Có" : "Không",
  ]);
  const alertRows = alerts
    .slice()
    .reverse()
    .map((a) => [vnCell(a.start), a.end ? vnCell(a.end) : "Đang diễn ra", ALERT_LABEL[a.type], a.value]);

  const pass = new PassThrough();
  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: pass, useStyles: true });

  const sheet = (name: string, headers: string[], data: unknown[][]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    // "Vừa nội dung": widest of header / values; dates render as 19 chars.
    const width = headers.map((h, i) =>
      Math.max(h.length, ...data.slice(0, 5000).map((r) => (r[i] instanceof Date ? 19 : String(r[i] ?? "").length))) + 2,
    );
    ws.columns = headers.map((header, i) => ({
      header,
      width: width[i],
      style: data.some((r) => r[i] instanceof Date) ? { numFmt: DATE_FMT } : {},
    }));
    const head = ws.getRow(1);
    head.font = { bold: true };
    head.commit();
    for (const r of data) ws.addRow(r).commit();
    ws.commit();
  };

  const done = (async () => {
    sheet(
      "Du lieu",
      ["Thời gian", "PR (bpm)", "SpO₂ (%)", "Pin (V)", "Pin (%)", "Chất lượng tín hiệu", "Có ngón tay"],
      dataRows,
    );
    sheet("Canh bao", ["Bắt đầu", "Kết thúc", "Loại cảnh báo", "Giá trị"], alertRows);
    await wb.commit();
  })();
  done.catch((e) => pass.destroy(e));

  const name = `spo2_${fromS!.replaceAll("-", "")}-${toS!.replaceAll("-", "")}.xlsx`;
  return new Response(Readable.toWeb(pass) as ReadableStream, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
