# Hướng dẫn cấu hình Render để fix các lỗi còn lại

## 1. Fix lỗi "các trang khác reload là Not Found" (SPA Routing)

### Cấu hình trong Render Dashboard:

1. Đăng nhập Render Dashboard: https://dashboard.render.com
2. Chọn service **Frontend Static Site** (clickjacking-frontend)
3. Vào tab **Redirects/Rewrites**
4. Thêm Rewrite rule:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`
5. Save và đợi deploy

### Lý do:
- React/SPA cần tất cả routes chuyển về index.html để React Router xử lý
- File `_redirects` trong public/ chỉ hoạt động với Netlify, không phải Render

---

## 2. Fix lỗi Cloudinary "Invalid Signature" 

### Kiểm tra biến môi trường trên Backend:

1. Vào Render Dashboard
2. Chọn service **Backend** (clickjacking-backend)
3. Vào tab **Environment**
4. Kiểm tra các biến:

```
CLOUDINARY_CLOUD_NAME=ddduuddmz
CLOUDINARY_API_KEY=<your_api_key>
CLOUDINARY_API_SECRET=<your_api_secret>
```

### Lưu ý quan trọng:
- **KHÔNG có khoảng trắng** ở đầu/cuối giá trị
- Copy chính xác từ Cloudinary Dashboard
- API Secret thường dài ~27 ký tự

### Lấy thông tin từ Cloudinary:
1. Vào https://cloudinary.com/console
2. Vào Dashboard
3. Copy chính xác: Cloud Name, API Key, API Secret

---

## 3. Các thay đổi đã commit

### Backend:
- `blog.controller.js`: Upload ảnh blog lên Cloudinary khi NODE_ENV=production
- `review.controller.js`: Upload media review lên Cloudinary khi production
- `cloudinary.config.js`: Thêm debug log để kiểm tra cấu hình

### Frontend:
- `Home.js`: Sửa logic hiển thị ảnh blog (hỗ trợ Cloudinary URL)
- `render.yaml`: File cấu hình Render (tham khảo)

---

## 4. Test sau khi deploy

### Test 1: SPA Routing
- Vào https://clickjacking-frontend.onrender.com/products
- Nhấn F5 (reload)
- Kết quả mong đợi: Trang products hiển thị bình thường

### Test 2: VNPAY Payment
- Đặt hàng với VNPAY
- Thanh toán
- Kết quả mong đợi: Redirect về /payment-result thành công

### Test 3: Upload ảnh Blog (Admin)
- Đăng nhập admin
- Tạo/Sửa blog với ảnh mới
- Kết quả mong đợi: Ảnh upload lên Cloudinary và hiển thị

### Test 4: Upload ảnh Review (User)
- Đăng nhập user
- Đánh giá sản phẩm với ảnh
- Kết quả mong đợi: Ảnh upload lên Cloudinary và hiển thị

---

## Troubleshooting

### Nếu Cloudinary vẫn báo Invalid Signature:
1. Regenerate API Secret trong Cloudinary Dashboard
2. Cập nhật lại CLOUDINARY_API_SECRET trong Render
3. Restart backend service

### Nếu VNPAY vẫn 404:
1. Kiểm tra code đã deploy chưa (xem Deploy Logs trên Render)
2. Kiểm tra route `/payment-result` tồn tại trong React Router

### Xem logs:
1. Render Dashboard → Backend → Logs
2. Tìm dòng `🔧 Cloudinary Config:` để xác nhận config đã load
