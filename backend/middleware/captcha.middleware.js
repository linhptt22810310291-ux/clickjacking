'use strict';

const svgCaptcha = require('svg-captcha');
const session = require('express-session');

/**
 * 🔐 CAPTCHA MIDDLEWARE
 * Bảo vệ đăng nhập khỏi bot attacks
 */

// Session configuration cho CAPTCHA
const isProduction = process.env.NODE_ENV === 'production';
const sessionMiddleware = session({
  secret: process.env.JWT_SECRET || 'dev_secret', // Use same secret as main app
  resave: false,
  saveUninitialized: true,
  name: 'captcha.sid', // Different name to avoid conflicts
  cookie: {
    secure: isProduction, // HTTPS only in production
    httpOnly: true,
    maxAge: 10 * 60 * 1000, // 10 phút
    sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-site in production
  },
});

/**
 * Generate CAPTCHA
 */
const generateCaptcha = (req, res) => {
  try {
    const captcha = svgCaptcha.create({
      size: 6, // 6 ký tự
      noise: 3, // Độ nhiễu
      color: true, // Màu sắc
      background: '#f0f0f0',
      fontSize: 50,
      width: 200,
      height: 80,
    });

    // Lưu CAPTCHA text vào session
    if (!req.session) {
      req.session = {};
    }
    req.session.captcha = captcha.text.toLowerCase();
    
    console.log('🔐 Generated CAPTCHA:', captcha.text, 'Session ID:', req.sessionID);

    // Gửi SVG về client
    res.type('svg');
    res.status(200).send(captcha.data);
  } catch (error) {
    console.error('❌ Error generating CAPTCHA:', error);
    res.status(500).json({ success: false, message: 'Failed to generate CAPTCHA' });
  }
};

/**
 * Verify CAPTCHA
 */
const verifyCaptcha = (req, res, next) => {
  try {
    const { captcha } = req.body;
    const sessionCaptcha = req.session?.captcha;

    console.log('🔍 Verifying CAPTCHA:', {
      provided: captcha,
      expected: sessionCaptcha,
      sessionID: req.sessionID,
      hasSession: !!req.session,
    });

    if (!captcha) {
      return res.status(400).json({
        success: false,
        errors: [{ msg: 'Vui lòng nhập mã CAPTCHA' }],
      });
    }

    if (!sessionCaptcha) {
      return res.status(400).json({
        success: false,
        errors: [{ msg: 'CAPTCHA đã hết hạn, vui lòng tải lại' }],
      });
    }

    // So sánh không phân biệt hoa thường
    if (captcha.toLowerCase() !== sessionCaptcha.toLowerCase()) {
      return res.status(400).json({
        success: false,
        errors: [{ msg: 'Mã CAPTCHA không đúng' }],
      });
    }

    // CAPTCHA đúng - xóa khỏi session (one-time use)
    delete req.session.captcha;
    
    console.log('✅ CAPTCHA verified successfully');
    next();
  } catch (error) {
    console.error('❌ Error verifying CAPTCHA:', error);
    res.status(500).json({ success: false, errors: [{ msg: 'Lỗi xác thực CAPTCHA' }] });
  }
};

module.exports = {
  sessionMiddleware,
  generateCaptcha,
  verifyCaptcha,
};
