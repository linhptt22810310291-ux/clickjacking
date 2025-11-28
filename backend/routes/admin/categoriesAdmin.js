'use strict';
const express = require('express');
const router = express.Router();

// Import middlewares
const checkAdmin = require('../../middleware/checkAdmin');

// Import controllers
const {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoryList // <<< THÊM MỚI
} = require('../../controllers/category.controller');

// Import validator và middleware
const { categorySchema } = require('../../validators/category.validator');
const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ errors: [{ msg: error.details[0].message }] });
    }
    next();
};

// Áp dụng middleware checkAdmin cho tất cả các route
router.use(checkAdmin);

// === THÊM ROUTE MỚI CHO FORM ===
// Đặt route này TRƯỚC route '/:id' để tránh xung đột
router.get('/list', getCategoryList);
// === KẾT THÚC THÊM ===

// Định nghĩa các routes CRUD
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);
router.post('/', validate(categorySchema), createCategory);
router.put('/:id', validate(categorySchema), updateCategory);
router.delete('/:id', deleteCategory);

module.exports = router;