// Chep file nay thanh secrets.h (cung thu muc) roi dien gia tri.
// secrets.h da duoc gitignore, khong commit.
#pragma once

#define WIFI_SSID   "ten-wifi"
#define WIFI_PASS   "mat-khau-wifi"

// IP LAN cua may dang chay `npm run dev` (xem bang ipconfig), cong 3000
#define SERVER_URL  "http://192.168.1.10:3000/api/ingest"

// Phai trung voi DEVICE_KEY trong .env.local cua web
#define DEVICE_KEY  "dan-device-key-vao-day"

#define DEVICE_ID   "esp32-01"
