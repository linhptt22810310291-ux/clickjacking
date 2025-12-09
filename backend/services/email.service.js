// backend/services/email.service.js
'use strict';
const nodemailer = require('nodemailer');

// Kiểm tra xem có sử dụng Resend API hay không
const USE_RESEND = process.env.RESEND_API_KEY ? true : false;

// Cấu hình transporter
let transporter;
let sendEmailFn;

if (USE_RESEND) {
    // Sử dụng Resend API (hoạt động tốt trên Render)
    console.log('📧 Email Service: Using Resend API');
    
    sendEmailFn = async (mailOptions) => {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: mailOptions.from || `Shoe Store <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
                to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
                subject: mailOptions.subject,
                html: mailOptions.html,
            }),
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Resend API error: ${response.status}`);
        }
        
        return await response.json();
    };
    
    console.log('✅ Email Service (Resend) ready');
} else {
    // Fallback: Sử dụng Gmail SMTP với cấu hình tối ưu cho Render
    console.log('📧 Email Service: Using Gmail SMTP');
    
    transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // SSL
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
        },
        pool: true,              // Connection pooling để tăng tốc
        maxConnections: 5,       // Tối đa 5 connections
        maxMessages: 100,        // Tối đa 100 messages/connection
        connectionTimeout: 30000, // 30 giây (giảm từ 60s)
        greetingTimeout: 15000,   // 15 giây (giảm từ 30s)
        socketTimeout: 30000,     // 30 giây (giảm từ 60s)
    });
    
    sendEmailFn = async (mailOptions) => {
        return await transporter.sendMail(mailOptions);
    };

    // Verify email connection on startup
    transporter.verify((error, success) => {
        if (error) {
            console.error('⚠️ Email Service (GMAIL) verification failed:', error.message);
            console.log('💡 Tip: Add RESEND_API_KEY to use Resend API instead (works better on Render)');
        } else {
            console.log('✅ Email Service (GMAIL) ready - User:', process.env.GMAIL_USER);
        }
    });
}

// Helper function để gửi email
const sendEmail = async (mailOptions) => {
    // Đảm bảo from được set
    if (!mailOptions.from) {
        if (USE_RESEND) {
            mailOptions.from = `Shoe Store <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`;
        } else {
            mailOptions.from = `"Shoe Store" <${process.env.GMAIL_USER}>`;
        }
    }
    return await sendEmailFn(mailOptions);
};
/**
 * === HÀM MỚI: Gửi email Chào mừng ===
 * Gửi email cho người dùng mới, đính kèm mã voucher để họ tự nhận.
 * @param {string} to - Địa chỉ email người nhận.
 * @param {string} username - Tên người dùng.
 * @param {string} voucherCode - Mã voucher (VD: 'NEWUSER').
 */
