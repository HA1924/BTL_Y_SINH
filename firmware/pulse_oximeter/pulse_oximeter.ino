// Pulse Oximeter Monitor - ESP32 + MAX30102 + LCD 2.4" (ILI9341 song song 8 bit)
// Do SpO2 / PR, hien thi tren LCD va gui len web (POST /api/ingest) moi 5 giay.
// San pham hoc tap, khong phai thiet bi y te.
//
// Thuat toan do (giu nguyen tu sketch spo2_display):
//  - Lay mau 50 Hz, loc DC bang IIR, loc thong thap ~3 Hz
//  - Moi 1 s xet cua so 4 s (200 mau): tim dinh, HR = trung vi khoang giua dinh
//  - SpO2 = 110 - 25*R, R = (AC/DC)do / (AC/DC)IR  (chua hieu chuan)
//
// Gui du lieu chay o task rieng tren core 0 de HTTP khong lam roi mau o loop() (core 1).
//
// Thu vien: "GFX Library for Arduino", "SparkFun MAX3010x Pulse and Proximity Sensor Library"
// (WiFi, HTTPClient co san trong ESP32 core)
// Cau hinh: chep secrets.example.h thanh secrets.h roi dien WiFi, SERVER_URL, DEVICE_KEY.

#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>
#include <Arduino_GFX_Library.h>
#include "MAX30105.h"
#include "secrets.h"

// ================== Phan cung ==================
Arduino_DataBus *bus = new Arduino_ESP32PAR8(
    26, GFX_NOT_DEFINED, 27, 32,        // DC(RS), CS, WR, RD
    4, 13, 14, 16, 17, 18, 19, 23);     // D0..D7
// rotation 0 = man doc. Neu hinh bi lon nguoc thi doi thanh 2.
Arduino_GFX *gfx = new Arduino_ILI9341(bus, GFX_NOT_DEFINED, 0);

MAX30105 sensor;
const int PIN_SDA = 21;
const int PIN_SCL = 22;
#define SWAP_RED_IR 0          // doi thanh 1 neu module dau nguoc 2 LED

const uint32_t FINGER_IR_THRESHOLD = 50000;   // chinh theo so do thuc te

// Pin: cau chia ap 100k/100k tu cuc + pin vao GPIO34 (ADC1, dung duoc khi bat WiFi)
const int   PIN_BAT     = 34;
const float BAT_DIVIDER = 2.0f;    // (R1 + R2) / R2
const float BAT_EMPTY_V = 3.30f;   // 0 %
const float BAT_FULL_V  = 4.20f;   // 100 %

const uint32_t SEND_INTERVAL_MS = 5000;

// ================== Mau (RGB565) ==================
const uint16_t C_BLACK   = 0x0000;
const uint16_t C_WHITE   = 0xFFFF;
const uint16_t C_RED     = 0xF800;
const uint16_t C_GREEN   = 0x07E0;
const uint16_t C_YELLOW  = 0xFFE0;
const uint16_t C_CYAN    = 0x07FF;
const uint16_t C_MAGENTA = 0xF81F;
const uint16_t C_FRAME   = 0x3D5F;
const uint16_t C_DIGIT   = 0x87F0;
const uint16_t C_SEG_OFF = 0x18C3;
const uint16_t C_DIM     = 0x2104;
const uint16_t C_GRAY    = 0x7BEF;
const uint16_t C_HEART   = 0xF8B2;

// ================== Bo cuc ==================
const int WAVE_X0 = 5, WAVE_X1 = 234;
const int WAVE_TOP = 196, WAVE_H = 116;

const int DIG_W = 24, DIG_H = 52, DIG_T = 5, DIG_GAP = 4;
const int SPO2_X = 8,   PR_X = 126, DIG_Y = 104;

// ================== DSP ==================
const int FS  = 50;
const int WIN = 200;     // 4 s
float bufRawIr[WIN], bufRawRed[WIN], bufAcIr[WIN], bufAcRed[WIN];
int bufIdx = 0, bufCount = 0, samplesSinceCalc = 0;
bool dspInit = false;
float dcIr = 0, dcRed = 0, lpIr = 0, lpRed = 0;

