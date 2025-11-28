'use strict';
const db = require('../models');
const fs = require('fs');
const path = require('path');
const { vietnameseNormalize } = require('../utils/stringUtils');
const cloudinaryConfig = require('../config/cloudinary.config');

// Helper function to upload product image
const uploadProductImage = async (file) => {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
        // Upload to Cloudinary in production
        try {
            const result = await cloudinaryConfig.uploadImage(file.path, 'products');
            if (result.success) {
                // Delete local file after successful upload
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
                return result.url;
            }
        } catch (error) {
            console.error('Cloudinary product upload error:', error);
        }
    }
    
    // Fallback to local storage
    return `/uploads/${file.filename}`;
};

/**
 * Service để tạo sản phẩm, biến thể và hình ảnh trong một transaction.
 */
exports.createProductWithDetails = async (productData, variantsData, files) => {
    return db.sequelize.transaction(async (t) => {
        // --- BƯỚC 1: THÊM LOGIC KIỂM TRA TRÙNG LẶP ---
        const { Name, CategoryID } = productData;
        const existingProduct = await db.Product.findOne({
            where: { Name, CategoryID }, // Tìm sản phẩm có cùng Tên và Danh mục
            transaction: t
        });

        if (existingProduct) {
            // Nếu tìm thấy, ném lỗi 409 (Conflict)
            const error = new Error('Tên sản phẩm này đã tồn tại trong danh mục này.');
            error.statusCode = 409; // Mã lỗi 409
            throw error;
        }
        // 1. Tạo sản phẩm chính
        const product = await db.Product.create(productData, { transaction: t });
        const productId = product.ProductID;

       // 2. Tạo các biến thể (SỬA: Dùng vòng lặp để tạo SKU)
        const colorToVariantIdMap = new Map();
        const createdVariants = []; // Mảng này sẽ được dùng ở bước 3

        for (const v of variantsData) {
            const colorKey = vietnameseNormalize(v.color);
            // Tạo SKU unique (giống logic hàm updateProduct)
            const sku = `${productId}-${v.size}-${colorKey}-${Date.now()}`; 

            const newVariant = await db.ProductVariant.create({
                ProductID: productId,
                IsActive: true,
                Size: v.size,
                Color: v.color,
                StockQuantity: v.stockQuantity,
                SKU: sku // <-- THÊM SKU VÀO ĐÂY
            }, { transaction: t });
            
            createdVariants.push(newVariant); // Thêm vào mảng

            // Build map (Giống logic cũ)
            if (!colorToVariantIdMap.has(colorKey)) {
                colorToVariantIdMap.set(colorKey, newVariant.VariantID);
            }
        }
        // 3. Xử lý và tạo hình ảnh
        if (files && files.length > 0) {
            const imagesPayload = [];
            let isDefaultSet = false;

            for (const file of files) {
                // Upload to Cloudinary in production, local in development
                const imageUrl = await uploadProductImage(file);
                let variantId = null;
                let isDefault = false;

                if (file.fieldname.startsWith('colorImage_')) {
                    const rawColor = file.fieldname.replace('colorImage_', '');
                    const normColor = vietnameseNormalize(rawColor);
                    if (colorToVariantIdMap.has(normColor)) {
                        variantId = colorToVariantIdMap.get(normColor);
                        isDefault = true; // Ảnh màu luôn là default cho variant đó
                    }
                } else if (file.fieldname === 'images' && !isDefaultSet) {
                    isDefault = true;
                    isDefaultSet = true;
                }
                
                imagesPayload.push({
                    ProductID: productId,
                    VariantID: variantId,
                    ImageURL: imageUrl,
                    IsDefault: isDefault
                });
            }
            await db.ProductImage.bulkCreate(imagesPayload, { transaction: t });
        }
        return product;
    });
};

/**
 * Service để xóa sản phẩm và các file liên quan trong một transaction.
 */
exports.deleteProductAndDependencies = async (productId) => {
    const product = await db.Product.findByPk(productId, {
        include: [
            { model: db.ProductImage, as: 'images' },
            { model: db.ProductVariant, as: 'variants', 
                include: ['orderItems', 'cartItems', 'guestOrderItems'] 
            }
        ]
    });
    if (!product) throw new Error('Không tìm thấy sản phẩm.');

    // Kiểm tra ràng buộc
    const hasReferences = product.variants.some(v => 
        v.orderItems.length > 0 || v.cartItems.length > 0 || v.guestOrderItems.length > 0
    );
    if (hasReferences) {
        throw new Error('Không thể xóa sản phẩm vì đã có trong đơn hàng hoặc giỏ hàng.');
    }

    const imageFilesToDelete = product.images.map(img => img.ImageURL);

    // Xóa trong DB (onDelete: 'CASCADE' sẽ tự động xóa variants và images)
    await product.destroy();

    // Xóa file vật lý sau khi xóa DB thành công
    imageFilesToDelete.forEach(imageUrl => {
        if (imageUrl) {
            const imagePath = path.join(__dirname, '../../', imageUrl);
            if (fs.existsSync(imagePath)) {
                fs.unlink(imagePath, (err) => {
                    if (err) console.error(`Lỗi khi xóa file: ${imagePath}`, err);
                });
            }
        }
    });

    return true;
};