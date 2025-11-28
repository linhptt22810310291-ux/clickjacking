'use strict';

const express = require('express');
const authenticateToken = require('../../middleware/auth.middleware');

// Import controllers
const {
    placeOrder,
    retryVnpayPayment
} = require('../../controllers/order.controller');
const {
    placeGuestOrder,
    retryGuestVnpayPayment,
    lookupOrders,          // 👈 thêm
    getOrderDetail         // 👈 thêm
} = require('../../controllers/guestOrder.controller');

// Import validators
const { createOrderSchema } = require('../../validators/order.validator');
const { createGuestOrderSchema } = require('../../validators/guestOrder.validator');

// ✅ Khởi tạo router trước khi dùng
const userOrdersRouter = express.Router();
const guestOrdersRouter = express.Router();

// Middleware validate chung
const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        return res
            .status(400)
            .json({ success: false, message: error.details[0].message });
    }
    next();
};

// ===================================================
// ===                USER ROUTES                 ===
// ===================================================
userOrdersRouter.post(
    '/place',
    authenticateToken,
    validate(createOrderSchema),
    placeOrder
);

userOrdersRouter.post('/:id/pay', authenticateToken, retryVnpayPayment);

// ===================================================
// ===              GUEST ROUTES (vãng lai)        ===
// ===================================================

// Đặt hàng
guestOrdersRouter.post('/place', validate(createGuestOrderSchema), placeGuestOrder);

// Thanh toán lại
guestOrdersRouter.post('/:id/pay', retryGuestVnpayPayment);

// 🔥 Tra cứu danh sách đơn theo email + phone
guestOrdersRouter.post('/lookup', lookupOrders);

// 🔥 Xem chi tiết đơn cụ thể
guestOrdersRouter.get('/:id', getOrderDetail);

// ===================================================
// ===                 EXPORT ROUTERS              ===
// ===================================================
module.exports = { userOrdersRouter, guestOrdersRouter };