float beatEnv = 0, beatPrev = 0;
int samplesSinceBeat = 100;
uint32_t heartOnAt = 0;
bool heartLit = false;

bool  haveVitals = false;
float hrShow = 0, spo2Show = 0, piShow = 0, rShow = 0;
int   hrMax = -1, hrMin = 1000, spMax = -1, spMin = 1000;
int   alarmSeconds = 0;
bool  finger = false;

int waveX = WAVE_X0 + 1;
int waveYPrev = WAVE_TOP + WAVE_H / 2;
float waveEnv = 50;

// ================== Du lieu chia se cho task gui ==================
struct Snapshot { bool valid; int pr; int spo2; float quality; };
Snapshot snap = {false, 0, 0, 0};
portMUX_TYPE snapMux = portMUX_INITIALIZER_UNLOCKED;
volatile int netState = 0;   // 0 = chua WiFi, 1 = WiFi ok, 2 = gui ok, 3 = gui loi

// ================== Ve so kieu 7 doan ==================
const uint8_t SEG_MAP[10] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};
const uint8_t SEG_BLANK = 0x00;
const uint8_t SEG_DASH  = 0x40;

void drawSegDigit(int x, int y, uint8_t mask, uint16_t on) {
  const int w = DIG_W, h = DIG_H, t = DIG_T;
  const int vh = (h - 3 * t) / 2;
  struct R { int x, y, w, h; } seg[7] = {
    {x + t,     y,                  w - 2 * t, t},
    {x + w - t, y + t,              t,         vh},
    {x + w - t, y + 2 * t + vh,     t,         vh},
    {x + t,     y + 2 * t + 2 * vh, w - 2 * t, t},
    {x,         y + 2 * t + vh,     t,         vh},
    {x,         y + t,              t,         vh},
    {x + t,     y + t + vh,         w - 2 * t, t},
  };
  for (int i = 0; i < 7; i++) {
    gfx->fillRect(seg[i].x, seg[i].y, seg[i].w, seg[i].h, (mask >> i) & 1 ? on : C_SEG_OFF);
  }
}

void drawBigNumber(int x, int value, uint16_t color) {
  uint8_t m[3];
  if (value < 0) {
    m[0] = SEG_BLANK; m[1] = SEG_DASH; m[2] = SEG_DASH;
  } else {
    if (value > 999) value = 999;
    m[0] = value >= 100 ? SEG_MAP[value / 100] : SEG_BLANK;
    m[1] = value >= 10  ? SEG_MAP[(value / 10) % 10] : SEG_BLANK;
    m[2] = SEG_MAP[value % 10];
  }
  for (int i = 0; i < 3; i++) drawSegDigit(x + i * (DIG_W + DIG_GAP), DIG_Y, m[i], color);
}

// ================== Giao dien ==================
void drawHeart(int cx, int cy, uint16_t color) {
  gfx->fillCircle(cx - 4, cy, 4, color);
  gfx->fillCircle(cx + 4, cy, 4, color);
  gfx->fillTriangle(cx - 8, cy + 1, cx + 8, cy + 1, cx, cy + 11, color);
}

void drawStaticLayout() {
  gfx->fillScreen(C_BLACK);
  gfx->setTextSize(1);
  gfx->setTextColor(C_GRAY, C_BLACK);
  gfx->setCursor(6, 6);
  gfx->print("BTL Y SINH");

  gfx->drawRoundRect(2, 20, 236, 50, 6, C_FRAME);
  gfx->setTextSize(2);
  gfx->setTextColor(C_WHITE, C_BLACK);
  gfx->setCursor(8, 26);
  gfx->print("Trang thai");
  gfx->drawRect(146, 30, 86, 8, C_DIM);

  gfx->drawRoundRect(2, 74, 236, 112, 6, C_FRAME);
  gfx->drawFastVLine(120, 78, 104, C_DIM);
  gfx->setTextSize(2);
  gfx->setTextColor(C_CYAN, C_BLACK);
  gfx->setCursor(28, 82);
  gfx->print("SpO2");
  gfx->setCursor(148, 82);
  gfx->print("PR");
  gfx->setTextSize(1);
  gfx->setTextColor(C_GRAY, C_BLACK);
  gfx->setCursor(92, 148);
  gfx->print("%");
  gfx->setCursor(210, 148);
  gfx->print("bpm");
  drawHeart(14, 88, C_SEG_OFF);
  drawHeart(134, 88, C_SEG_OFF);

  gfx->drawRoundRect(2, 192, 236, 124, 6, C_FRAME);
}

