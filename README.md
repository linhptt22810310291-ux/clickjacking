# 👟 WEBSITE BÁN GIÀY LILLYSHOES - BẢO MẬT NÂNG CAO

## 📋 THÔNG TIN DỰ ÁN

| Thông tin | Chi tiết |
|-----------|----------|
| **Tên dự án** | Website bán giày LillyShoes |
| **Môn học** | Phát triển phần mềm web |
| **Nhóm thực hiện** | Phạm Thị Thùy Linh (22810310291) |
|                    | Võ Thị Kim Liên (22810310261) |
|                    | Nguyễn Thị Hoài Sương (22810310254) |

---

## 🎯 MỤC TIÊU DỰ ÁN

Xây dựng website thương mại điện tử bán giày với:
1. ✅ Đầy đủ chức năng mua bán online
2. ✅ Hệ thống quản trị Admin
3. ✅ **Bảo mật nâng cao** - Phòng chống các loại tấn công web

---

## 🛠️ CÔNG NGHỆ SỬ DỤNG

### Backend
| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| Node.js | 18+ | Runtime JavaScript |
| Express.js | 5.1.0 | Web Framework |
| Sequelize | 6.37.7 | ORM Database |
| SQL Server | 2019+ | Cơ sở dữ liệu |
| JWT | 9.0.2 | Xác thực người dùng |
| Bcrypt | 3.0.2 | Mã hóa mật khẩu |

### Frontend
| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|----------|
| React.js | 18.3.1 | UI Library |
| Redux Toolkit | 2.9.2 | State Management |
| React Bootstrap | 2.10.10 | UI Components |
| Axios | 1.12.2 | HTTP Client |

---

## 📁 CẤU TRÚC DỰ ÁN

```
Webgiay/
├── backend/                    # Server API
│   ├── config/                 # Cấu hình database
│   ├── controllers/            # Xử lý logic API
│   ├── middleware/             # 🛡️ Middleware bảo mật
│   │   ├── security.middleware.js     # Rate Limiting, Helmet
│   │   ├── antiClickjacking.js        # Chống Clickjacking
│   │   ├── firewall.middleware.js     # Firewall, IP Blocking
│   │   ├── captcha.middleware.js      # CAPTCHA
│   │   ├── session.middleware.js      # Quản lý session
│   │   └── botDetection.js            # Phát hiện bot
│   ├── models/                 # Định nghĩa database models
│   ├── routes/                 # Định nghĩa API endpoints
│   ├── services/               # Business logic
│   ├── utils/                  # Hàm tiện ích, logging
│   └── server.js               # Entry point server
│
├── frontend/                   # Giao diện người dùng
│   ├── public/
│   │   └── index.html          # 🛡️ Chứa Anti-Clickjacking JS
│   └── src/
│       ├── components/         # React components
│       ├── pages/              # Các trang website
│       │   ├── user/           # Trang khách hàng
│       │   └── admin/          # Trang quản trị
│       ├── redux/              # State management
│       └── api/                # API client
│
└── README.md                   # Tài liệu này
```

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT

