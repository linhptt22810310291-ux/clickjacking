'use strict';
const express = require('express');
const router = express.Router();

// Import controllers
const { forgotPassword, resetPassword, changePassword } = require('../../controllers/password.controller');

// Import validators và middleware
const { forgotPasswordSchema, resetPasswordSchema, changePasswordSchema } = require('../../validators/password.validator');
const { expressjwt } = require('express-jwt'); // Import middleware JWT

// 🛡️ Import rate limiters để chống brute force
const { rateLimiters } = require('../../middleware/security.middleware');

// Middleware xác thực (lấy từ server.js)
const authenticateUser = expressjwt({ secret: process.env.JWT_SECRET, algorithms: ['HS256'] });
// Middleware gán req.user (lấy từ server.js)
const userAuthMiddleware = (req, res, next) => { if(req.auth) req.user = req.auth; next(); };
const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }
    next();
};

// Định nghĩa các routes với rate limiting
router.post('/forgot', rateLimiters.passwordReset, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset', rateLimiters.passwordReset, validate(resetPasswordSchema), resetPassword);
router.put(
    '/', 
    authenticateUser,       // 1. Phải xác thực
    userAuthMiddleware,     // 2. Gán req.user
    // validate(changePasswordSchema), // 3. (Optional) Validate input mới
    changePassword          // 4. Gọi controller
);
module.exports = router;