exports.sendWelcomeEmail = async (to, username, voucherCode) => {
    console.log('📧 [Welcome Email] Sending to:', to, 'with voucher:', voucherCode);
    try {
        await sendEmail({
            to: to,
            subject: "Chào mừng bạn đến với Shoe Store!",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
                    <h2>Chào mừng ${username}!</h2>
                    <p>Cảm ơn bạn đã đăng ký tài khoản tại Shoe Store.</p>
                    <p>Để cảm ơn, chúng tôi gửi tặng bạn một voucher chào mừng. Bạn có thể nhận voucher này bằng cách:</p>
                    <ol>
                        <li>Đăng nhập vào tài khoản của bạn.</li>
                        <li>Đi đến trang "Hồ sơ" -> "Ví Voucher".</li>
                        <li>Nhập mã code sau đây vào ô "Nhận Voucher":</li>
                    </ol>
                    <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background-color: #f0f0f0; padding: 10px 20px; display: inline-block; border-radius: 5px;">
                        ${voucherCode}
                    </p>
                    <p>Chúc bạn có trải nghiệm mua sắm tuyệt vời!</p>
                    <p>Trân trọng,<br>Đội ngũ Shoe Store</p>
                </div>
            `,
        });
        console.log(`✅ [Welcome Email] Sent successfully to ${to}`);
    } catch (error) {
        console.error(`❌ [Welcome Email] Error sending to ${to}:`, error.message);
        // Không ném lỗi để tránh làm hỏng flow đăng ký
    }
};
/**
 * Gửi email chứa mã OTP để reset mật khẩu.
 * @param {string} to - Địa chỉ email người nhận.
 * @param {string} otp - Mã OTP cần gửi.
 */
exports.sendOtpEmail = async (to, otp) => {
    console.log('📧 [OTP Email] Sending to:', to, 'OTP:', otp);
    try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const resetLink = `${frontendUrl}/reset-password?email=${encodeURIComponent(to)}`;

        await sendEmail({
            to: to,
            subject: "Mã đặt lại mật khẩu",
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; line-height: 1.6;">
                    <h2>Yêu cầu đặt lại mật khẩu</h2>
                    <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
                    <p>Mã OTP của bạn là:</p>
                    <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px; background-color: #f0f0f0; padding: 10px 20px; display: inline-block; border-radius: 5px;">
                        ${otp}
                    </p>
                    <p>Mã này sẽ có hiệu lực trong <strong>10 phút</strong>.</p>
                    <p>Hoặc, bạn có thể nhấp vào nút bên dưới để đến thẳng trang đặt lại mật khẩu:</p>
                    <a href="${resetLink}" target="_blank" style="display: inline-block; padding: 12px 24px; margin: 15px 0; font-size: 16px; font-weight: bold; color: #ffffff; background-color: #c71857; text-decoration: none; border-radius: 5px;">
                        Đặt lại mật khẩu
                    </a>
                    <p style="font-size: 12px; color: #888;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                </div>
            `,
        });
        console.log(`✅ [OTP Email] Sent successfully to ${to}`);
    } catch (error) {
        console.error(`❌ [OTP Email] Error sending to ${to}:`, error.message);
        throw error;
    }
};

/**
 * Gửi email thông báo khi mật khẩu được admin reset.
 * @param {string} to - Email người nhận.
 * @param {string} username - Tên người dùng.
 * @param {string} newPassword - Mật khẩu mới (dạng plain text).
 */
