# PLAN 2.0 — Thêm hồi quy tuyến tính (ML) và hướng phát triển tiếp

Tài liệu này là kế hoạch, chưa có phần nào được code. Các mục có ghi **(cần chốt)** là chỗ nhóm phải quyết định trước khi làm.

---

## 1. Hiện trạng (bản 1.0)

- **Firmware** đo PR và SpO₂, hiển thị LCD, gửi lên web mỗi 5 giây.
- **Web** nhận dữ liệu, hiển thị trực tiếp, cảnh báo theo ngưỡng cố định, xuất Excel.
- **Chưa có ML.** SpO₂ đang tính bằng công thức sách giáo khoa trong firmware:

  ```
  R    = (AC_red / DC_red) / (AC_ir / DC_ir)
  SpO₂ = 110 − 25 × R
  ```

  Hai hệ số 110 và 25 là giá trị tham khảo chung, không được hiệu chuẩn cho cảm biến MAX30102 và vỏ máy của nhóm. Đây là nguồn sai số lớn nhất của thiết bị.

---

## 2. Dùng hồi quy tuyến tính vào đâu? (cần chốt)

| Phương án | Mô hình | Cần gì | Giá trị khi báo cáo |
|---|---|---|---|
| **A. Hiệu chuẩn SpO₂** | `SpO₂ = a + b × R`, học `a`, `b` từ số đo của máy tham chiếu | Một máy đo SpO₂ thương mại, thu dữ liệu trên nhiều người | Cao nhất: thay công thức sách bằng mô hình tự huấn luyện, có số liệu sai số trước và sau |
| **B. Dự báo xu hướng** | Hồi quy theo thời gian trên 5 phút gần nhất, lấy độ dốc (%/phút, bpm/phút) | Không cần thêm gì, chỉ sửa web | Dễ thấy trên màn hình: "SpO₂ đang giảm 0,8%/phút", cảnh báo sớm trước khi chạm ngưỡng |
| **C. Ước lượng thời gian pin còn lại** | Hồi quy `battery_pct` theo thời gian | Không cần thêm gì | Thấp hơn, nhưng làm rất nhanh và thực dụng |

**Đề xuất: làm A làm phần ML chính, thêm B để có thứ nhìn thấy được trên web.** A trả lời câu hỏi thầy cô hay hỏi nhất ("máy đo chính xác đến đâu?"). B làm trong một buổi và không phụ thuộc phần cứng. C chỉ làm nếu còn thời gian.

---

## 3. Các bước làm phương án A — hiệu chuẩn SpO₂

> **Trạng thái:** A1 và A2 đã làm (firmware gửi `r`, `pi`; trang `/calibration` thu điểm và xuất CSV). Đã có máy tham chiếu. Việc tiếp theo: thu dữ liệu 8–10 người, sau đó làm A3.

### Bước A1. Gửi thêm `R` lên web
- Firmware đã tính sẵn `R` (và chỉ số tưới máu `pi`) nhưng chưa gửi.
- Thêm 2 trường **tùy chọn** vào payload: `"r": number`, `"pi": number`.
- Web lưu thêm 2 trường này; bản ghi cũ không có thì để trống. Giao diện chưa cần đổi.
- **(cần chốt)** Payload là quyết định đã chốt ở bản 1.0, việc thêm trường cần nhóm đồng ý.

### Bước A2. Thu dữ liệu ghép cặp
- Mỗi lần đo: kẹp máy tham chiếu ở một ngón, thiết bị của nhóm ở ngón bên cạnh, ngồi yên 30 giây, ghi lại số SpO₂ của máy tham chiếu.
- Cách ghi số tham chiếu **(cần chốt, chọn 1)**:
  1. **Trang "Hiệu chuẩn" trên web** (đề xuất): nhập số của máy tham chiếu, web tự ghép với `R` trung bình 10 giây gần nhất và lưu vào `data/calibration.ndjson`.
  2. Ghi tay vào Excel kèm giờ đo, sau đó ghép với file xuất từ web.
