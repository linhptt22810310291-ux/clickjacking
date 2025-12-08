'use strict';

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const db = require('../models');

/**
 * 📧 EMAIL VERIFICATION SERVICE
 * Xác thực email người dùng
 */

// Cấu hình email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER || process.env.GMAIL_USER,
    pass: process.env.EMAIL_PASSWORD || process.env.GMAIL_PASS,
  },
});

// Verify email connection on startup
transporter.verify((error, success) => {
    if (error) {
        console.error('⚠️ Email Verification Service verification failed:', error.message);
    } else {
        console.log('✅ Email Verification Service ready - User:', process.env.EMAIL_USER || process.env.GMAIL_USER);
    }
});

/**
 * Tạo verification token
 */
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Gửi email xác thực
 */
const sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}&email=${user.Email}`;

  const mailOptions = {
    from: `"${process.env.APP_NAME || 'Shoe Store'}" <${process.env.EMAIL_USER}>`,
    to: user.Email,
    subject: 'Xác thực tài khoản của bạn',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Xác thực Email</h2>
        <p>Xin chào <strong>${user.Name}</strong>,</p>
        <p>Cảm ơn bạn đã đăng ký tài khoản tại ${process.env.APP_NAME || 'Shoe Store'}!</p>
        <p>Vui lòng click vào nút bên dưới để xác thực email của bạn:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Xác thực Email
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          Hoặc copy link sau vào trình duyệt:<br>
          <a href="${verificationUrl}">${verificationUrl}</a>
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          Link xác thực có hiệu lực trong 24 giờ.<br>
          Nếu bạn không đăng ký tài khoản này, vui lòng bỏ qua email này.
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent to:', user.Email);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    throw error;
  }
};

/**
 * Xác thực email token
 */
const verifyEmailToken = async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        message: 'Token hoặc email không hợp lệ',
      });
    }

    // Tìm user
    const user = await db.User.findOne({ where: { Email: email } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng không tồn tại',
      });
    }

    if (user.IsEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được xác thực trước đó',
      });
    }

    // Kiểm tra token
    if (user.EmailVerificationToken !== token) {
      return res.status(400).json({
        success: false,
        message: 'Token không hợp lệ',
      });
    }

    // Kiểm tra token expiry (24 giờ)
    const tokenAge = Date.now() - new Date(user.EmailVerificationTokenExpiry).getTime();
    if (tokenAge > 24 * 60 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'Token đã hết hạn, vui lòng yêu cầu gửi lại',
      });
    }

    // Cập nhật trạng thái xác thực
    await user.update({
      IsEmailVerified: true,
      EmailVerificationToken: null,
      EmailVerificationTokenExpiry: null,
    });

    console.log('✅ Email verified for user:', user.Email);

    res.status(200).json({
      success: true,
      message: 'Xác thực email thành công! Bạn có thể đăng nhập ngay.',
    });
  } catch (error) {
    console.error('❌ Error verifying email:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi xác thực email',
    });
  }
};

/**
 * Gửi lại email xác thực
 */
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await db.User.findOne({ where: { Email: email } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Email không tồn tại',
      });
    }

    if (user.IsEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được xác thực',
      });
    }

    // Tạo token mới
    const token = generateVerificationToken();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ

    await user.update({
      EmailVerificationToken: token,
      EmailVerificationTokenExpiry: expiry,
    });

    // Gửi email
    await sendVerificationEmail(user, token);

    res.status(200).json({
      success: true,
      message: 'Email xác thực đã được gửi lại',
    });
  } catch (error) {
    console.error('❌ Error resending verification email:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi gửi email xác thực',
    });
  }
};

module.exports = {
  generateVerificationToken,
  sendVerificationEmail,
  verifyEmailToken,
  resendVerificationEmail,
};
