'use strict';
const db = require('../models');
const { Op, Sequelize } = require('sequelize');
const { endOfDay } = require('date-fns');
const dotenv = require("dotenv");
const fs = require('fs');
const cloudinaryConfig = require('../config/cloudinary.config');
dotenv.config();
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Helper function to upload review media
const uploadReviewMedia = async (file) => {
    if (!file) return null;
    
    // In production, upload to Cloudinary
    if (process.env.NODE_ENV === 'production') {
        try {
            const folder = file.mimetype.startsWith('video/') ? 'reviews/videos' : 'reviews';
            const result = await cloudinaryConfig.uploadImage(file.path, folder);
            // Delete local temp file after upload
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
            if (result.success) {
                return result.url;
            }
            console.error('Cloudinary review upload failed:', result.error);
            return null;
        } catch (error) {
            console.error('Review media upload error:', error);
            return null;
        }
    }
    
    // In development, use local storage
    return `/uploads/${file.filename}`;
};

// =======================================================
// ===           CONTROLLERS CHO USER (PUBLIC)         ===
// =======================================================

/**
 * @route   GET /api/user/pending-reviews
 * @desc    Lấy danh sách sản phẩm đã mua nhưng chưa đánh giá
 * @access  Private
 */
exports.getPendingReviews = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.max(1, parseInt(req.query.limit || '10', 10));
        const offset = (page - 1) * limit;

        // Lấy tất cả OrderItems từ đơn hàng đã Delivered của user
        const deliveredOrderItems = await db.OrderItem.findAll({
            include: [
                {
                    model: db.Order,
                    as: 'order',
                    where: { 
                        UserID: userId,
                        Status: 'Delivered'
                    },
                    attributes: ['OrderID', 'OrderDate']
                },
                {
                    model: db.ProductVariant,
                    as: 'variant',
                    attributes: ['VariantID', 'ProductID', 'Size', 'Color'],
                    include: [{
                        model: db.Product,
                        as: 'product',
                        attributes: ['ProductID', 'Name']
                    }]
                }
            ],
            attributes: ['OrderItemID', 'OrderID', 'VariantID', 'Quantity', 'Price']
        });

        // Lấy danh sách các review đã tồn tại của user
        const existingReviews = await db.Review.findAll({
            where: { UserID: userId },
            attributes: ['ProductID', 'OrderID', 'OrderItemID']
        });

        // Tạo Set để check nhanh
        const reviewedSet = new Set(
            existingReviews.map(r => `${r.ProductID}-${r.OrderID}-${r.OrderItemID}`)
        );

        // Lọc những items chưa được đánh giá
        const pendingItems = deliveredOrderItems.filter(item => {
            const key = `${item.variant?.product?.ProductID}-${item.OrderID}-${item.OrderItemID}`;
            return !reviewedSet.has(key);
        });

        // Phân trang
        const total = pendingItems.length;
        const paginatedItems = pendingItems.slice(offset, offset + limit);

        // Format response
        const formattedItems = await Promise.all(paginatedItems.map(async (item) => {
            const product = item.variant?.product;
            const productId = product?.ProductID;
            
            // Lấy hình ảnh sản phẩm
            let defaultImage = '/images/placeholder-product.jpg';
            if (productId) {
                const productImage = await db.ProductImage.findOne({
                    where: { ProductID: productId },
                    order: [['IsDefault', 'DESC'], ['ImageID', 'ASC']]
                });
                if (productImage) {
                    defaultImage = productImage.ImageURL.startsWith('http')
                        ? productImage.ImageURL
                        : `${BASE_URL}${productImage.ImageURL}`;
                }
            }

            return {
                OrderItemID: item.OrderItemID,
                OrderID: item.OrderID,
                OrderDate: item.order?.OrderDate,
                ProductID: productId,
                ProductName: product?.Name || 'Sản phẩm không xác định',
                ProductImage: defaultImage,
                Size: item.variant?.Size,
                Color: item.variant?.Color,
                Quantity: item.Quantity,
                Price: item.Price
            };
        }));

        res.json({
            items: formattedItems,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('GET PENDING REVIEWS ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

/**
 * @route   GET /api/user/my-reviews
 * @desc    Lấy danh sách đánh giá của user hiện tại
 * @access  Private
 */
exports.getMyReviews = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.max(1, parseInt(req.query.limit || '10', 10));
        const offset = (page - 1) * limit;

        // Build include array - include ProductImage for default image
        const includeArray = [
            {
                model: db.Product,
                as: 'product',
                attributes: ['ProductID', 'Name'],
                include: [{
                    model: db.ProductImage,
                    as: 'images',
                    attributes: ['ImageURL', 'IsDefault'],
                    required: false,
                    limit: 1,
                    order: [['IsDefault', 'DESC'], ['ImageID', 'ASC']],
                    separate: true
                }]
            },
            {
                model: db.Order,
                as: 'order',
                attributes: ['OrderID', 'OrderDate'],
                required: false
            },
            {
                model: db.OrderItem,
                as: 'orderItem',
                attributes: ['OrderItemID'],
                required: false,
                include: [{
                    model: db.ProductVariant,
                    as: 'variant',
                    attributes: ['Size', 'Color'],
                    required: false
                }]
            }
        ];

        // Only include ReviewMedia if model exists
        if (db.ReviewMedia) {
            includeArray.push({
                model: db.ReviewMedia,
                as: 'media',
                attributes: ['MediaURL', 'IsVideo'],
                required: false
            });
        }

        const { count, rows } = await db.Review.findAndCountAll({
            where: { UserID: userId },
            include: includeArray,
            limit,
            offset,
            order: [['CreatedAt', 'DESC']],
            distinct: true
        });

        const processedReviews = rows.map(review => {
            const plainReview = review.get({ plain: true });
            
            // Get default image from product images
            if (plainReview.product) {
                const defaultImg = plainReview.product.images?.[0]?.ImageURL || '/images/placeholder-product.jpg';
                plainReview.product.DefaultImage = defaultImg.startsWith('http') 
                    ? defaultImg 
                    : `${BASE_URL}${defaultImg}`;
                delete plainReview.product.images; // Clean up
            }
            
            if (plainReview.media) {
                plainReview.media = plainReview.media.map(m => ({
                    ...m,
                    MediaURL: m.MediaURL.startsWith('http') ? m.MediaURL : `${BASE_URL}${m.MediaURL}`
                }));
            }
            if (plainReview.orderItem?.variant) {
                plainReview.Size = plainReview.orderItem.variant.Size;
                plainReview.Color = plainReview.orderItem.variant.Color;
            }
            return plainReview;
        });

        res.json({
            reviews: processedReviews,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.error('GET MY REVIEWS ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

exports.getProductReviews = async (req, res) => {
    try {
        const productId = req.params.productId;
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.max(1, parseInt(req.query.limit || '5', 10));
        const offset = (page - 1) * limit;
        
        // Filter options
        const ratingFilter = req.query.rating ? parseInt(req.query.rating, 10) : null;
        const hasMedia = req.query.hasMedia === 'true';
        const sortBy = req.query.sortBy || 'newest'; // newest, oldest, highest, lowest

        // Build where clause
        const whereClause = { ProductID: productId };
        if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
            whereClause.Rating = ratingFilter;
        }

        // Build order clause
        let orderClause = [['CreatedAt', 'DESC']]; // default: newest
        if (sortBy === 'oldest') {
            orderClause = [['CreatedAt', 'ASC']];
        } else if (sortBy === 'highest') {
            orderClause = [['Rating', 'DESC'], ['CreatedAt', 'DESC']];
        } else if (sortBy === 'lowest') {
            orderClause = [['Rating', 'ASC'], ['CreatedAt', 'DESC']];
        }

        // If filtering by hasMedia, we need to find ReviewIDs with media first
        let reviewIdsWithMedia = null;
        if (hasMedia) {
            const mediaReviews = await db.ReviewMedia.findAll({
                attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('ReviewID')), 'ReviewID']],
                raw: true
            });
            reviewIdsWithMedia = mediaReviews.map(r => r.ReviewID);
            if (reviewIdsWithMedia.length > 0) {
                whereClause.ReviewID = { [Op.in]: reviewIdsWithMedia };
            } else {
                // No reviews with media
                return res.json({
                    reviews: [],
                    total: 0,
                    page,
                    limit,
                    statistics: await getReviewStatistics(productId)
                });
            }
        }

        const { count, rows } = await db.Review.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: db.User,
                    as: 'user',
                    attributes: ['FullName', 'AvatarURL']
                },
                {
                    model: db.ReviewMedia,
                    as: 'media',
                    attributes: ['MediaURL', 'IsVideo']
                },
                // ✅ NEW: Include OrderItem to get Size/Color via variant
                {
                    model: db.OrderItem,
                    as: 'orderItem',
                    attributes: ['OrderItemID', 'VariantID'],
                    required: false, // Allow null for old reviews
                    include: [{
                        model: db.ProductVariant,
                        as: 'variant',
                        attributes: ['Size', 'Color']
                    }]
                }
            ],
            limit,
            offset,
            order: orderClause,
            distinct: true
        });

        const processedReviews = rows.map(review => {
            const plainReview = review.get({ plain: true });
            if (plainReview.user && plainReview.user.AvatarURL) {
                if(!plainReview.user.AvatarURL.startsWith('http')) {
                     plainReview.user.AvatarURL = `${BASE_URL}${plainReview.user.AvatarURL}`;
                }
            }
            if (plainReview.media) {
                plainReview.media = plainReview.media.map(m => ({
                    ...m,
                    MediaURL: m.MediaURL.startsWith('http') ? m.MediaURL : `${BASE_URL}${m.MediaURL}`
                }));
            }
            // ✅ NEW: Extract Size/Color from orderItem.variant
            if (plainReview.orderItem?.variant) {
                plainReview.Size = plainReview.orderItem.variant.Size;
                plainReview.Color = plainReview.orderItem.variant.Color;
            }
            return plainReview;
        });

        res.json({
            reviews: processedReviews,
            total: count,
            page,
            limit,
            statistics: await getReviewStatistics(productId)
        });

    } catch (error) {
        console.error('GET PRODUCT REVIEWS ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

// Helper function to get review statistics
async function getReviewStatistics(productId) {
    const stats = await db.Review.findAll({
        where: { ProductID: productId },
        attributes: [
            'Rating',
            [Sequelize.fn('COUNT', Sequelize.col('Rating')), 'count']
        ],
        group: ['Rating']
    });

    const totalReviews = stats.reduce((acc, stat) => acc + parseInt(stat.get('count'), 10), 0);
    const totalRating = stats.reduce((acc, stat) => acc + (stat.Rating * parseInt(stat.get('count'), 10)), 0);
    const averageRating = totalReviews > 0 ? (totalRating / totalReviews) : 0;

    const ratingSummary = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    stats.forEach(stat => {
        ratingSummary[stat.Rating] = parseInt(stat.get('count'), 10);
    });

    // Count reviews with media
    const withMedia = await db.ReviewMedia.count({
        include: [{
            model: db.Review,
            as: 'review',
            where: { ProductID: productId },
            attributes: []
        }],
        distinct: true,
        col: 'ReviewID'
    });

    return {
        totalReviews,
        averageRating: parseFloat(averageRating.toFixed(1)),
        ratingSummary,
        withMedia
    };
}

/**
 * @route   POST /api/products/:productId/reviews
 * @desc    User tạo một đánh giá mới (kèm media)
 * @access  Private
 */
exports.createReview = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const userId = req.user.id;
    const productId = parseInt(req.params.productId, 10);
    const rating = parseInt(req.body.rating, 10);
    const orderId = parseInt(req.body.orderId, 10);
    const orderItemId = req.body.orderItemId ? parseInt(req.body.orderItemId, 10) : null; // ✅ NEW
    const comment = req.body.comment;
    
    if (!Number.isInteger(orderId)) {
      return res.status(400).json({ errors: [{ msg: 'Thiếu hoặc sai OrderID.' }] });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ errors: [{ msg: 'Rating không hợp lệ (1–5).' }] });
    }

    // 1) Kiểm tra đơn hàng hợp lệ cho user & đã giao
    // ✅ IMPROVED: Không kiểm tra Status='Delivered' để review vẫn hợp lệ khi status thay đổi
    // Thay vào đó, kiểm tra đơn hàng từng được giao (có trong lịch sử hoặc status hiện tại)
    const orderCondition = { UserID: userId, OrderID: orderId };
    
    // Nếu có orderItemId, tìm chính xác item đó
    let eligibleItem;
    if (orderItemId) {
      eligibleItem = await db.OrderItem.findOne({
        where: { OrderItemID: orderItemId, OrderID: orderId },
        include: [
          { model: db.ProductVariant, as: 'variant', where: { ProductID: productId }, attributes: ['VariantID'], required: true },
          { model: db.Order, as: 'order', where: orderCondition, attributes: ['Status'], required: true }
        ],
        transaction: t
      });
    } else {
      // Fallback: tìm bất kỳ item nào của product trong order
      eligibleItem = await db.OrderItem.findOne({
        include: [
          { model: db.ProductVariant, as: 'variant', where: { ProductID: productId }, attributes: ['VariantID'], required: true },
          { model: db.Order, as: 'order', where: orderCondition, attributes: ['Status'], required: true }
        ],
        transaction: t
      });
    }

    if (!eligibleItem) {
      await t.rollback();
      return res.status(403).json({ errors: [{ msg: 'Bạn chỉ có thể đánh giá sản phẩm thuộc đơn hàng của chính bạn.' }] });
    }

    // ✅ IMPROVED: Chỉ kiểm tra đơn đã Delivered tại thời điểm review
    if (eligibleItem.order.Status !== 'Delivered') {
      await t.rollback();
      return res.status(403).json({ errors: [{ msg: 'Chỉ có thể đánh giá khi đơn hàng đã giao thành công.' }] });
    }

    // 2) Ngăn trùng theo (UserID, ProductID, OrderID)
    const existed = await db.Review.findOne({
      where: { UserID: userId, ProductID: productId, OrderID: orderId },
      transaction: t
    });
    if (existed) {
      await t.rollback();
      return res.status(409).json({ errors: [{ msg: 'Bạn đã đánh giá sản phẩm này cho đơn hàng này rồi.' }] });
    }

    // 3) Tạo review có OrderID và OrderItemID (để lưu Size/Color)
    const newReview = await db.Review.create({
      UserID: userId,
      ProductID: productId,
      OrderID: orderId,
      OrderItemID: orderItemId || eligibleItem.OrderItemID, // ✅ NEW: Lưu OrderItemID
      Rating: rating,
      Comment: comment || null
    }, { transaction: t });

    // 4) Lưu media (field name 'files')
    if (req.files?.length) {
      const mediaPromises = req.files.map(async (f) => {
        const mediaUrl = await uploadReviewMedia(f);
        if (mediaUrl) {
          return {
            ReviewID: newReview.ReviewID,
            MediaURL: mediaUrl,
            IsVideo: f.mimetype.startsWith('video/')
          };
        }
        return null;
      });
      const mediaDataArray = await Promise.all(mediaPromises);
      const validMediaData = mediaDataArray.filter(m => m !== null);
      if (validMediaData.length > 0) {
        await db.ReviewMedia.bulkCreate(validMediaData, { transaction: t });
      }
    }

    await t.commit();

    const finalReview = await db.Review.findByPk(newReview.ReviewID, {
       include: [
         { model: db.User, as: 'user', attributes: ['FullName', 'AvatarURL'] },
         { model: db.ReviewMedia, as: 'media', attributes: ['MediaURL', 'IsVideo'] },
         // ✅ NEW: Include variant for Size/Color
         { 
           model: db.OrderItem, 
           as: 'orderItem', 
           attributes: ['OrderItemID'],
           include: [{ model: db.ProductVariant, as: 'variant', attributes: ['Size', 'Color'] }]
         }
       ]
     });
  
    const plain = finalReview.get({ plain: true });
    if (plain.user?.AvatarURL && !plain.user.AvatarURL.startsWith('http')) {
      plain.user.AvatarURL = `${BASE_URL}${plain.user.AvatarURL}`;
    }
    if (Array.isArray(plain.media)) {
      plain.media = plain.media.map(m => ({
        ...m,
        MediaURL: m.MediaURL.startsWith('http') ? m.MediaURL : `${BASE_URL}${m.MediaURL}`
      }));
    }
    // ✅ NEW: Add Size/Color to response
    if (plain.orderItem?.variant) {
      plain.Size = plain.orderItem.variant.Size;
      plain.Color = plain.orderItem.variant.Color;
    }
    return res.status(201).json(plain);

  } catch (error) {
    await t.rollback();
    if (['SequelizeUniqueConstraintError','SequelizeValidationError','SequelizeForeignKeyConstraintError'].includes(error.name)) {
    const msg = error?.errors?.[0]?.message || 'Dữ liệu không hợp lệ';
   const code = error.name === 'SequelizeUniqueConstraintError' ? 409 : 400;
    return res.status(code).json({ errors: [{ msg }] });
  }
  console.error('CREATE REVIEW ERROR:', error);
  return res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ khi tạo đánh giá' }] });
  }
};


