# Pulse Oximeter Monitor — Web

Dashboard theo dõi SpO₂ và nhịp mạch (PR) từ thiết bị ESP32 + MAX30102.
Next.js (App Router, TypeScript) · Tailwind CSS · Recharts · exceljs. Chạy localhost, dữ liệu lưu file.

> Sản phẩm học tập, không phải thiết bị y tế.

## Cài đặt

Yêu cầu Node.js ≥ 20.12 (khuyến nghị 24).

```powershell
cd web
npm install
copy .env.example .env.local
```

Mở `.env.local` và điền:

| Biến | Ý nghĩa |
|---|---|
| `DEVICE_KEY` | Khóa ESP32 gửi trong header `X-Device-Key` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Tài khoản đăng nhập duy nhất |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên ≥ 32 ký tự để ký cookie phiên |

Tạo chuỗi ngẫu nhiên: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

## Chạy

```powershell
npm run dev        # http://localhost:3000, lắng nghe 0.0.0.0 (máy khác cùng WiFi truy cập được)
npm run build      # build production
npm start          # chạy bản build (cũng lắng nghe 0.0.0.0)
npm run selftest   # kiểm tra nhanh logic cảnh báo + chữ ký phiên
```

Mở http://localhost:3000 → chưa đăng nhập sẽ chuyển tới `/login`. Đăng nhập bằng `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
Phiên lưu trong cookie httpOnly, hết hạn sau 7 ngày. Nút **Đăng xuất** ở góc phải thanh tiêu đề.

Trang:
- `/` — Theo dõi: giá trị hiện tại, trạng thái trực tuyến (có bản ghi trong 15 giây), biểu đồ 1 giờ / 24 giờ, cảnh báo gần đây.
- `/alerts` — Cảnh báo 24 giờ: SpO₂ < 92% hoặc PR ngoài 50–120 bpm kéo dài trên 10 giây, pin < 20%, mất kết nối (> 15 giây không có bản ghi).
- `/export` — Xuất Excel theo khoảng ngày.

Giao diện tự cập nhật mỗi 5 giây.

## Giả lập thiết bị

Server phải đang chạy (`npm run dev`) ở cửa sổ khác.

```powershell
npm run mock                       # gửi 1 bản ghi / 5 giây tới localhost:3000
npm run mock -- --backfill=7       # sinh 7 ngày dữ liệu quá khứ (≈120 nghìn bản ghi, khoảng 15–20 phút trên dev server) rồi thoát
npm run mock -- --url=http://192.168.1.10:3000   # gửi tới máy khác
```

Chế độ live lặp chu kỳ 2 phút: bình thường → SpO₂ ≈ 88% (30 s) → bỏ ngón tay (10 s) → PR ≈ 132 (30 s).
Pin bắt đầu 26% và giảm dần nên sau khoảng 3 phút có cảnh báo pin yếu. Tắt mock > 15 s sẽ có cảnh báo mất kết nối.
Backfill có các đoạn bất thường, pin yếu và mỗi ngày mất kết nối 10 phút lúc 03:00. Chỉ chạy backfill một lần (chạy lại sẽ nhân đôi dữ liệu).

## Dữ liệu

Bản ghi được ghi nối tiếp vào `data/readings.ndjson` (đã có trong `.gitignore`), nên tắt/bật lại server dữ liệu vẫn còn.
Xóa file này để làm sạch dữ liệu.

Truy cập dữ liệu và xác thực đi qua interface `Store` (`lib/store.ts`) và `Auth` (`lib/auth.ts`);
khi chuyển sang Supabase chỉ cần viết bản cài đặt mới cho hai interface này.

## Xuất Excel

Trang `/export` → chọn **Từ ngày** / **Đến ngày** → **Tải Excel**. Hoặc gọi trực tiếp (cần đăng nhập):

```
GET /api/export?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Tối đa 31 ngày, `from` không sau `to`. File `spo2_YYYYMMDD-YYYYMMDD.xlsx` gồm:
- **Du lieu**: Thời gian (dd/mm/yyyy HH:mm:ss, giờ Việt Nam), PR (bpm), SpO₂ (%), Pin (V), Pin (%), Chất lượng tín hiệu, Có ngón tay. Khi không có ngón tay, PR/SpO₂ để trống.
- **Canh bao**: Bắt đầu, Kết thúc, Loại cảnh báo, Giá trị.

## ESP32 gửi dữ liệu

```
POST http://<IP-LAN-của-máy-chạy-server>:3000/api/ingest
Content-Type: application/json
X-Device-Key: <DEVICE_KEY>

{ "device_id": "esp32-01", "ts": "2026-11-07T08:30:00Z", "pr": 78, "spo2": 98,
  "battery_v": 3.95, "battery_pct": 82, "signal_quality": 0.9, "finger": true }
```

- Xem IP LAN: `ipconfig` → "IPv4 Address" của card WiFi. Nếu ESP32 không gọi được, cho phép Node.js qua Windows Firewall (mạng Private), cổng 3000.
- `ts` là ISO8601 (UTC hoặc có offset). ESP32 cần đồng bộ giờ qua NTP, vì trạng thái trực tuyến so `ts` với giờ server.
- Kiểm tra: `pr` 30–220, `spo2` 70–100 (khi `finger=false` thiết bị có thể gửi 0), `battery_pct` 0–100, `signal_quality` 0–1.
- Mã trả về: `201` thành công · `401` sai/thiếu khóa · `400` dữ liệu sai.

### Gửi thử bằng curl.exe (Windows PowerShell)

Dùng `curl.exe` (không phải alias `curl` của PowerShell). Lưu payload ra file để tránh lỗi dấu nháy:

```powershell
'{"device_id":"esp32-01","ts":"2026-11-07T08:30:00Z","pr":78,"spo2":98,"battery_v":3.95,"battery_pct":82,"signal_quality":0.9,"finger":true}' | Out-File -Encoding ascii body.json

# Đúng khóa -> 201
curl.exe -s -w "%{http_code}`n" -X POST http://localhost:3000/api/ingest -H "Content-Type: application/json" -H "X-Device-Key: <DEVICE_KEY>" --data-binary "@body.json"

# Sai khóa -> 401
curl.exe -s -w "%{http_code}`n" -X POST http://localhost:3000/api/ingest -H "Content-Type: application/json" -H "X-Device-Key: sai" --data-binary "@body.json"

# Xuất Excel khi chưa đăng nhập -> 401
curl.exe -s -o NUL -w "%{http_code}`n" "http://localhost:3000/api/export?from=2026-11-01&to=2026-11-07"
```
