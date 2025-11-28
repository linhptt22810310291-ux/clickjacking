/**
 * Script để thêm ảnh từ Unsplash vào database
 * Chạy: node backend/scripts/add-product-images.js
 */

const db = require('../models');

// Danh sách ảnh giày từ Unsplash
const shoeImages = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80', // Nike red
  'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&q=80', // Nike white
  'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80', // Black sneakers
  'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80', // White sneakers
  'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800&q=80', // Running shoes
  'https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=800&q=80', // Sport shoes
  'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&q=80', // Black shoes
  'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800&q=80', // White sneakers 2
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=800&q=80', // Converse
  'https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=800&q=80', // Sport shoes 2
];

async function addProductImages() {
  try {
    console.log('🔍 Đang lấy danh sách variants...');
    
    // Lấy tất cả variants
    const variants = await db.ProductVariant.findAll({
      attributes: ['VariantID', 'ProductID', 'Color'],
      limit: 100 // Chỉ lấy 100 variants đầu tiên
    });

    console.log(`📦 Tìm thấy ${variants.length} variants`);

    const imagesToInsert = [];
    
    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      // Chọn ảnh dựa trên màu
      const imageUrl = variant.Color === 'Đen' || variant.Color === 'Black'
        ? shoeImages[2] // Black sneakers
        : shoeImages[3]; // White sneakers
      
      imagesToInsert.push({
        ProductID: variant.ProductID,
        VariantID: variant.VariantID,
        ImageURL: imageUrl,
        IsDefault: 1 // Set là ảnh mặc định
      });
    }

    console.log(`📸 Đang thêm ${imagesToInsert.length} ảnh vào database...`);
    
    // Xóa ảnh cũ trước (nếu có)
    await db.ProductImage.destroy({ where: {} });
    
    await db.ProductImage.bulkCreate(imagesToInsert);

    console.log('✅ Hoàn tất! Đã thêm ảnh cho tất cả variants');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Lỗi:', error);
    process.exit(1);
  }
}

addProductImages();