exports.sendPasswordResetByAdminEmail = async (to, username, newPassword) => {
    try {
        await sendEmail({
            to: to,
            subject: 'Thông báo: Mật khẩu của bạn đã được đặt lại',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h3>Chào ${username},</h3>
                    <p>Mật khẩu tài khoản của bạn tại Shoe Store đã được quản trị viên đặt lại.</p>
                    <p>Mật khẩu mới của bạn là: <strong style="font-size: 16px;">${newPassword}</strong></p>
                    <p>Vui lòng đăng nhập và thay đổi mật khẩu ngay lập tức để bảo vệ tài khoản của bạn.</p>
                    <br>
                    <p>Trân trọng,<br>Đội ngũ hỗ trợ Shoe Store</p>
                </div>
            `,
        });
        console.log(`Admin password reset email sent successfully to ${to}`);
    } catch (error) {
        console.error(`Error sending admin reset email to ${to}:`, error);
        throw new Error('Không thể gửi email thông báo reset mật khẩu.');
    }
};

/**
 * Gửi email thông báo về mã coupon mới hoặc được cập nhật.
 * @param {string | string[]} to - Email người nhận (một hoặc nhiều).
 * @param {object} coupon - Đối tượng coupon { Code, DiscountType, DiscountValue, ExpiryDate }.
 * @param {string} subject - Tiêu đề email.
 */
/**
 * Gửi email thông báo về mã coupon mới hoặc được cập nhật.
 * @param {string | string[]} to - Email người nhận (một hoặc nhiều).
 * @param {object} coupon - Đối tượng coupon { Code, DiscountType, DiscountValue, ExpiryDate }.
 * @param {string} subject - Tiêu đề email.
 */
exports.sendCouponEmail = async (to, coupon, subject = 'Mã khuyến mãi từ Shoe Store') => {
    try {
        let discountDisplay = '';
        const discountValue = Number(coupon.DiscountValue); // Đảm bảo là số

        if (coupon.DiscountType === 'Percent') {
            discountDisplay = `${discountValue}%`;
        } else if (coupon.DiscountType === 'FixedAmount') {
            // Sửa lỗi: Đảm bảo sử dụng toLocaleString() trên biến đã được kiểm tra (discountValue)
            discountDisplay = `${discountValue.toLocaleString('vi-VN')}₫`; 
        } else {
             discountDisplay = 'một mức giảm giá hấp dẫn';
        }

        const mailOptions = {
            from: `"Shoe Store" <${process.env.GMAIL_USER}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h3>Chào bạn,</h3>
                    <p>Bạn có một mã khuyến mãi mới từ Shoe Store:</p>
                    <ul style="list-style: none; padding: 0;">
                        <li><strong>Mã:</strong> <span style="color: #d9534f; font-weight: bold;">${coupon.Code}</span></li>
                        <li><strong>Giảm giá:</strong> ${discountDisplay}</li> 
                        <li><strong>Hết hạn:</strong> ${new Date(coupon.ExpiryDate).toLocaleDateString('vi-VN')}</li>
                    </ul>
                    <ol>
                        <li>Đăng nhập vào tài khoản của bạn.</li>
                        <li>Đi đến trang "Hồ sơ" -> "Ví Voucher".</li>
                        <li>Nhập mã code sau đây vào ô "Nhận Voucher":</li>
                    </ol>
                    <p>Vui lòng sử dụng trong thời gian hiệu lực!</p>
                    <p>Chúc bạn có trải nghiệm mua sắm tuyệt vời!</p>
                    <p>Trân trọng,<br>Shoe Store</p>
                </div>
            `,
        };
        await sendEmail(mailOptions);
        console.log(`Coupon email sent successfully to ${to}`); 
    } catch (error) {
        // Nếu có lỗi, chúng ta in log chi tiết
        console.error(`Error sending coupon email to ${to}:`, error);
        throw new Error('Không thể gửi email coupon.');
    }
};
// KHÔNG CÓ HÀM sendCouponToCustomers NÀO Ở ĐÂY

/**
 * === HÀM MỚI: Gửi email Xác thực Email ===
 * Gửi email chứa link verify/token xác thực khi người dùng đăng ký.
 * @param {string} to - Địa chỉ email người nhận.
 * @param {string} username - Tên người dùng.
 * @param {string} verificationToken - Token xác thực.
 */
exports.sendEmailVerificationEmail = async (to, username, verificationToken) => {
    try {
        const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

        await sendEmail({
            to: to,
            subject: "Xác thực email tài khoản Shoe Store",
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
                    <h2>Xác thực email của bạn</h2>
                    <p>Chào ${username},</p>
                    <p>Cảm ơn bạn đã đăng ký tài khoản tại Shoe Store. Vui lòng xác thực email của bạn bằng cách nhấp vào nút bên dưới:</p>
                    
                    <a href="${verificationLink}" target="_blank" style="display: inline-block; padding: 12px 24px; margin: 15px 0; font-size: 16px; font-weight: bold; color: #ffffff; background-color: #28a745; text-decoration: none; border-radius: 5px;">
                        Xác thực Email
                    </a>
                    
                    <p>Hoặc sao chép và dán đường link sau vào trình duyệt của bạn:</p>
                    <p style="word-break: break-all; color: #0066cc;">${verificationLink}</p>
                    
                    <p><strong>Lưu ý:</strong> Link này sẽ hết hạn trong <strong>24 giờ</strong>. Nếu bạn không xác thực email trong thời gian này, tài khoản của bạn sẽ bị vô hiệu hóa.</p>
                    
                    <p>Nếu bạn không tạo tài khoản này, vui lòng bỏ qua email này.</p>
                    
                    <p>Trân trọng,<br>Đội ngũ Shoe Store</p>
                </div>
            `,
        });
        console.log(`Email verification email sent successfully to ${to}`);
    } catch (error) {
        console.error(`Error sending email verification to ${to}:`, error);
        throw new Error('Không thể gửi email xác thực.');
    }
};