void drawStatus(int level, float quality) {
  int w = (int)(84 * constrain(quality, 0.0f, 1.0f));
  gfx->fillRect(147, 31, 84, 6, C_BLACK);
  gfx->fillRect(147, 31, w, 6, C_CYAN);

  struct Box { int x; const char *label; uint16_t fill; uint16_t text; } boxes[3] = {
    {8,   "CANH BAO", C_RED,    C_WHITE},
    {84,  "CHU Y",    C_YELLOW, C_BLACK},
    {160, "ON DINH",  C_GREEN,  C_BLACK},
  };
  int activeIdx = level == 2 ? 0 : level == 1 ? 1 : level == 0 ? 2 : -1;
  gfx->setTextSize(1);
  for (int i = 0; i < 3; i++) {
    bool active = i == activeIdx;
    uint16_t bg = active ? boxes[i].fill : C_DIM;
    uint16_t fg = active ? boxes[i].text : C_GRAY;
    gfx->fillRect(boxes[i].x, 46, 72, 18, bg);
    int tw = strlen(boxes[i].label) * 6;
    gfx->setTextColor(fg, bg);
    gfx->setCursor(boxes[i].x + (72 - tw) / 2, 51);
    gfx->print(boxes[i].label);
  }
}

void drawMinMax(int x, int maxV, int minV) {
  gfx->setTextSize(1);
  gfx->setTextColor(C_DIGIT, C_BLACK);
  gfx->fillRect(x, 106, 24, 30, C_BLACK);
  gfx->setCursor(x, 108);
  if (maxV >= 0) gfx->print(maxV); else gfx->print("--");
  gfx->setCursor(x, 126);
  if (minV < 1000) gfx->print(minV); else gfx->print("--");
}

void drawExtras() {
  gfx->setTextSize(1);
  gfx->setTextColor(C_GRAY, C_BLACK);
  gfx->fillRect(6, 166, 110, 12, C_BLACK);
  gfx->fillRect(124, 166, 110, 12, C_BLACK);
  gfx->setCursor(8, 168);
  if (haveVitals) gfx->printf("PI %.2f %%", piShow); else gfx->print("PI --");
  gfx->setCursor(126, 168);
  if (haveVitals) gfx->printf("R %.3f", rShow); else gfx->print("R --");
}

// Thay dong ho bang trang thai mang o goc tren phai
void drawNet() {
  static const char *labels[4] = {"No WiFi ", "WiFi    ", "Web OK  ", "Web loi "};
  static const uint16_t colors[4] = {C_GRAY, C_CYAN, C_GREEN, C_RED};
  int s = netState;
  gfx->setTextSize(1);
  gfx->setTextColor(colors[s], C_BLACK);
  gfx->setCursor(182, 6);
  gfx->print(labels[s]);
}

void drawNoFingerMessage(bool show) {
  gfx->fillRect(WAVE_X0, WAVE_TOP, WAVE_X1 - WAVE_X0, WAVE_H, C_BLACK);
  if (show) {
    gfx->setTextSize(2);
    gfx->setTextColor(C_YELLOW, C_BLACK);
    gfx->setCursor(42, WAVE_TOP + WAVE_H / 2 - 8);
    gfx->print("Dat ngon tay");
  }
  waveX = WAVE_X0 + 1;
  waveYPrev = WAVE_TOP + WAVE_H / 2;
}

// ================== DSP ==================
void resetDsp() {
  dspInit = false;
  bufIdx = 0; bufCount = 0; samplesSinceCalc = 0;
  haveVitals = false;
  hrMax = -1; hrMin = 1000; spMax = -1; spMin = 1000;
  alarmSeconds = 0;
  beatEnv = 0; samplesSinceBeat = 100;
  waveEnv = 50;
}

