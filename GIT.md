# Hướng dẫn đưa dự án lên GitHub (Windows)

Các lệnh dưới đây chạy trong **PowerShell**.

> **Quy tắc quan trọng nhất:** không bao giờ đẩy `web/.env.local` lên GitHub, vì file này chứa mật khẩu và khóa thật.
> File này đã có trong `web/.gitignore`, nhưng vẫn phải kiểm tra lại bằng `git status` trước mỗi lần commit.

---

## 1. Cài đặt (chỉ làm lần đầu)

Kiểm tra Git:
```powershell
git --version
```
Nếu chưa có, tải tại https://git-scm.com/download/win, cài với các tùy chọn mặc định, rồi mở lại PowerShell.

Khai báo tên và email (dùng email của tài khoản GitHub):
```powershell
git config --global user.name "Tên của bạn"
git config --global user.email "email-github-của-bạn"
```

---

## 2. Tạo repo trống trên GitHub

1. Vào https://github.com/new
2. **Repository name**: ví dụ `BTL_Y_SINH`
3. Chọn **Private** nếu chưa muốn công khai.
4. **Không** tích *Add a README*, *.gitignore* hay *license*, vì máy bạn đã có sẵn.
5. Bấm **Create repository** và copy URL repo: `https://github.com/<tên-bạn>/BTL_Y_SINH.git`

---

## 3. Khởi tạo Git trên máy

Đặt repo ở **thư mục gốc** `D:\STUDY\DIEN_TU_Y_SINH`, để sau này `firmware\`, `hardware\`, `docs\` nằm chung một repo với `web\`.

Nếu trước đó đã lỡ chạy `git init` trong `web\`, hãy xóa repo đó đi trước. Chỉ làm việc này khi repo đó **chưa có commit nào**; kiểm tra bằng `git log` trong `web\`, nếu báo *does not have any commits yet* là xóa được:
```powershell
cd D:\STUDY\DIEN_TU_Y_SINH\web
Remove-Item -Recurse -Force .git
```

Khởi tạo ở thư mục gốc:
```powershell
cd D:\STUDY\DIEN_TU_Y_SINH
git init -b main
git add .
```

---

## 4. Kiểm tra trước khi commit

```powershell
git status
```

**Không được xuất hiện** trong danh sách:

| Không được có | Lý do |
|---|---|
| `web/.env.local` | Chứa mật khẩu và khóa thật |
| `web/node_modules/` | Thư viện, tải lại được bằng `npm install` |
| `web/.next/` | File build, tự sinh |
| `web/data/` | Dữ liệu đo trên máy bạn |
| `web/.claude/` | Cấu hình riêng của Claude Code |

**Nên có:** `web/.env.example`, `web/.gitignore`, `web/app/`, `web/lib/`, `web/components/`, `web/scripts/`, `web/public/logo.jpg`, `web/design/`, `web/package.json`, `web/package-lock.json`, `web/README.md`, `web/RUN.md`, `web/GIT.md`, `web/AGENTS.md`.

Nếu lỡ thấy `.env.local` trong danh sách:
```powershell
git rm --cached web/.env.local
```
Sau đó kiểm tra lại `web/.gitignore` có dòng `.env.local` chưa.

---

## 5. Commit và đẩy lên GitHub

```powershell
git commit -m "Web dashboard Pulse Oximeter Monitor"
git remote add origin https://github.com/<tên-bạn>/BTL_Y_SINH.git
git push -u origin main
```

Lần push đầu, Windows sẽ mở cửa sổ đăng nhập. Chọn **Sign in with your browser** và đăng nhập GitHub.

Sau khi push, mở trang repo trên GitHub và kiểm tra **không có** file `.env.local`.

---

## 6. Những lần cập nhật sau

```powershell
cd D:\STUDY\DIEN_TU_Y_SINH
git status                       # xem file nào thay đổi
git add .
git commit -m "Mô tả ngắn thay đổi"
git push
```

Nên commit sau mỗi phần việc hoàn chỉnh, ví dụ "Thêm firmware đọc MAX30102" hoặc "Sửa màu biểu đồ".

---

## 7. Tải dự án về máy khác / cho thành viên nhóm

```powershell
git clone https://github.com/<tên-bạn>/BTL_Y_SINH.git
cd BTL_Y_SINH\web
npm install
copy .env.example .env.local
notepad .env.local               # điền DEVICE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD, SESSION_SECRET
npm run dev
```

Nếu repo là Private, thành viên nhóm phải được mời vào: trên GitHub vào **Settings → Collaborators → Add people**.

Lấy bản mới nhất khi người khác đã push:
```powershell
git pull
npm install                      # nếu package.json thay đổi
```

---

## 8. Lệnh hay dùng

| Lệnh | Tác dụng |
|---|---|
| `git status` | Xem file thay đổi, file chuẩn bị commit |
| `git diff` | Xem chi tiết nội dung đã sửa |
| `git log --oneline` | Xem lịch sử commit |
| `git restore <file>` | Hủy sửa đổi chưa commit của một file (**mất thay đổi**) |
| `git pull` | Lấy code mới từ GitHub |
| `git push` | Đẩy commit lên GitHub |

---

## 9. Sự cố thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `remote origin already exists` | Đã gắn remote rồi. Đổi URL: `git remote set-url origin <URL>` |
| `rejected ... fetch first` khi push | Trên GitHub có commit mà máy chưa có (ví dụ lúc tạo repo đã tích README). Chạy `git pull --rebase origin main` rồi `git push` |
| `Reinitialized existing Git repository` | Thư mục đó đã có repo. Xem lại mục 3 |
| Lỡ đẩy `.env.local` lên GitHub | Xóa khỏi repo **chưa đủ**, vì file vẫn còn trong lịch sử. **Đổi ngay** `ADMIN_PASSWORD`, `DEVICE_KEY`, `SESSION_SECRET` trong `.env.local`, rồi chạy `git rm --cached web/.env.local`, commit và push |
| `AGENTS.md` tự xuất hiện lại | Do `next dev` tự sinh. Cứ commit file này |