### Bước 1: Cài đặt phần mềm cần thiết
- Node.js 18+ (https://nodejs.org)
- SQL Server 2019+ 
- SQL Server Management Studio (SSMS)

### Bước 2: Tạo Database
```sql
-- Mở SSMS, chạy lệnh:
CREATE DATABASE ShoeStoreDB911;
GO
-- Sau đó import file SQL được cung cấp
```

### Bước 3: Cài đặt Dependencies
```powershell
# Terminal 1 - Backend
cd backend
npm install

# Terminal 2 - Frontend  
cd frontend
npm install
```

### Bước 4: Cấu hình Backend
Chỉnh sửa file `backend/config/database.json`:
```json
{
  "development": {
    "username": "sa",
    "password": "YOUR_PASSWORD",
    "database": "ShoeStoreDB911",
    "host": "localhost",
    "dialect": "mssql"
  }
}
```

### Bước 5: Chạy ứng dụng
```powershell
# Terminal 1 - Backend (port 5000)
cd backend
npm start

# Terminal 2 - Frontend (port 3000)
cd frontend
npm start
```

### Bước 6: Truy cập website
- **Website khách hàng:** http://localhost:3000
- **Trang Admin:** http://localhost:3000/admin

---

## 👤 TÀI KHOẢN DEMO

| Vai trò | Email | Password |
|---------|-------|----------|
| **Admin** | admin@example.com | Linh2308@ |
| **User** | user1@example.com | User123456 |

---

# 🛡️ PHẦN 2: HỆ THỐNG BẢO MẬT

## 📊 TỔNG QUAN CÁC LỚP BẢO VỆ

Website được bảo vệ bởi **9 lớp bảo mật**:

| # | Lớp bảo vệ | Chống tấn công | Trạng thái |
|---|------------|----------------|------------|
| 1 | **Rate Limiting** | Bot Attack, DDoS, Brute Force | ✅ BẬT |
| 2 | **Firewall** | Malicious IPs | ✅ BẬT |
| 3 | **Anti-Clickjacking** | Clickjacking, UI Redress | ✅ BẬT |
| 4 | **Helmet** | XSS, Info Leak | ✅ BẬT |
| 5 | **Data Sanitization** | SQL Injection, XSS | ✅ BẬT |
| 6 | **CAPTCHA** | Automated Login | ✅ BẬT |
| 7 | **Session Management** | Session Hijacking | ✅ BẬT |
| 8 | **Activity Detection** | Unknown Patterns | ✅ BẬT |
| 9 | **JWT Authentication** | Unauthorized Access | ✅ BẬT |

---

## 🔐 CHI TIẾT TỪNG LỚP BẢO VỆ

### 1️⃣ RATE LIMITING (Giới hạn tần suất request)

**🎯 Mục đích:** Ngăn bot gửi quá nhiều request trong thời gian ngắn.

**📍 File:** `backend/middleware/security.middleware.js`

**⚙️ Cấu hình:**
| Endpoint | Giới hạn | Thời gian | Khi vượt quá |
|----------|----------|-----------|--------------|
| API công khai (`/api/*`) | **15 requests** | 1 phút | HTTP 429 + Chặn |
| Đăng nhập (`/api/auth/login`) | **5 lần** | 15 phút | Chặn + CAPTCHA |
| Đăng ký (`/api/auth/register`) | **3 lần** | 15 phút | Chặn |

**🔄 Cách hoạt động:**
```
Request 1-15:  ✅ Cho phép
Request 16:    🚫 Chặn → HTTP 429 "Too Many Requests"
               ⏰ Đợi 1 phút để tiếp tục
```

**💻 Code:**
```javascript
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 phút
  max: 15,              // Tối đa 15 requests
  message: {
    success: false,
    message: '🚫 Quá nhiều request! Vui lòng đợi 1 phút.'
  }
});
```

---

### 2️⃣ FIREWALL (Tường lửa)

**🎯 Mục đích:** Chặn các IP độc hại đã được nhận diện.

**📍 File:** `backend/middleware/firewall.middleware.js`

**🔄 Cách hoạt động:**
1. Mỗi request → Kiểm tra IP trong blacklist
2. Nếu IP bị block → Chặn ngay (HTTP 403)
3. IP tự động bị block khi:
   - Gửi >10 requests đáng ngờ
   - Có pattern tấn công (SQLi, XSS)
   - Truy cập nhiều URL không tồn tại

---

### 3️⃣ ANTI-CLICKJACKING (Chống nhúng iframe)

**🎯 Mục đích:** Ngăn website bị nhúng vào iframe của trang độc hại.

**📍 Files:** 
- Backend: `backend/middleware/antiClickjacking.js`
- Frontend: `frontend/public/index.html`

**🔒 Headers được set:**
```
X-Frame-Options: DENY
Content-Security-Policy: frame-ancestors 'none'
```

**🔄 Cách hoạt động:**

**Phía Backend:**
```javascript
// Middleware set headers
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
```

**Phía Frontend (quan trọng!):**
```html
<!-- File: frontend/public/index.html -->

<!-- CSP Meta Tag -->
<meta http-equiv="Content-Security-Policy" content="frame-ancestors 'none'">

<!-- Frame-Busting JavaScript -->
<script>
  var ENABLE_CLICKJACKING_PROTECTION = true;  // BẬT/TẮT tại đây
  
  if (ENABLE_CLICKJACKING_PROTECTION && self !== top) {
    // Website đang bị nhúng trong iframe → CHẶN!
    document.body.innerHTML = '<h1>🚫 BLOCKED - Clickjacking Protection Active</h1>';
  }
</script>
```

---

## 🎮 HƯỚNG DẪN BẬT/TẮT BẢO VỆ CLICKJACKING (CHO DEMO)

### Bước 1: Mở file cấu hình
```
Mở file: frontend/public/index.html
```

### Bước 2: Tìm dòng này (khoảng dòng 17)
```javascript
var ENABLE_CLICKJACKING_PROTECTION = true;  // true = BẬT | false = TẮT
```

### Bước 3: Thay đổi giá trị

| Để làm gì | Đổi thành | Kết quả |
|-----------|-----------|---------|
| **TẮT bảo vệ** (demo tấn công thành công) | `= false` | Website CÓ THỂ bị nhúng vào iframe |
| **BẬT bảo vệ** (demo chặn tấn công) | `= true` | Iframe hiện màn đỏ "BLOCKED" |

### Bước 4: Restart Frontend
```powershell
# Dừng frontend (Ctrl+C) rồi chạy lại
cd frontend
npm start
```

### Bước 5: Reload trang demo
```
Mở lại file: backend/attacks/2-clickjacking-demo.html
Nhấn "Reload Iframe" để test
```

---

### 4️⃣ HELMET (HTTP Security Headers)

**🎯 Mục đích:** Thêm các HTTP headers bảo mật chuẩn.

**📍 File:** `backend/middleware/security.middleware.js`

**🔒 Headers được set:**

| Header | Giá trị | Chức năng |
|--------|---------|-----------|
| `X-Content-Type-Options` | `nosniff` | Ngăn browser đoán MIME type |
| `X-XSS-Protection` | `1; mode=block` | Bật XSS filter |
| `X-Powered-By` | *(removed)* | Ẩn thông tin server |
| `Referrer-Policy` | `strict-origin` | Giới hạn referrer info |

---

### 5️⃣ DATA SANITIZATION (Lọc dữ liệu)

**🎯 Mục đích:** Ngăn chặn injection attacks.

**📍 File:** `backend/middleware/security.middleware.js`

**🛡️ Bảo vệ khỏi:**

| Tấn công | Input độc hại | Sau khi lọc |
|----------|---------------|-------------|
| **SQL Injection** | `' OR 1=1 --` | `'' OR 1=1 --` (escape quotes) |
| **XSS** | `<script>alert(1)</script>` | `&lt;script&gt;...` (encode) |
| **NoSQL Injection** | `{ "$ne": "" }` | `"[object Object]"` |

---

### 6️⃣ CAPTCHA

**🎯 Mục đích:** Phân biệt người thật và bot.

**📍 File:** `backend/middleware/captcha.middleware.js`

**🔄 Khi nào hiện CAPTCHA:**
- Đăng nhập sai **3 lần** liên tiếp
- Phát hiện hành vi đáng ngờ

---

### 7️⃣ SESSION MANAGEMENT

**🎯 Mục đích:** Quản lý phiên đăng nhập an toàn.

**📍 File:** `backend/middleware/session.middleware.js`

**⚙️ Cấu hình:**
- Tối đa **3 phiên** đồng thời / user
- Timeout: **30 phút** không hoạt động
- JWT hết hạn sau **7 ngày**

---

## 🧪 HƯỚNG DẪN DEMO BẢO MẬT

### 📋 CHUẨN BỊ TRƯỚC KHI DEMO

```powershell
# 1. Khởi động Backend
cd backend
npm start
# Đợi thấy: "🚀 Backend đang chạy tại http://localhost:5000"

# 2. Khởi động Frontend (terminal mới)
cd frontend
npm start
# Đợi thấy: "Compiled successfully!"
# Browser tự mở http://localhost:3000
```

---

### 🎬 DEMO 1: BOT ATTACK & RATE LIMITING

**Mục đích:** Chứng minh hệ thống chặn được bot gửi request liên tục

**Bước 1:** Mở file demo
```
Trình duyệt → File → Open File
Chọn: backend/attacks/1-bot-attack-demo.html
```

**Bước 2:** Cấu hình tấn công
```
- Target URL: http://localhost:5000 (mặc định)
- Attack Type: "Rapid Fire" hoặc "Voucher Hunt"
```

**Bước 3:** Nhấn "🚀 Bắt Đầu Tấn Công"

**Kết quả mong đợi:**
```
✅ Request 1-15:  200 OK (Thành công)
🚫 Request 16+:  429 Too Many Requests (Bị chặn)

Biểu đồ sẽ hiện:
- Cột xanh: Requests thành công
- Cột đỏ: Requests bị chặn
```

**Giải thích cho thầy:**
> "Hệ thống giới hạn mỗi IP chỉ được gửi 15 requests/phút. Khi bot gửi quá giới hạn, các request tiếp theo bị chặn với HTTP 429."

---

### 🎬 DEMO 2: CLICKJACKING PROTECTION

**Mục đích:** Chứng minh website không thể bị nhúng vào iframe độc hại

#### PHẦN A: Demo khi BẬT bảo vệ (chặn thành công)

**Bước 1:** Đảm bảo bảo vệ đang BẬT
```
Kiểm tra file frontend/public/index.html:
var ENABLE_CLICKJACKING_PROTECTION = true;  // Phải là TRUE
```

**Bước 2:** Mở file demo
```
Trình duyệt → Open File
Chọn: backend/attacks/2-clickjacking-demo.html
```

**Bước 3:** Quan sát kết quả
```
- Iframe sẽ KHÔNG hiển thị được website
- Hoặc hiện màn đỏ "🚫 BLOCKED"
- Kéo slider Opacity để thấy rõ
```

**Giải thích cho thầy:**
> "Khi bảo vệ BẬT, website set header X-Frame-Options: DENY và có JavaScript frame-busting. Browser từ chối hiển thị trang trong iframe, kẻ tấn công không thể lừa user click vào nút ẩn."

#### PHẦN B: Demo khi TẮT bảo vệ (bị tấn công)

**Bước 1:** TẮT bảo vệ
```
Mở file: frontend/public/index.html
Đổi: var ENABLE_CLICKJACKING_PROTECTION = false;
Save file
```

**Bước 2:** Restart Frontend
```powershell
# Dừng frontend (Ctrl+C) rồi chạy lại
cd frontend
npm start
```

**Bước 3:** Reload demo và quan sát
```
- Iframe HIỂN THỊ được website LillyShoes
- Kéo slider Opacity → Thấy nút "NHẬN QUÀ" đè lên nút thật
- User nghĩ click "Nhận quà" nhưng thực ra click vào website thật!
```

**Bước 4:** BẬT LẠI bảo vệ sau demo!
```
Đổi lại: var ENABLE_CLICKJACKING_PROTECTION = true;
Restart frontend
```

---

### 🎬 DEMO 3: BRUTE FORCE PROTECTION

**Mục đích:** Chứng minh hệ thống chặn việc thử đăng nhập liên tục

**Bước 1:** Mở file demo
```
Mở: backend/attacks/3-bruteforce-demo.html
```

**Bước 2:** Cấu hình
```
- API URL: http://localhost:5000/api/auth/login
- Username: admin@example.com
- Password sẽ thử random
```

**Bước 3:** Nhấn "Start Attack"

**Kết quả mong đợi:**
```
Lần 1-3:  ❌ "Sai mật khẩu" 
Lần 4:    ❌ "Sai mật khẩu" + Yêu cầu CAPTCHA
Lần 5-6:  🚫 "Quá nhiều lần thử. Vui lòng đợi 15 phút"
```

**Giải thích:**
> "Hệ thống giới hạn 5 lần đăng nhập sai / 15 phút. Sau 3 lần sai, yêu cầu CAPTCHA. Sau 5 lần, block hoàn toàn IP trong 15 phút."

---

## 📊 SECURITY DASHBOARD (Admin)

Website có trang giám sát bảo mật cho Admin:

**Truy cập:** 
1. Đăng nhập Admin: http://localhost:3000/login
2. Vào Admin Dashboard
3. Menu trái → "Security Monitor"

**Hoặc trực tiếp:** http://localhost:3000/admin/security

**Tính năng:**
- 📈 Thống kê số request bị chặn
- 🚫 Danh sách IP bị block
- 📋 Log các cuộc tấn công gần đây
- 🔓 Nút xóa blacklist (Clear Blacklist)

---

## 📁 DANH SÁCH FILE QUAN TRỌNG

### Files Bảo mật Backend:
| File | Chức năng |
|------|-----------|
| `middleware/security.middleware.js` | Rate Limiting, Helmet, Sanitization |
| `middleware/antiClickjacking.js` | X-Frame-Options, CSP |
| `middleware/firewall.middleware.js` | IP Blocking |
| `middleware/captcha.middleware.js` | CAPTCHA |
| `middleware/session.middleware.js` | Session Management |

### Files Demo Tấn công:
| File | Demo gì |
|------|---------|
| `attacks/1-bot-attack-demo.html` | Bot Attack, Rate Limiting |
| `attacks/2-clickjacking-demo.html` | Clickjacking |
| `attacks/3-bruteforce-demo.html` | Brute Force |

### File Frontend quan trọng:
| File | Vai trò |
|------|---------|
| `public/index.html` | Chứa cấu hình BẬT/TẮT Anti-Clickjacking |

---

## ⚠️ LƯU Ý QUAN TRỌNG

### ✅ Checklist trước khi Demo:
- [ ] Backend đang chạy (port 5000)
- [ ] Frontend đang chạy (port 3000)
- [ ] Đã test thử các file demo
- [ ] Biết cách bật/tắt clickjacking protection

### 🚫 Sau khi Demo nhớ:
- [ ] BẬT lại `ENABLE_CLICKJACKING_PROTECTION = true`
- [ ] Restart frontend nếu đã thay đổi

### 🔐 Khi Deploy Production:
- [ ] KHÔNG deploy thư mục `attacks/`
- [ ] Đổi JWT_SECRET thành giá trị mạnh
- [ ] Bật HTTPS
- [ ] Giữ `ENABLE_CLICKJACKING_PROTECTION = true`

---

## 📞 LIÊN HỆ

**Nhóm thực hiện:**
- Phạm Thị Thùy Linh - 22810310291
- Võ Thị Kim Liên - 22810310261  
- Nguyễn Thị Hoài Sương - 22810310254

**GitHub:** https://github.com/HoaiSuong28/clickjacking-demo

---

*Tài liệu cập nhật: 28/11/2025*