void pushSample(uint32_t red, uint32_t ir) {
  if (!dspInit) {
    dcIr = ir; dcRed = red; lpIr = 0; lpRed = 0;
    dspInit = true;
  }
  dcIr  += ((float)ir  - dcIr)  * 0.05f;
  dcRed += ((float)red - dcRed) * 0.05f;
  lpIr  += (((float)ir  - dcIr)  - lpIr)  * 0.35f;
  lpRed += (((float)red - dcRed) - lpRed) * 0.35f;

  bufRawIr[bufIdx]  = ir;
  bufRawRed[bufIdx] = red;
  bufAcIr[bufIdx]   = lpIr;
  bufAcRed[bufIdx]  = lpRed;
  bufIdx = (bufIdx + 1) % WIN;
  if (bufCount < WIN) bufCount++;
}

bool computeVitals(float &hr, float &spo2, float &pi, float &R) {
  if (bufCount < WIN) return false;
  static float s[WIN];
  double sumIr = 0, sumRed = 0;
  float maxI = -1e9, minI = 1e9, maxR = -1e9, minR = 1e9, smax = -1e9;
  for (int k = 0; k < WIN; k++) {
    int i = (bufIdx + k) % WIN;
    sumIr += bufRawIr[i];
    sumRed += bufRawRed[i];
    maxI = max(maxI, bufAcIr[i]);  minI = min(minI, bufAcIr[i]);
    maxR = max(maxR, bufAcRed[i]); minR = min(minR, bufAcRed[i]);
    s[k] = -bufAcIr[i];
    smax = max(smax, s[k]);
  }
  float dcI = sumIr / WIN, dcR = sumRed / WIN;
  float acI = maxI - minI, acR = maxR - minR;
  if (acI <= 0 || acR <= 0 || dcI <= 0 || dcR <= 0 || smax <= 0) return false;

  float peaks[16];
  int np = 0, last = -100;
  const float thr = 0.4f * smax;
  const int minDist = 17;
  for (int k = 1; k < WIN - 1 && np < 16; k++) {
    if (s[k] > thr && s[k] > s[k - 1] && s[k] >= s[k + 1] && k - last >= minDist) {
      float den = s[k - 1] - 2 * s[k] + s[k + 1];
      float d = den != 0 ? 0.5f * (s[k - 1] - s[k + 1]) / den : 0;
      peaks[np++] = k + d;
      last = k;
    }
  }
  if (np < 3) return false;

  int n = np - 1;
  float iv[15];
  float mean = 0;
  for (int j = 0; j < n; j++) { iv[j] = peaks[j + 1] - peaks[j]; mean += iv[j]; }
  mean /= n;
  float var = 0;
  for (int j = 0; j < n; j++) var += (iv[j] - mean) * (iv[j] - mean);
  float cv = sqrtf(var / n) / mean;
  if (cv > 0.25f) return false;

  for (int a = 1; a < n; a++) {
    float key = iv[a]; int b = a - 1;
    while (b >= 0 && iv[b] > key) { iv[b + 1] = iv[b]; b--; }
    iv[b + 1] = key;
  }
  float med = (n % 2) ? iv[n / 2] : 0.5f * (iv[n / 2 - 1] + iv[n / 2]);

  hr = 60.0f * FS / med;
  if (hr < 35 || hr > 200) return false;

  R = (acR / dcR) / (acI / dcI);
  spo2 = constrain(110.0f - 25.0f * R, 70.0f, 100.0f);
  pi = 100.0f * acI / dcI;
  return true;
}

// ================== Song va trai tim ==================
void plotWave() {
  float s = -lpIr;
  float a = fabsf(s);
  if (a > waveEnv) waveEnv = a; else waveEnv = waveEnv * 0.995f + a * 0.005f;
  if (waveEnv < 20) waveEnv = 20;
  float norm = constrain(s / (waveEnv * 1.2f), -1.0f, 1.0f);
  int y = WAVE_TOP + WAVE_H / 2 - (int)(norm * (WAVE_H / 2 - 4));

  gfx->drawFastVLine(waveX + 1, WAVE_TOP, WAVE_H, C_BLACK);
  gfx->drawLine(waveX - 1, waveYPrev, waveX, y, C_GREEN);
  waveYPrev = y;
  waveX++;
  if (waveX >= WAVE_X1) waveX = WAVE_X0 + 1;
}

