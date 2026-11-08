# Pulse Oximeter Monitor — web

@AGENTS.md

Bài tập lớn môn Y Sinh (sản phẩm học tập, không phải thiết bị y tế). Thiết bị đo SpO₂ và nhịp mạch (PR) dùng ESP32 + MAX30102, chạy pin. Thư mục này là phần web. Chỉ có một người dùng và một thiết bị. Máy dev chạy Windows (PowerShell).

## Stack (đã chốt)
Next.js 16 (App Router, TypeScript) · Tailwind v4 · Recharts · exceljs · tsx.
- Next 16 dùng `proxy.ts` thay cho `middleware.ts`. Đọc `node_modules/next/dist/docs/` trước khi dùng API Next.
- Chỉ dùng các dependency trên và `@tailwindcss/postcss`. Cần thêm gói nào khác thì **hỏi trước**.

## Cấu trúc
- `lib/store.ts`: interface `Store`. Bản local ghi nối tiếp vào `data/readings.ndjson` và giữ chỉ mục trong RAM. `computeAlerts()` cũng nằm ở đây.
- `lib/auth.ts`: interface `Auth`. Một tài khoản lấy từ env; phiên lưu trong cookie httpOnly ký HMAC (Web Crypto), hết hạn sau 7 ngày.
- `lib/format.ts`: helper dùng được ở client: giờ VN, nhãn cảnh báo.
- `proxy.ts`: chặn mọi trang và API khi chưa đăng nhập, trừ `/login`, `/api/auth/login`, `/api/ingest`, file tĩnh.
- `app/(app)/`: các trang `/` (Theo dõi), `/alerts`, `/export`. Trang `app/login/` nằm riêng.
- `app/api/`: `ingest`, `auth/login`, `auth/logout`, `latest`, `readings?range=1h|24h`, `alerts`, `export?from&to`.
- `scripts/mock-device.ts` (`npm run mock`, `--backfill=7`), `scripts/selftest.ts` (`npm run selftest`).

## Quy tắc nghiệp vụ
- ESP32 gửi `POST /api/ingest` mỗi 5 giây, header `X-Device-Key`. Payload: `device_id, ts (ISO8601), pr, spo2, battery_v, battery_pct, signal_quality (0–1), finger`.
  - Sai khóa trả 401, dữ liệu sai trả 400.
  - Kiểm tra pr 30–220 và spo2 70–100 chỉ khi `finger=true`.
- Trực tuyến nghĩa là có bản ghi trong 15 giây gần nhất.
- Các loại cảnh báo:
  - SpO₂ < 92% hoặc PR ngoài 50–120, kéo dài trên 10 giây.
  - Pin < 20%.
  - Mất kết nối: không có bản ghi quá 15 giây.
- Múi giờ hiển thị và xuất file: Asia/Ho_Chi_Minh.
- File Excel có 2 sheet "Du lieu" và "Canh bao"; khoảng tối đa 31 ngày.
- Chưa làm: nhiệt độ, ML.

## Giao diện
- Bám template trong `design/` (anh1 = dashboard, anh2 = xuất dữ liệu, anh3 = cảnh báo). Không tự đổi bố cục, màu hay font.
  - Màu: header và sidebar navy `#0b1224`, nút xanh `#2f6bff`, nền trang `#f1f5fb`.
  - Thẻ trắng bo góc 20px, font Plus Jakarta Sans.
- Logo: dùng nguyên file `public/logo.jpg` (không sửa, không cắt), đặt trong khung trắng bo góc, hiển thị bằng `next/image`.
  - Cao 40px trên header, 80px trên trang login. Ở 375px ẩn tên trường.
- Toàn bộ chữ trên giao diện bằng tiếng Việt.
- Dòng chú thích cố định "Thiết bị phục vụ học tập, không dùng để chẩn đoán y tế."
- Chữ "chẩn đoán" không được xuất hiện ở bất kỳ chỗ nào khác.
- Biểu đồ: hai biểu đồ riêng cho PR và SpO₂, **không dùng hai trục Y**.
- Phải hiển thị tốt ở 375px và 1440px.

## Ràng buộc
- Giai đoạn này chỉ chạy localhost, **chưa dùng Supabase**. Sau này chuyển sang Vercel + Supabase bằng cách viết bản cài đặt mới cho `Store` và `Auth`; giao diện không phải sửa.
- Không thêm tính năng ngoài yêu cầu: đăng ký, quên mật khẩu, dark mode, đa thiết bị.
- Không ghi secret thật vào code, tài liệu hay log. Secret chỉ để trong `.env.local` (đã gitignore).
- Chỉ sửa trong `web/`. Không đụng `firmware/`, `ml/`, `hardware/`, `docs/`.
- Hỏi trước khi xóa file hoặc thêm dependency.

## Kiểm tra trước khi báo xong
`npm run build` và `npm run selftest` phải pass. Thử API bằng `curl.exe` (không dùng alias `curl` của PowerShell).

Hướng dẫn chạy xem `RUN.md`, đưa lên GitHub xem `GIT.md`.
