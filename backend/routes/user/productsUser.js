'use strict';
const express = require('express');
const router = express.Router();

const productController = require('../../controllers/product.controller');
const reviewController = require('../../controllers/review.controller');

// 🛡️ Bot Detection Middleware
const { detectBot } = require('../../middleware/botDetection');

const { expressjwt } = require('express-jwt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ✅ Tạo thư mục uploads nếu chưa có, dùng absolute path an toàn
const storage = multer.diskStorage({
   destination: (req, file, cb) => {
     // __dirname hiện đang ở routes/user → lùi 3 cấp về gốc backend
     const uploadDir = path.join(__dirname, '..', '..', '..', 'uploads');
     if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
     cb(null, uploadDir);
   },
   filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
 });
const upload = multer({ storage });

const authenticateUser = expressjwt({ secret: process.env.JWT_SECRET, algorithms: ['HS256'] });
const userAuthMiddleware = (req, res, next) => { if (req.auth) req.user = req.auth; next(); };

// --- PRODUCTS ---
// 🛡️ Bot detection tạm thời tắt để test
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.get('/:id/variants', productController.getProductVariants);

// --- REVIEWS ---
router.get('/:productId/reviews', reviewController.getProductReviews);

router.get('/:productId/check-review',
  authenticateUser,
  userAuthMiddleware,
  reviewController.checkReviewEligibility
);

// ✅ Field name phải là 'files' (khớp FE và BE)
router.post('/:productId/reviews',
  authenticateUser,
  userAuthMiddleware,
  upload.array('files', 5),
  reviewController.createReview
);

module.exports = router;
