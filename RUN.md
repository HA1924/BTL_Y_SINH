# Cách chạy Pulse Oximeter Monitor (Windows)

Các lệnh dưới đây chạy trong **PowerShell**, tại thư mục `web\`.

## 1. Cài đặt (chỉ làm lần đầu)

1. Cài **Node.js 24 LTS** từ https://nodejs.org. Kiểm tra lại bằng lệnh `node -v`.
2. Cài thư viện:
   ```powershell
   cd D:\STUDY\DIEN_TU_Y_SINH\web
   npm install
   ```
3. Tạo file cấu hình (bỏ qua nếu đã có `.env.local`):
   ```powershell
   copy .env.example .env.local
   notepad .env.local
   ```
   Điền đủ 4 dòng:
   ```
   DEVICE_KEY=<khóa cho ESP32, tự đặt>
   ADMIN_EMAIL=<email đăng nhập>
   ADMIN_PASSWORD=<mật khẩu đăng nhập>
   SESSION_SECRET=<chuỗi ngẫu nhiên dài>
   ```
   Để tạo chuỗi ngẫu nhiên cho `SESSION_SECRET` hoặc `DEVICE_KEY`:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

## 2. Chạy web

```powershell
npm run dev
```

- Mở http://localhost:3000. Trình duyệt sẽ tự chuyển sang trang đăng nhập.
- Đăng nhập bằng `ADMIN_EMAIL` và `ADMIN_PASSWORD` trong `.env.local`.
- Muốn dừng server thì bấm `Ctrl + C`.

Nếu sửa `.env.local`, cần dừng server rồi chạy lại `npm run dev` thì thay đổi mới có hiệu lực.

## 3. Chạy thử khi chưa có ESP32 (giả lập)

Mở **cửa sổ PowerShell thứ hai** và giữ server ở cửa sổ đầu vẫn chạy:

```powershell
cd D:\STUDY\DIEN_TU_Y_SINH\web
npm run mock
```

- Script gửi một bản ghi mỗi 5 giây. Dashboard sẽ cập nhật trong khoảng 5–15 giây.
- Chu kỳ giả lập dài 2 phút: số đo bình thường, rồi SpO₂ thấp, rồi bỏ ngón tay, rồi PR cao. Cảnh báo sẽ hiện ở trang **Cảnh báo**.
- Dừng mock (`Ctrl + C`) quá 15 giây thì trang sẽ báo **Ngoại tuyến** và có cảnh báo mất kết nối.

### Sinh sẵn 7 ngày dữ liệu để thử xuất Excel

```powershell
npm run mock -- --backfill=7
```

- Lệnh mất khoảng 15–20 phút và tự thoát khi xong.
- Chỉ chạy **một lần**, vì chạy lại sẽ nhân đôi dữ liệu.

## 4. Xuất Excel

1. Vào trang **Xuất dữ liệu**.
2. Chọn **Từ ngày** và **Đến ngày** (tối đa 31 ngày).
3. Bấm **Tải Excel**.

Bạn sẽ nhận file `spo2_YYYYMMDD-YYYYMMDD.xlsx` gồm 2 sheet "Du lieu" và "Canh bao", thời gian theo giờ Việt Nam.

## 5. Kết nối ESP32 thật

1. Máy tính và ESP32 phải dùng **cùng một mạng WiFi**.
2. Lấy IP của máy tính: chạy `ipconfig` và xem dòng **IPv4 Address** của card WiFi, ví dụ `192.168.1.10`.
3. Trong firmware, gửi dữ liệu tới:
   ```
   POST http://192.168.1.10:3000/api/ingest
   Header: Content-Type: application/json
   Header: X-Device-Key: <DEVICE_KEY trong .env.local>
   ```
4. Nếu ESP32 không gọi được, lần đầu Windows sẽ hỏi quyền tường lửa cho Node.js. Chọn **Allow** cho mạng **Private**.
5. ESP32 cần đồng bộ giờ qua NTP. Nếu giờ trên thiết bị bị sai, web sẽ báo ngoại tuyến.

Mã trả về khi ESP32 gửi: `201` là thành công, `401` là sai khóa, `400` là dữ liệu sai.

### Gửi thử bằng tay

```powershell
'{"device_id":"esp32-01","ts":"2026-11-07T08:30:00Z","pr":78,"spo2":98,"battery_v":3.95,"battery_pct":82,"signal_quality":0.9,"finger":true}' | Out-File -Encoding ascii body.json
curl.exe -s -w "%{http_code}`n" -X POST http://localhost:3000/api/ingest -H "Content-Type: application/json" -H "X-Device-Key: <DEVICE_KEY>" --data-binary "@body.json"
```

## 6. Lệnh khác

| Lệnh | Tác dụng |
|---|---|
| `npm run build` | Build bản production (kiểm tra lỗi) |
| `npm start` | Chạy bản đã build (phải `npm run build` trước) |
| `npm run selftest` | Kiểm tra nhanh logic cảnh báo, phiên đăng nhập và ngày giờ |

## 7. Dữ liệu & sự cố thường gặp

- Toàn bộ dữ liệu nằm trong `data\readings.ndjson`. Tắt hay bật lại server dữ liệu vẫn còn.
- Muốn xóa sạch dữ liệu: dừng server, xóa file trên, rồi chạy lại.

| Hiện tượng | Cách xử lý |
|---|---|
| `Port 3000 is in use` | Còn một server khác đang chạy. Đóng cửa sổ đó, hoặc chạy `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess`. |
| Đăng nhập luôn báo sai | Kiểm tra `ADMIN_EMAIL` và `ADMIN_PASSWORD` trong `.env.local`, sau đó khởi động lại server. |
| Lỗi `SESSION_SECRET chưa đặt` | Điền `SESSION_SECRET` (ít nhất 16 ký tự). |
| Mock báo `401` | `DEVICE_KEY` trong `.env.local` bị trống hoặc server chưa được khởi động lại sau khi sửa. |