- Mục tiêu: ít nhất 5 người, mỗi người 20–30 điểm, tổng trên 100 điểm.

**Hạn chế phải nêu rõ trong báo cáo:** người khỏe mạnh có SpO₂ chỉ trong khoảng 95–100%, nên dữ liệu gần như không có điểm thấp. Mô hình vì vậy chỉ đáng tin trong khoảng đã đo. Không tự làm giảm SpO₂ bằng cách nín thở kéo dài hay các cách có rủi ro để lấy dữ liệu.

### Bước A3. Huấn luyện (thư mục `ml/`, Python)
- Công cụ: Python với `pandas`, `scikit-learn`, `matplotlib`. Đây là môi trường riêng, không liên quan tới dependency của web.
- Các việc:
  1. Lọc dữ liệu: bỏ điểm `signal_quality` thấp, bỏ điểm lúc cử động.
  2. Chia tập huấn luyện / kiểm tra **theo người** (không trộn điểm của cùng một người vào cả hai tập).
  3. Huấn luyện `LinearRegression` với đầu vào `R`. Thử thêm `pi` làm đầu vào thứ hai và so sánh.
  4. Đánh giá: MAE, RMSE, R², biểu đồ Bland–Altman; so với công thức cũ `110 − 25R` trên cùng tập kiểm tra.
- Kết quả đầu ra: hệ số `a`, `b` và bảng sai số trước/sau.

### Bước A4. Đưa mô hình vào hệ thống (cần chốt, chọn 1)

| Cách | Ưu | Nhược |
|---|---|---|
| **Trong firmware** (đề xuất): thay `110`, `25` bằng `a`, `b` | LCD và web hiện cùng một số; thiết bị chạy độc lập | Đổi hệ số phải nạp lại code |
| Trên web: web tính lại SpO₂ từ `r` | Đổi hệ số không cần nạp lại | LCD và web lệch số nhau |

Dù chọn cách nào, web vẫn lưu `r` thô để sau này hiệu chuẩn lại được mà không cần đo lại.

### Bước A5. Hiển thị trên web
- Ghi chú nhỏ trên thẻ SpO₂: "Đã hiệu chuẩn bằng hồi quy tuyến tính".
- Trang hoặc mục "Mô hình": công thức, số điểm dữ liệu, MAE/RMSE, biểu đồ điểm đo và đường hồi quy.
- Excel: thêm cột `R` vào sheet "Du lieu".

---

## 4. Các bước làm phương án B — dự báo xu hướng (chỉ sửa web)

1. Viết hàm hồi quy bình phương tối thiểu trong `lib/` (khoảng 15 dòng, không cần thư viện), đầu vào là các điểm `(thời gian, giá trị)` của 5 phút gần nhất khi có ngón tay.
2. API trả thêm độ dốc của PR và SpO₂.
3. Dashboard: mũi tên xu hướng cạnh số đo (↑ ↓ →) kèm tốc độ thay đổi; vẽ đường xu hướng nét đứt trên biểu đồ.
4. Cảnh báo sớm mới: "SpO₂ dự kiến xuống dưới 92% trong N phút" khi độ dốc âm đủ lớn. Cần ngưỡng tối thiểu về số điểm và độ dốc để tránh báo sai do nhiễu.
5. Thêm ca kiểm tra vào `npm run selftest`: dữ liệu tuyến tính cho đúng độ dốc; dữ liệu phẳng không sinh cảnh báo.

Phương án C (pin) dùng lại đúng hàm ở bước 1, chỉ thêm một dòng "Còn khoảng N giờ" trên thẻ Pin.

---

## 5. Phiếu kết quả đo (xuất PDF)

Một trang in được, bố cục giống phiếu kết quả của bệnh viện, dùng logo trường. Người dùng chọn khoảng thời gian đo, bấm **In phiếu / Lưu PDF**.

### Bố cục phiếu (khổ A4 dọc)

