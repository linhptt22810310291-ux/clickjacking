'use strict';
const express = require('express');
const router = express.Router();

// 1. Import controller chứa logic xử lý
const { register, login, verifyEmail, resendVerificationEmail } = require('../../controllers/auth.controller');

// 2. Import các schema validation từ Joi
const { registerSchema, loginSchema } = require('../../validators/user.validator');

// 3. Import bot detection middleware
const { detectBot } = require('../../middleware/botDetection');

// 🛡️ 4. Import rate limiters để chống brute force
const { rateLimiters } = require('../../middleware/security.middleware');

// 🔐 5. Import CAPTCHA và CSRF middleware
const { verifyCaptcha } = require('../../middleware/captcha.middleware');
const { verifyCsrfToken } = require('../../middleware/csrf.middleware');

// 6. Tạo một middleware để sử dụng các schema trên
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map(detail => ({
      msg: detail.message,
      field: detail.context.key
    }));
    return res.status(400).json({ errors });
  }
  next();
};

// 6. Định nghĩa các routes với rate limiting
// Route '/register' với rate limiting để chống spam (không cần detectBot vì có rateLimiter)
router.post('/register', rateLimiters.register, validate(registerSchema), register);

// Route '/login' - Rate Limiter + CAPTCHA để chống brute force
// detectBot CHỈ hoạt động đúng khi có trackPageVisit trước đó
// CAPTCHA BẮT BUỘC để xác thực người dùng thật
router.post('/login', rateLimiters.login, verifyCaptcha, validate(loginSchema), login);

// === Email Verification routes ===
router.post('/verify-email', verifyEmail);
router.post('/resend-verification-email', resendVerificationEmail);

module.exports = router;