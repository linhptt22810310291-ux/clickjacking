-- Thêm các cột mới vào bảng Users
ALTER TABLE Users ADD IsEmailVerified BIT NOT NULL DEFAULT 0;
ALTER TABLE Users ADD EmailVerificationToken NVARCHAR(255) NULL;
ALTER TABLE Users ADD EmailVerificationExpires DATETIME2 NULL;
ALTER TABLE Users ADD HasReceivedWelcomeVoucher BIT NOT NULL DEFAULT 0;

-- Cập nhật tất cả user hiện tại: đã verify email (để không block login)
UPDATE Users SET IsEmailVerified = 1 WHERE IsEmailVerified = 0;

-- Xem kết quả
SELECT TOP 5 UserID, Username, IsEmailVerified, HasReceivedWelcomeVoucher FROM Users;
