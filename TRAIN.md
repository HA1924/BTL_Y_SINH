# Hướng dẫn lấy mẫu hiệu chuẩn SpO₂

Mục tiêu: thu khoảng **100 điểm dữ liệu từ 8–10 người**. Mỗi điểm ghép **số SpO₂ của máy đo tham chiếu** với **tỉ số R do thiết bị của nhóm đo cùng lúc**. Dữ liệu này dùng để huấn luyện hồi quy tuyến tính `SpO₂ = a + b × R`, thay cho công thức sách `110 − 25 × R` trong firmware.

Thời gian: khoảng **10–15 phút cho mỗi người**.

---

## 1. Chuẩn bị (làm một lần)

### Thiết bị cần có
- Mạch ESP32 + MAX30102, pin đầy hoặc cắm nguồn.
- **Máy đo SpO₂ kẹp ngón tay** mua sẵn (máy tham chiếu), pin còn tốt.
- Laptop chạy web, và một điện thoại để nhập số (không bắt buộc nhưng tiện hơn).
- Laptop, ESP32 và điện thoại kết nối **cùng một mạng WiFi** (nên dùng hotspot riêng).

### Nạp firmware mới
Firmware phải là bản **có gửi `r` và `pi`**.
1. Mở `firmware/pulse_oximeter/pulse_oximeter.ino` bằng Arduino IDE và nạp vào ESP32.
2. Mở Serial Monitor ở 115200 baud, đặt ngón tay lên cảm biến.
3. Kiểm tra dòng log có dạng:
   ```
   [net] POST 201 {..., "finger":true, "r":0.5123, "pi":1.85}
   ```
   Thấy `201` và có `"r":` khác 0 là được.

### Chạy web
```powershell
cd D:\STUDY\DIEN_TU_Y_SINH\web
npm run dev
```
- Trên laptop: mở http://localhost:3000/calibration và đăng nhập.
- Trên điện thoại: xem IP laptop bằng `ipconfig` (dòng IPv4), rồi mở `http://<IP-laptop>:3000/calibration`.

### Thử trước khi đo thật
Một người trong nhóm đeo hai máy, chờ trang báo **Sẵn sàng lưu**, lưu thử 1 điểm, rồi bấm **Xóa** để bỏ điểm thử.

---

## 2. Quy tắc chung khi đo

| Nên | Không nên |
|---|---|
| Ngồi thẳng, tay đặt trên bàn ngang tim | Đứng, đi lại, nói chuyện khi đang đo |
| Hai máy kẹp **hai ngón cạnh nhau, cùng một tay** | Kẹp hai máy ở hai tay khác nhau |
| Chờ khoảng 30 giây cho cả hai máy ổn định | Lưu ngay khi số vừa hiện |
| Đọc số máy tham chiếu **khi số đã đứng yên** | Lưu khi số đang nhảy |
| Tránh ánh sáng mạnh chiếu vào cảm biến | Đo dưới nắng hoặc đèn rọi trực tiếp |
| Tháo nhẫn, lau sạch ngón tay | Đo khi sơn móng tay sẫm màu |

**An toàn:** không nín thở lâu, không tự làm hạ SpO₂ bằng bất kỳ cách nào để lấy điểm thấp. Dừng ngay nếu người đo thấy chóng mặt hay khó chịu.

---

## 3. Quy trình cho mỗi người

### Bước 1. Ghi mã người đo
- Đặt mã theo thứ tự: `N01`, `N02`, `N03`...
- **Không ghi họ tên đầy đủ** trên web. Nếu cần, ghi bảng đối chiếu mã–tên ra giấy riêng.
- Hỏi ý kiến người đo trước khi bắt đầu.

### Bước 2. Thu khoảng 12 điểm theo bảng sau

| Lượt | Tay | Ngón | Ghi chú gợi ý | Số điểm |
|---|---|---|---|---|
| 1 | Phải | Trỏ | `tro phai` | 3 |
| 2 | Phải | Giữa | `giua phai` | 3 |
| 3 | Trái | Trỏ | `tro trai` | 3 |
| 4 | Trái | Giữa | `giua trai` | 3 |

Có thể thêm 2–3 điểm với **tay hơi lạnh** (sau khi rửa tay bằng nước mát), ghi chú `tay lanh`.

### Bước 3. Lưu từng điểm
1. Kẹp máy tham chiếu và cảm biến nhóm vào hai ngón cạnh nhau theo bảng trên.
2. Ngồi yên. Chờ ô trạng thái trên web chuyển sang **Sẵn sàng lưu** (màu xanh).
3. Nhìn **số SpO₂ trên máy tham chiếu**, gõ vào ô **SpO₂ máy tham chiếu**.
   - Nếu tiện, gõ cả nhịp mạch (PR) của máy tham chiếu.
