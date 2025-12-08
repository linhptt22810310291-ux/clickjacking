'use strict';
const db = require('../models');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const emailService = require('../services/email.service');
const crypto = require('crypto'); // SỬA: Thêm crypto

// SỬA: Thêm hàm tạo OTP 6 số (tương thích Node.js cũ/mới)
function createOtp() {
    try {
        // Ưu tiên dùng hàm mới (Node 14.10+)
        return crypto.randomInt(100000, 999999).toString();
    } catch (e) {
        // Fallback cho Node.js cũ
        const value = parseInt(crypto.randomBytes(4).toString('hex'), 16);
        return ((value % 900000) + 100000).toString();
    }
}

/**
 * @route   POST /api/password/forgot
 * @desc    Xử lý yêu cầu quên mật khẩu, tạo và gửi OTP.
 * @access  Public
 */
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await db.User.findOne({ where: { Email: email } });
        if (!user) {
            return res.json({ message: "Nếu email của bạn tồn tại trong hệ thống, bạn sẽ nhận được một mã OTP." });
        }

        // SỬA: Tạo OTP bằng crypto
        const otp = createOtp();
        const expiryDate = new Date(Date.now() + 10 * 60 * 1000); // 10 phút

        // SỬA: Băm OTP trước khi lưu
        const hashedOtp = await bcrypt.hash(otp, 10);

        await user.update({
            ResetToken: hashedOtp, // Lưu token đã băm
            ResetTokenExpiry: expiryDate
        });

        // Gửi email chứa OTP thô
        console.log('📧 [Forgot Password] Sending OTP email to:', email);
        try {
            await emailService.sendOtpEmail(email, otp);
            console.log('✅ [Forgot Password] OTP email sent successfully to:', email);
        } catch (emailError) {
            console.error('❌ [Forgot Password] Email sending failed:', emailError.message);
            // Không trả lỗi chi tiết cho user để tránh lộ thông tin
        }

        res.json({ message: "OTP đã được gửi vào email của bạn." });

    } catch (error) {
        console.error("FORGOT PASSWORD ERROR:", error);
        res.status(500).json({ errors: [{ msg: "Lỗi máy chủ, không thể xử lý yêu cầu." }] });
    }
};

/**
 * @route   POST /api/password/reset
 * @desc    Xác minh OTP và đặt lại mật khẩu mới.
 * @access  Public
 */
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        // SỬA: 1. Chỉ tìm user bằng email và thời gian hết hạn
        const user = await db.User.findOne({
            where: {
                Email: email,
                ResetTokenExpiry: { [Op.gt]: new Date() } // Lớn hơn thời gian hiện tại
            }
        });

        if (!user || !user.ResetToken) {
            return res.status(400).json({ errors: [{ msg: "OTP không hợp lệ hoặc đã hết hạn." }] });
        }

        // SỬA: 2. So sánh OTP thô với token đã băm trong CSDL
        const isMatch = await bcrypt.compare(otp, user.ResetToken);

        if (!isMatch) {
            return res.status(400).json({ errors: [{ msg: "OTP không hợp lệ hoặc đã hết hạn." }] });
        }

        // 3. Băm mật khẩu mới
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 4. Cập nhật mật khẩu và xóa token
        await user.update({
            Password: hashedPassword,
            ResetToken: null,
            ResetTokenExpiry: null
        });

        res.json({ message: "Đặt lại mật khẩu thành công." });

    } catch (error) {
        console.error("RESET PASSWORD ERROR:", error);
        res.status(500).json({ errors: [{ msg: "Lỗi máy chủ, không thể đặt lại mật khẩu." }] });
    }
};

// ... (Hàm changePassword giữ nguyên) ...
exports.changePassword = async (req, res) => {
    try {
        // SỬA: Đọc (req.user || req.auth).id để tương thích
        const userId = (req.user || req.auth).id;

        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: "Vui lòng nhập đủ mật khẩu cũ và mới." });
        }

        const user = await db.User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy người dùng." });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.Password);
        if (!isMatch) {
            return res.status(400).json({ message: "Mật khẩu hiện tại không chính xác." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await user.update({
            Password: hashedPassword
        });

        res.json({ message: "Đổi mật khẩu thành công." });

    } catch (error) {
        console.error("CHANGE PASSWORD ERROR:", error);
        res.status(500).json({ message: "Lỗi máy chủ, không thể đổi mật khẩu." });
    }
};