```
┌──────────────────────────────────────────────────────────┐
│ [LOGO]  TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI     Mã phiếu: … │
│         Pulse Oximeter Monitor                Ngày in: …  │
├──────────────────────────────────────────────────────────┤
│        PHIẾU KẾT QUẢ ĐO SpO₂ VÀ NHỊP MẠCH                 │
│                                                           │
│ Họ tên người đo: ……………   Tuổi: ……   Giới tính: ……          │
│ Thiết bị: esp32-01        Thời gian đo: 08:30 – 08:45     │
├───────────────┬───────────┬───────────┬──────────┬────────┤
│ Chỉ số        │ Trung bình│ Thấp–Cao  │ Tham chiếu│ Đánh giá│
│ SpO₂ (%)      │ 97,4      │ 95 – 99   │ ≥ 92     │ Trong ngưỡng │
│ Nhịp mạch(bpm)│ 78        │ 70 – 91   │ 50 – 120 │ Trong ngưỡng │
│ Chất lượng tín hiệu │ 86% │           │          │        │
├───────────────┴───────────┴───────────┴──────────┴────────┤
│ Biểu đồ SpO₂ và PR trong thời gian đo                     │
│ Cảnh báo trong thời gian đo: (danh sách hoặc "Không có")  │
│ Ghi chú: ……………………………                                      │
├──────────────────────────────────────────────────────────┤
│                              Sinh viên thực hiện          │
│                     Dương Hoàng Anh      Phạm Đức Hảo     │
├──────────────────────────────────────────────────────────┤
│ Thiết bị phục vụ học tập, không dùng để chẩn đoán y tế.   │
└──────────────────────────────────────────────────────────┘
```

> **Trạng thái: đã làm** (trang `/report`, API `/api/report`). Đã chốt dùng lệnh in của trình duyệt.

### Cách làm (đã chốt: cách 1)

| Cách | Ưu | Nhược |
|---|---|---|
| **Trang in + lệnh in của trình duyệt** (đã chọn): trang `/report`, CSS riêng cho bản in, nút gọi hộp thoại in rồi chọn "Lưu thành PDF" | Không thêm thư viện; tiếng Việt và logo hiển thị đúng; dùng lại biểu đồ có sẵn | Người dùng phải bấm thêm một bước "Lưu thành PDF" |
| Tạo file PDF trên server bằng thư viện | Bấm một lần là tải file | Phải thêm dependency mới và nhúng font tiếng Việt; biểu đồ phải vẽ lại |

### Các bước
1. Trang `/report` (cần đăng nhập): ô chọn thời gian bắt đầu, kết thúc; ô nhập họ tên, tuổi, giới tính, ghi chú.
2. Tính thống kê trên khoảng đã chọn, chỉ lấy bản ghi có ngón tay: trung bình, thấp nhất, cao nhất của SpO₂ và PR; chất lượng tín hiệu trung bình; danh sách cảnh báo. Dùng lại `Store.getRange` và `Store.getAlerts`.
3. Dựng phiếu theo bố cục trên; CSS `@media print` ẩn header, menu, nút bấm và đặt khổ A4.
4. Mã phiếu sinh từ thời gian in (ví dụ `PK-20261115-0830`). Giờ theo múi giờ Việt Nam.
5. Thêm mục "Phiếu kết quả" vào menu.
6. Kiểm tra: in ra PDF ở Chrome và Edge, phiếu nằm gọn trong một trang A4.

### Giới hạn phải giữ
- **Không dùng tên, logo hay mẫu biểu của một bệnh viện thật.** Phiếu chỉ mang logo trường và tên đề tài.
- **Không có mục kết luận y khoa.** Cột "Đánh giá" chỉ ghi "Trong ngưỡng" hoặc "Ngoài ngưỡng" theo ngưỡng cảnh báo của đề tài.
- Dòng chú thích học tập in ở chân phiếu. Đây vẫn là nơi duy nhất có chữ "chẩn đoán".
- **Thông tin người đo không lưu trên server**, chỉ điền vào phiếu lúc in. Hệ thống vẫn là một người dùng, một thiết bị.
- Tên sinh viên thực hiện (Dương Hoàng Anh, Phạm Đức Hảo) ghi cố định trên phiếu.

