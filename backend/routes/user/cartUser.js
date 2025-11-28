'use strict';
const express = require('express');
const router = express.Router();

// Import controller
const {
    getCart,
    addItem,
    updateItem,
    removeItem
} = require('../../controllers/cart.controller');

// Import middleware
const getCartOwner = require('../../middleware/cartOwner');
const checkNotAdmin = (req, res, next) => {
    const user = req.user || req.auth;
    if (user && user.role === 'admin') {
        return res.status(403).json({ success: false, message: 'Admin không được phép mua hàng. Chỉ quản lý!' });
    }
    next();
};

// Import validator
const { addItemToCartSchema, updateItemQuantitySchema } = require('../../validators/cart.validator');
const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
    }
    next();
};

// Áp dụng middleware getCartOwner và chặn admin
router.use(checkNotAdmin);
router.use(getCartOwner);

// Định nghĩa các routes
router.get('/', getCart);
router.post('/add', validate(addItemToCartSchema), addItem);
router.patch('/item/:cartItemId', validate(updateItemQuantitySchema), updateItem);
router.delete('/item/:cartItemId', removeItem);

// API GET /products/:productId/variants đã được chuyển sang controller của product
// Nếu vẫn cần, có thể import và thêm vào đây
// const { getProductVariantsForCart } = require('../../controllers/product.controller');
// router.get('/products/:productId/variants', getProductVariantsForCart);

module.exports = router;