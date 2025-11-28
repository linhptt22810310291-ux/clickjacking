'use strict';
const db = require('../models');
const { Sequelize } = require('sequelize');

/**
 * @route   GET /api/home
 * @desc    Lấy dữ liệu cho trang chủ (sản phẩm mới, blog mới)
 * @access  Public
 */
exports.getHomePageData = async (req, res) => {
    try {
        const isPostgres = process.env.NODE_ENV === 'production';
        
        // Subquery khác nhau cho PostgreSQL và MSSQL
        let defaultImageSubquery;
        if (isPostgres) {
            // PostgreSQL syntax - dùng LIMIT thay vì TOP
            defaultImageSubquery = `(
                COALESCE(
                    (SELECT pi."ImageURL" FROM "ProductImages" pi WHERE pi."ProductID" = "Product"."ProductID" AND pi."IsDefault" = true AND pi."VariantID" IS NOT NULL ORDER BY pi."ImageID" LIMIT 1),
                    (SELECT pi2."ImageURL" FROM "ProductImages" pi2 WHERE pi2."ProductID" = "Product"."ProductID" AND pi2."IsDefault" = true ORDER BY pi2."ImageID" LIMIT 1),
                    (SELECT pi3."ImageURL" FROM "ProductImages" pi3 WHERE pi3."ProductID" = "Product"."ProductID" ORDER BY pi3."IsDefault" DESC, pi3."ImageID" LIMIT 1),
                    '/images/placeholder-product.jpg'
                )
            )`;
        } else {
            // MSSQL syntax - dùng TOP
            defaultImageSubquery = `(
                COALESCE(
                    (SELECT TOP 1 pi.ImageURL FROM ProductImages pi WHERE pi.ProductID = Product.ProductID AND pi.IsDefault = 1 AND pi.VariantID IS NOT NULL ORDER BY pi.ImageID),
                    (SELECT TOP 1 pi2.ImageURL FROM ProductImages pi2 WHERE pi2.ProductID = Product.ProductID AND pi2.IsDefault = 1 ORDER BY pi2.ImageID),
                    (SELECT TOP 1 pi3.ImageURL FROM ProductImages pi3 WHERE pi3.ProductID = Product.ProductID ORDER BY pi3.IsDefault DESC, pi3.ImageID),
                    '/images/placeholder-product.jpg'
                )
            )`;
        }

        // Promise để lấy 8 sản phẩm mới nhất
        const productsPromise = db.Product.findAll({
            limit: 8,
            order: [['CreatedAt', 'DESC']],
            attributes: [
                'ProductID', 'Name', 'Price', 'DiscountPercent', 'DiscountedPrice',
                [Sequelize.literal(defaultImageSubquery), 'DefaultImage']
            ],
            include: [{
                model: db.Category,
                as: 'category',
                attributes: [['Name', 'CategoryName']]
            }]
        });

        // Promise để lấy 3 bài blog mới nhất
        // PostgreSQL dùng SUBSTRING thay vì LEFT
        const excerptFn = isPostgres 
            ? Sequelize.fn('SUBSTRING', Sequelize.col('Content'), 1, 400)
            : Sequelize.fn('LEFT', Sequelize.col('Content'), 400);
            
        const blogsPromise = db.Blog.findAll({
            where: { IsActive: true },
            limit: 3,
            order: [['CreatedAt', 'DESC']],
            attributes: [
                'BlogID', 'Title', 'ImageURL', 'CreatedAt',
                [excerptFn, 'Excerpt']
            ]
        });

        // Chạy cả hai promise song song để tăng hiệu suất
        const [products, blogs] = await Promise.all([productsPromise, blogsPromise]);

        res.json({ products, blogs });

    } catch (error) {
        console.error('GET /api/home error:', error);
        res.status(500).json({ message: 'Lỗi server khi lấy dữ liệu trang chủ', error: error.message });
    }
};