---

## 6. Lộ trình đề xuất

| Bản | Nội dung | Phụ thuộc |
|---|---|---|
| **1.1** | Cải tiến trình diễn: biểu đồ 5 phút, băng cảnh báo đỏ, tim đập theo PR, thẻ thống kê | Không |
| **1.2** | Phiếu kết quả đo xuất PDF (mục 5) — **đã làm** | Không |
| **2.0** | Phương án B (xu hướng + cảnh báo sớm) và bước A1 (gửi `r`, `pi`) | Sửa firmware nhỏ |
| **2.1** | Trang Hiệu chuẩn (A2), thu dữ liệu, huấn luyện (A3) | Máy đo tham chiếu, người tham gia đo |
| **2.2** | Đưa hệ số vào firmware (A4), trang Mô hình (A5), cập nhật Excel | Kết quả 2.1 |

Bản 2.0 không phụ thuộc máy tham chiếu nên làm được ngay. Việc thu dữ liệu ở 2.1 tốn thời gian nhất, nên bắt đầu sớm song song với 2.0.

---

## 7. Hướng mở rộng sau 2.x (chọn theo mục tiêu)

| Hướng | Nội dung | Công sức | Phù hợp khi |
|---|---|---|---|
| **Đưa lên mạng** | Vercel + Supabase: viết bản `Store` và `Auth` mới, giao diện giữ nguyên | Trung bình | Muốn thầy cô mở link trên điện thoại, không phụ thuộc laptop |
| **Thông báo từ xa** | Gửi cảnh báo qua Telegram hoặc email | Thấp | Muốn nhấn mạnh tính ứng dụng theo dõi từ xa |
| **Nhiều người đo** | Hồ sơ người đo, gắn bản ghi theo người, so sánh | Trung bình | Muốn dùng cho nhiều người; cũng giúp bước thu dữ liệu A2 |
| **ML nâng cao** | Phát hiện bất thường, phân loại chất lượng tín hiệu, lọc nhiễu cử động | Cao | Môn học yêu cầu nhiều hơn hồi quy tuyến tính |
| **Ứng dụng điện thoại (PWA)** | Cài web lên màn hình chính, xem toàn màn hình | Thấp | Muốn trình diễn như một ứng dụng |
| **Thêm cảm biến** | Nhiệt độ cơ thể | Trung bình | Có phần cứng; bản 1.0 đã chủ động bỏ |

"Đưa lên mạng" là điều kiện trước của "Thông báo từ xa" nếu muốn chạy không cần laptop bật.

---

## 8. Những thứ sẽ thay đổi so với quyết định đã chốt

- Thêm trang `/report` (phiếu kết quả), là tính năng mới ngoài danh sách bản 1.0.

- Payload thêm 2 trường tùy chọn `r`, `pi` (bản ghi cũ và firmware cũ vẫn dùng được).
- Thêm thư mục `ml/` với môi trường Python riêng.
- Web không cần thêm dependency cho cả phương án A và B.
- Dòng chú thích "Thiết bị phục vụ học tập, không dùng để chẩn đoán y tế." giữ nguyên. Sau khi hiệu chuẩn, thiết bị vẫn là sản phẩm học tập.

## 9. Việc cần nhóm trả lời trước khi bắt đầu

1. Chọn phương án: A + B (đề xuất), chỉ A, hay chỉ B?
2. Có mượn được máy đo SpO₂ thương mại làm tham chiếu không?
3. Ghi số tham chiếu bằng trang Hiệu chuẩn trên web hay ghi tay?
4. Hệ số mô hình đặt trong firmware hay trên web?
5. Ngày báo cáo là khi nào? Lộ trình ở mục 6 cần xếp lại theo mốc này.
6. Phiếu kết quả (đã làm bằng lệnh in của trình duyệt): phiếu có cần thêm thông tin nào khác không (lớp, giảng viên hướng dẫn, khoa)?
