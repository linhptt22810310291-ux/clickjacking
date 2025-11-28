-- Cập nhật tất cả tài khoản admin: auto-verify email
UPDATE Users 
SET IsEmailVerified = 1, 
    HasReceivedWelcomeVoucher = 0  -- Admin không cần welcome voucher
WHERE Role = 'admin';

-- Cập nhật tất cả user hiện tại (tạo trước khi có email verification): auto-verify
UPDATE Users 
SET IsEmailVerified = 1
WHERE IsEmailVerified = 0 OR IsEmailVerified IS NULL;

-- Xem kết quả
SELECT UserID, Username, Email, Role, IsEmailVerified, HasReceivedWelcomeVoucher 
FROM Users;
