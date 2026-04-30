## 1. Thông tin sinh viên

- **Họ và tên:** Trần Thiện Long
- **MSSV:** 24120373
- **Lớp:** 24CTT4

## 2. Cách cài đặt môi trường

**Yêu cầu chung:**
- Python 3.11 trở lên
- Node.js và npm

**Backend:**

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

Nếu dùng macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Frontend:**

```bash
cd frontend
npm install
cd ..
```

Nếu frontend cần gọi backend ở URL khác mặc định, tạo `frontend/.env.local`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## 3. Hướng dẫn chạy frontend

Mở terminal tại thư mục gốc của dự án, sau đó chạy:

```bash
cd frontend
npm run dev
```

Frontend mặc định chạy tại:

```text
http://localhost:5173
```

Frontend gọi API backend tại:

```text
http://127.0.0.1:8000
```

Có thể đổi URL này bằng `frontend/.env.local` như phần cài đặt.

Lưu ý: cần chạy backend song song để đăng nhập Google và gửi tin nhắn hoạt động.

## 4. Hướng dẫn chạy backend

Mở terminal tại thư mục gốc của dự án, kích hoạt môi trường ảo và chạy server:

```bash
.\.venv\Scripts\activate
uvicorn backend.app.main:app --reload
```

Nếu dùng macOS/Linux:

```bash
source .venv/bin/activate
uvicorn backend.app.main:app --reload
```

Backend mặc định chạy tại:

```text
http://127.0.0.1:8000
```

Lần đầu chạy backend có thể mất thêm thời gian để tải model Hugging Face.

Tài liệu API:

```text
http://127.0.0.1:8000/docs
```

## 5. Video demo

[![Video demo](frontend/public/assets/demo-video-poster.jpg)](https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4)