4. Bấm **Lưu điểm**. Trang hiện "Đã lưu điểm #N".
5. **Chờ khoảng 20 giây**, rồi lặp lại từ bước 3 cho điểm tiếp theo.
6. Sau 3 điểm, đổi sang ngón tiếp theo trong bảng và đợi lại 30 giây.

### Nếu nút Lưu bị khóa
| Thông báo | Cách xử lý |
|---|---|
| Thiết bị đang ngoại tuyến | Kiểm tra ESP32 còn nguồn, còn WiFi; xem Serial Monitor |
| Chưa đặt ngón tay | Đặt lại ngón tay ngay ngắn trên cảm biến |
| Chưa đủ số đo R | Chờ thêm 10 giây. Nếu vẫn báo, ESP32 đang chạy firmware cũ |
| Tín hiệu kém | Chỉnh lại ngón, không ấn quá mạnh, tránh ánh sáng |
| Số đo chưa ổn định | Giữ yên tay thêm vài giây |

### Nếu nhập nhầm
Tìm dòng đó trong bảng **Dữ liệu đã thu**, bấm **Xóa**, rồi đo lại điểm đó.

---

## 4. Danh sách người đo

Nên đa dạng để mô hình dùng được cho nhiều người:
- Cả nam và nữ.
- Ngón tay to và nhỏ.
- Màu da khác nhau nếu có thể.

| Mã | Giới tính | Đã đo (số điểm) | Ghi chú |
|---|---|---|---|
| N01 | | | |
| N02 | | | |
| N03 | | | |
| N04 | | | |
| N05 | | | |
| N06 | | | |
| N07 | | | |
| N08 | | | |
| N09 | | | |
| N10 | | | |

Thanh **Số điểm** và **Số người** trên trang Hiệu chuẩn cho biết đã đạt mục tiêu chưa (100 điểm, 8 người).

---

## 5. Sau mỗi buổi đo

1. Bấm **Tải CSV** trên trang Hiệu chuẩn. File `hieu_chuan_spo2.csv` chứa toàn bộ điểm.
2. **Sao lưu file CSV** (Google Drive, USB...). Dữ liệu gốc nằm trong `web\data\calibration.ndjson` và **không được đưa lên GitHub**.
3. Xem lại bảng: nếu có điểm SpO₂ tham chiếu lệch hẳn so với các điểm còn lại của cùng người (ví dụ 85 trong khi các điểm khác là 97–98), nhiều khả năng là gõ nhầm, nên xóa.

---

## 6. Ý nghĩa các cột trong file CSV

| Cột | Ý nghĩa |
|---|---|
| `thoi_gian` | Lúc lưu điểm (giờ Việt Nam) |
| `nguoi_do` | Mã người đo |
| `ghi_chu` | Ngón, tay, điều kiện đo |
| `spo2_tham_chieu` | SpO₂ đọc trên máy tham chiếu — **giá trị mô hình cần học ra** |
| `pr_tham_chieu` | PR đọc trên máy tham chiếu (có thể trống) |
| `r` | Tỉ số R trung bình 15 giây của thiết bị — **đầu vào của mô hình** |
| `pi` | Chỉ số tưới máu (%) của thiết bị |
| `spo2_thiet_bi` | SpO₂ thiết bị hiện tại (công thức cũ), dùng để so sánh trước/sau |
| `pr_thiet_bi` | PR thiết bị |
| `chat_luong` | Chất lượng tín hiệu trung bình (0–1) |
| `so_mau` | Số bản ghi đã lấy trung bình (thường là 3) |

---

## 7. Bước tiếp theo

Khi đã có khoảng 100 điểm từ ít nhất 8 người, gửi file CSV cho bước **huấn luyện** (bước A3 trong `PLAN_2.0.md`):
- Huấn luyện hồi quy tuyến tính `SpO₂ = a + b × R` bằng Python.
- Đánh giá bằng cách bỏ riêng từng người ra để kiểm tra.
- So sánh sai số của công thức mới với công thức cũ `110 − 25 × R`.
- Đưa hệ số `a`, `b` mới vào firmware.

---

## 8. Giới hạn cần ghi trong báo cáo

- Người khỏe mạnh có SpO₂ khoảng **95–100%**, nên dữ liệu hầu như không có điểm thấp. Mô hình chỉ đáng tin trong khoảng đã đo.
- Máy tham chiếu mua sẵn cũng có sai số riêng (thường khoảng ±2%), nên kết quả là "khớp với máy tham chiếu", không phải "chính xác tuyệt đối".
- Thiết bị là sản phẩm học tập, không dùng thay thiết bị y tế.