void detectBeat() {
  float s = -lpIr;
  beatEnv = max(beatEnv * 0.995f, fabsf(s));
  samplesSinceBeat++;
  float th = 0.5f * beatEnv;
  if (s > th && beatPrev <= th && samplesSinceBeat > 17) {
    samplesSinceBeat = 0;
    heartOnAt = millis();
    if (!heartLit) {
      drawHeart(14, 88, C_HEART);
      drawHeart(134, 88, C_HEART);
      heartLit = true;
    }
  }
  beatPrev = s;
}

// ================== Cap nhat moi giay ==================
void updateOncePerSecond() {
  float hr, spo2, pi, R;
  bool ok = finger && computeVitals(hr, spo2, pi, R);

  if (ok) {
    if (!haveVitals) { hrShow = hr; spo2Show = spo2; piShow = pi; rShow = R; }
    else {
      hrShow   += (hr - hrShow) * 0.3f;
      spo2Show += (spo2 - spo2Show) * 0.3f;
      piShow   += (pi - piShow) * 0.3f;
      rShow    += (R - rShow) * 0.3f;
    }
    haveVitals = true;
  } else if (!finger) {
    haveVitals = false;
  }

  int hrI = haveVitals ? (int)lroundf(hrShow) : -1;
  int spI = haveVitals ? (int)lroundf(spo2Show) : -1;
  if (haveVitals) {
    hrMax = max(hrMax, hrI); hrMin = min(hrMin, hrI);
    spMax = max(spMax, spI); spMin = min(spMin, spI);
  }

  drawBigNumber(SPO2_X, spI, C_DIGIT);
  drawBigNumber(PR_X, hrI, C_DIGIT);
  drawMinMax(94, spMax, spMin);
  drawMinMax(212, hrMax, hrMin);
  drawExtras();

  int level = -1;
  float quality = 0;
  if (haveVitals) {
    bool danger  = spI < 92 || hrI < 50 || hrI > 120;
    bool caution = spI < 95 || hrI < 55 || hrI > 100;
    alarmSeconds = danger ? alarmSeconds + 1 : 0;
    level = (danger && alarmSeconds > 10) ? 2 : (danger || caution) ? 1 : 0;
    quality = ok ? min(1.0f, piShow / 1.5f) : 0.3f;
  } else {
    alarmSeconds = 0;
  }
  drawStatus(level, quality);
  drawNet();

  // Cap nhat ban chup cho task gui. Web chi nhan pr 30-220, spo2 70-100 khi finger=true.
  Snapshot s;
  s.valid   = haveVitals && hrI >= 30 && hrI <= 220 && spI >= 70 && spI <= 100;
  s.pr      = s.valid ? hrI : 0;
  s.spo2    = s.valid ? spI : 0;
  s.quality = s.valid ? quality : 0;
  portENTER_CRITICAL(&snapMux);
  snap = s;
  portEXIT_CRITICAL(&snapMux);

  if (haveVitals) Serial.printf("hr=%d spo2=%d pi=%.2f R=%.3f\n", hrI, spI, piShow, rShow);
}

// ================== Mang ==================
float readBatteryV() {
  uint32_t mv = 0;
  for (int i = 0; i < 16; i++) mv += analogReadMilliVolts(PIN_BAT);
  return (mv / 16.0f) / 1000.0f * BAT_DIVIDER;
}

int batteryPct(float v) {
  float p = (v - BAT_EMPTY_V) / (BAT_FULL_V - BAT_EMPTY_V) * 100.0f;
  return (int)lroundf(constrain(p, 0.0f, 100.0f));
}

