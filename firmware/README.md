# Firmware ESP32

Sketch `pulse_oximeter/` đo SpO₂ và nhịp mạch bằng MAX30102, hiển thị trên LCD 2.4" (ILI9341, bus song song 8 bit) và gửi `POST /api/ingest` lên web mỗi 5 giây.

## Chuẩn bị
1. Arduino IDE: cài board **esp32 by Espressif** (2.x hoặc 3.x).
2. Library Manager: cài **GFX Library for Arduino** và **SparkFun MAX3010x Pulse and Proximity Sensor Library**.
3. Chép `pulse_oximeter/secrets.example.h` thành `pulse_oximeter/secrets.h` rồi điền:
   - `WIFI_SSID`, `WIFI_PASS`: WiFi 2.4 GHz, phải cùng mạng với máy chạy web.
   - `SERVER_URL`: `http://<IP LAN của máy>:3000/api/ingest`. Xem IP bằng lệnh `ipconfig` (dòng IPv4).
   - `DEVICE_KEY`: giống hệt `DEVICE_KEY` trong `.env.local` của web.

   `secrets.h` đã được gitignore.
4. Mở `pulse_oximeter/pulse_oximeter.ino`, chọn board **ESP32 Dev Module** rồi nạp.

## Đấu dây
- LCD và MAX30102 (SDA 21, SCL 22) đấu như sketch `spo2_display`.
- Pin: cầu chia áp 100k/100k từ cực + của pin vào **GPIO34**, đầu còn lại xuống GND. Nếu dùng tỉ lệ khác thì sửa `BAT_DIVIDER`.

## Chạy thử
1. Trên máy tính: `npm run dev`. Lần đầu Windows có thể hỏi tường lửa, chọn cho phép mạng Private.
2. Mở Serial Monitor ở 115200 baud. Thấy `[net] POST 201 ...` là gửi được.
   - `401`: sai `DEVICE_KEY`.
   - `-1`: sai IP hoặc tường lửa đang chặn cổng 3000.
3. Góc trên phải LCD báo trạng thái mạng: `No WiFi`, `WiFi`, `Web OK`, `Web loi`.

## Ghi chú
- Giờ lấy qua NTP (UTC). Chưa đồng bộ được giờ thì thiết bị chưa gửi.
- Chỉ gửi `finger=true` khi đã có số đo hợp lệ. Lúc chưa đặt ngón tay hoặc đang tính, thiết bị gửi `finger=false`, `pr=0`, `spo2=0`.
- Công thức SpO₂ chưa hiệu chuẩn. Đây là sản phẩm học tập, không phải thiết bị y tế.