/**
 * @route   GET /api/products/:productId/check-review
 * @desc    Kiểm tra xem user có quyền đánh giá sản phẩm này không
 * @access  Private
 */
exports.checkReviewEligibility = async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = parseInt(req.params.productId, 10);
    const orderId = req.query.orderId ? parseInt(req.query.orderId, 10) : null;

    if (!productId) {
      return res.status(400).json({ errors: [{ msg: 'ProductID không hợp lệ.' }] });
    }
    if (!orderId) {
      return res.status(400).json({ errors: [{ msg: 'Thiếu orderId.' }] });
    }

    const purchasedItem = await db.OrderItem.findOne({
      include: [
        { model: db.ProductVariant, as: 'variant', where: { ProductID: productId }, attributes: [], required: true },
        { model: db.Order, as: 'order', where: { UserID: userId, Status: 'Delivered', OrderID: orderId }, attributes: [], required: true }
      ]
    });

    const reviewed = await db.Review.findOne({
      where: { UserID: userId, ProductID: productId, OrderID: orderId }
    });

    return res.json({
      hasPurchased: !!purchasedItem,
      hasReviewed: !!reviewed,
      canReview: !!purchasedItem && !reviewed
    });
  } catch (error) {
    console.error('CHECK REVIEW ELIGIBILITY ERROR:', error);
    return res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

// =======================================================
// ===           CONTROLLERS CHO ADMIN                 ===
// =======================================================

exports.getAllReviewsAdmin = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.max(1, parseInt(req.query.limit || '10', 10));
        const offset = (page - 1) * limit;
        const { keyword, rating, startDate, endDate } = req.query;

        const whereClause = {};
        
        if (rating && rating !== 'all' && !isNaN(parseInt(rating))) {
            whereClause.Rating = parseInt(rating);
        }
        
        if (startDate && endDate) {
            whereClause.CreatedAt = { [Op.between]: [new Date(startDate), endOfDay(new Date(endDate))] };
        } else if (startDate) {
            whereClause.CreatedAt = { [Op.gte]: new Date(startDate) };
        } else if (endDate) {
            whereClause.CreatedAt = { [Op.lte]: endOfDay(new Date(endDate)) };
        }
        
        if (keyword) {
            whereClause[Op.or] = [
                { Comment: { [Op.like]: `%${keyword}%` } },
                { '$user.FullName$': { [Op.like]: `%${keyword}%` } },
                { '$product.Name$': { [Op.like]: `%${keyword}%` } }
            ];
        }

        const { count, rows } = await db.Review.findAndCountAll({
            where: whereClause,
            include: [
                // SỬA: Thêm 'required: true' để đảm bảo JOIN hoạt động cho Op.or
                { model: db.User, as: 'user', attributes: ['UserID', 'FullName', 'Email', 'AvatarURL'], required: true },
                { model: db.Product, as: 'product', attributes: ['ProductID', 'Name'], required: true },
                // Media là tùy chọn, không cần required
                { model: db.ReviewMedia, as: 'media', attributes: ['MediaURL', 'IsVideo'], required: false }
            ],
            limit,
            offset,
            order: [['CreatedAt', 'DESC']],
            distinct: true
        });

        const processedReviews = rows.map(review => {
            const plainReview = review.get({ plain: true });
            if (plainReview.user && plainReview.user.AvatarURL) {
                 if(!plainReview.user.AvatarURL.startsWith('http')) {
                    plainReview.user.AvatarURL = `${BASE_URL}${plainReview.user.AvatarURL}`;
                 }
            }
            if (plainReview.media) {
                plainReview.media = plainReview.media.map(m => ({
                    ...m,
                    MediaURL: `${BASE_URL}${m.MediaURL}`
                }));
            }
            return plainReview;
        });

        res.json({ reviews: processedReviews, total: count, page, limit });

    } catch (error) {
        console.error('ADMIN REVIEWS LIST ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

exports.getReviewByIdAdmin = async (req, res) => {
    try {
        const review = await db.Review.findByPk(req.params.id, {
            include: [
                { model: db.User, as: 'user', attributes: ['UserID', 'FullName', 'Email', 'AvatarURL'] },
                { model: db.Product, as: 'product', attributes: ['ProductID', 'Name'] },
                { model: db.ReviewMedia, as: 'media', attributes: ['MediaURL', 'IsVideo'] }
            ]
        });

        if (!review) {
            return res.status(404).json({ errors: [{ msg: 'Không tìm thấy đánh giá' }] });
        }
        
        const plainReview = review.get({ plain: true });
        if (plainReview.user && plainReview.user.AvatarURL) {
             if(!plainReview.user.AvatarURL.startsWith('http')) {
                plainReview.user.AvatarURL = `${BASE_URL}${plainReview.user.AvatarURL}`;
             }
        }
        if (plainReview.media) {
            plainReview.media = plainReview.media.map(m => ({
                ...m,
                MediaURL: `${BASE_URL}${m.MediaURL}`
            }));
        }

        res.json(plainReview);
    } catch (error) {
        console.error('ADMIN GET REVIEW DETAIL ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

exports.deleteReview = async (req, res) => {
    try {
        const review = await db.Review.findByPk(req.params.id);
        if (!review) {
             return res.status(404).json({ errors: [{ msg: 'Không tìm thấy đánh giá để xóa' }] });
        }
        
        await db.ReviewMedia.destroy({ where: { ReviewID: req.params.id } });
        
        await review.destroy();
        
        res.json({ message: 'Xóa đánh giá thành công' });
    } catch (error) {
        console.error('ADMIN DELETE REVIEW ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};