void sendReading() {
  time_t now = time(nullptr);
  if (now < 1700000000) {           // chua dong bo NTP thi chua gui
    Serial.println("[net] cho dong bo gio NTP");
    return;
  }
  struct tm t;
  gmtime_r(&now, &t);
  char ts[25];
  strftime(ts, sizeof(ts), "%Y-%m-%dT%H:%M:%SZ", &t);

  Snapshot s;
  portENTER_CRITICAL(&snapMux);
  s = snap;
  portEXIT_CRITICAL(&snapMux);

  float bv = readBatteryV();
  if (bv > 10) bv = 10;
  char body[256];
  snprintf(body, sizeof(body),
           "{\"device_id\":\"%s\",\"ts\":\"%s\",\"pr\":%d,\"spo2\":%d,"
           "\"battery_v\":%.2f,\"battery_pct\":%d,\"signal_quality\":%.2f,\"finger\":%s}",
           DEVICE_ID, ts, s.pr, s.spo2, bv, batteryPct(bv), s.quality,
           s.valid ? "true" : "false");

  HTTPClient http;
  http.setTimeout(4000);
  if (!http.begin(SERVER_URL)) { netState = 3; return; }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  int code = http.POST((uint8_t *)body, strlen(body));
  http.end();

  netState = (code == 201) ? 2 : 3;
  Serial.printf("[net] POST %d %s\n", code, body);
  if (code == 401) Serial.println("[net] sai DEVICE_KEY");
}

void netTask(void *) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  configTime(0, 0, "pool.ntp.org", "time.google.com");   // gio UTC, web tu doi sang gio VN

  uint32_t next = millis();
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      netState = 0;
      vTaskDelay(pdMS_TO_TICKS(500));
      continue;
    }
    if (netState == 0) {
      netState = 1;
      Serial.printf("[net] WiFi ok, IP %s\n", WiFi.localIP().toString().c_str());
    }
    if ((int32_t)(millis() - next) >= 0) {
      next += SEND_INTERVAL_MS;
      if ((int32_t)(millis() - next) >= 0) next = millis() + SEND_INTERVAL_MS;   // tre qua thi bat lai nhip
      sendReading();
    }
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

// ================== setup / loop ==================
void setup() {
  Serial.begin(115200);
  if (!gfx->begin()) Serial.println("LCD khoi tao that bai");
  drawStaticLayout();
  drawBigNumber(SPO2_X, -1, C_DIGIT);
  drawBigNumber(PR_X, -1, C_DIGIT);
  drawMinMax(94, -1, 1000);
  drawMinMax(212, -1, 1000);
  drawExtras();
  drawStatus(-1, 0);
  drawNet();
  drawNoFingerMessage(true);

  analogSetPinAttenuation(PIN_BAT, ADC_11db);
  xTaskCreatePinnedToCore(netTask, "net", 8192, nullptr, 1, nullptr, 0);

  Wire.begin(PIN_SDA, PIN_SCL);
  if (!sensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("Khong tim thay MAX30102");
    gfx->fillRect(WAVE_X0, WAVE_TOP, WAVE_X1 - WAVE_X0, WAVE_H, C_BLACK);
    gfx->setTextSize(2);
    gfx->setTextColor(C_RED, C_BLACK);
    gfx->setCursor(20, WAVE_TOP + WAVE_H / 2 - 8);
    gfx->print("Khong thay MAX30102");
    while (true) delay(1000);
  }
  sensor.setup(0x1F, 1, 2, 50, 411, 4096);
}

void loop() {
  static uint32_t lastPoll = 0;
  if (millis() - lastPoll >= 20) {
    lastPoll = millis();
    sensor.check();
    while (sensor.available()) {
#if SWAP_RED_IR
      uint32_t red = sensor.getFIFOIR();
      uint32_t ir  = sensor.getFIFORed();
#else
      uint32_t red = sensor.getFIFORed();
      uint32_t ir  = sensor.getFIFOIR();
#endif
      sensor.nextSample();

      bool f = ir > FINGER_IR_THRESHOLD;
      if (f != finger) {
        finger = f;
        resetDsp();
        drawNoFingerMessage(!finger);
      }
      if (!finger) continue;

      pushSample(red, ir);
      plotWave();
      detectBeat();

      if (++samplesSinceCalc >= FS) {
        samplesSinceCalc = 0;
        updateOncePerSecond();
      }
    }
  }

  static uint32_t lastIdle = 0;
  if (!finger && millis() - lastIdle >= 1000) {
    lastIdle = millis();
    updateOncePerSecond();
  }

  if (heartLit && millis() - heartOnAt > 150) {
    drawHeart(14, 88, C_SEG_OFF);
    drawHeart(134, 88, C_SEG_OFF);
    heartLit = false;
  }
}
