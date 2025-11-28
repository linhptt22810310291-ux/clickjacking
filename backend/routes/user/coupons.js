'use strict';
const express = require('express');
const router = express.Router();

// Import controllers
const { 
    listAvailableCoupons, 
    validateCoupon, 
    getUserVouchers,
    getCollectibleVouchers, 
    claimVoucher // <<< SỬA: Dùng 'claimVoucher'
} = require('../../controllers/coupon.controller');

// Import middleware
const authenticateToken = require('../../middleware/auth.middleware'); 
const authenticateTokenOptional = require('../../middleware/authenticateTokenOptional');
const { checkCouponSchema } = require('../../validators/coupon.validator');
const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
    }
    next();
};

// --- Định nghĩa routes ---

// API CÔNG KHAI: Lấy các mã CÔNG KHAI (dùng cho guest checkout)
router.get('/', listAvailableCoupons);

// API CÔNG KHAI (TÙY CHỌN AUTH): Validate mã khi thanh toán
router.post(
    '/validate', 
    authenticateTokenOptional, 
    validate(checkCouponSchema),
    validateCoupon
);

// API BẮT BUỘC AUTH: Lấy VÍ VOUCHER
router.get('/vouchers', authenticateToken, getUserVouchers);

// API BẮT BUỘC AUTH: Lấy KHO VOUCHER (các mã công khai có thể "Lưu")
router.get('/collectible', authenticateToken, getCollectibleVouchers);

// API BẮT BUỘC AUTH: User "Nhận" (Claim) mã code vào ví
router.post('/claim', authenticateToken, claimVoucher); // <<< SỬA: Thay /collect bằng /claim

module.exports = router;