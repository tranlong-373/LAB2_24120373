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

Tạo file `.streamlit/secrets.toml` để cấu hình Firebase và Google OAuth. File này đã được `.gitignore`, mỗi máy tự tạo bằng thông tin Firebase/Google Cloud của máy đó:

```toml
[firebase_client]
apiKey = "FIREBASE_WEB_API_KEY"

[firebase_admin]
type = "service_account"
project_id = "YOUR_PROJECT_ID"
private_key_id = "YOUR_PRIVATE_KEY_ID"
private_key = "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
client_email = "firebase-adminsdk-xxx@YOUR_PROJECT_ID.iam.gserviceaccount.com"
client_id = "YOUR_CLIENT_ID"
auth_uri = "https://accounts.google.com/o/oauth2/auth"
token_uri = "https://oauth2.googleapis.com/token"
auth_provider_x509_cert_url = "https://www.googleapis.com/oauth2/v1/certs"
client_x509_cert_url = "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxx%40YOUR_PROJECT_ID.iam.gserviceaccount.com"
universe_domain = "googleapis.com"

[google_login]
google_client_id = "GOOGLE_OAUTH_CLIENT_ID"
google_client_secret = "GOOGLE_OAUTH_CLIENT_SECRET"
google_redirect_uri = "http://127.0.0.1:8000/auth/google/callback"
frontend_url = "http://localhost:5173"
allowed_frontend_urls = ["http://127.0.0.1:5173", "http://localhost:5173"]
```

Trong Google Cloud Console, thêm đúng `google_redirect_uri` vào **Authorized redirect URIs**. Nếu chạy frontend bằng IP/LAN trên máy khác, thêm URL đó vào `allowed_frontend_urls`.

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

Video demo sẽ được bổ sung sau.
