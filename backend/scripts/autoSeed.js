'use strict';

/**
 * Auto-seeder for production database
 * This runs automatically when the server starts if tables are empty
 */

const db = require('../models');
const bcrypt = require('bcryptjs');

// Cloudinary base URL
const CLOUDINARY_BASE = 'https://res.cloudinary.com/ddduuddmz/image/upload/v1764329879/webgiay';

const autoSeed = async () => {
  console.log('🌱 Checking if database needs seeding...');
  
  try {
    // Force reseed if FORCE_RESEED=true
    const forceReseed = process.env.FORCE_RESEED === 'true';
    
    // Check if Products table has data (better indicator)
    const productCount = await db.Product.count();
    if (productCount > 0 && !forceReseed) {
      console.log('✅ Database already has product data, skipping auto-seed.');
      return;
    }

    if (forceReseed) {
      console.log('🔄 FORCE_RESEED enabled - clearing existing data...');
      // Delete in correct order to respect foreign keys
      try {
        await db.ProductImage.destroy({ where: {}, force: true });
        await db.ProductVariant.destroy({ where: {}, force: true });
        await db.Product.destroy({ where: {}, force: true });
        await db.Category.destroy({ where: {}, force: true });
        await db.Blog.destroy({ where: {}, force: true });
        await db.PaymentMethod.destroy({ where: {}, force: true });
        await db.ShippingProvider.destroy({ where: {}, force: true });
        console.log('  ✅ Old data cleared');
      } catch (e) {
        console.log('  ⚠️ Clear error:', e.message);
      }
    }

    console.log('🌱 Starting auto-seed...');

    // --- 1. Check/Seed Users ---
    const userCount = await db.User.count();
    if (userCount === 0) {
      console.log('  → Seeding Users...');
      const salt = await bcrypt.genSalt(10);
      const hashedPasswordAdmin = await bcrypt.hash('Linh2308@', salt);
      const hashedPasswordUser = await bcrypt.hash('User123456', salt);

      await db.User.bulkCreate([
        {
          Username: 'admin',
          Email: 'admin@example.com',
          Password: hashedPasswordAdmin,
          Role: 'admin',
          FullName: 'Nguyễn Văn Quản Trị',
          Phone: '0901234567',
          TwoFactorEnabled: false,
          IsEmailVerified: true
        },
        {
          Username: 'user1',
          Email: 'user1@example.com',
          Password: hashedPasswordUser,
          Role: 'user',
          FullName: 'Trần Thị Người Dùng',
          Phone: '0912345678',
          TwoFactorEnabled: false,
          IsEmailVerified: true
        }
      ]);
      console.log('  ✅ Users seeded');
    } else {
      console.log('  ✅ Users already exist, skipping...');
    }

    // --- 2. Seed Categories ---
    console.log('  → Seeding Categories...');
    await db.Category.bulkCreate([
      { Name: 'Giày Thể Thao Nam', Description: 'Giày thể thao dành cho nam', TargetGroup: 'Men', IsActive: true },
      { Name: 'Giày Thể Thao Nữ', Description: 'Giày thể thao dành cho nữ', TargetGroup: 'Women', IsActive: true },
      { Name: 'Giày Công Sở Nam', Description: 'Giày công sở dành cho nam', TargetGroup: 'Men', IsActive: true },
      { Name: 'Giày Công Sở Nữ', Description: 'Giày công sở dành cho nữ', TargetGroup: 'Women', IsActive: true },
      { Name: 'Giày Sandal Nam', Description: 'Giày sandal dành cho nam', TargetGroup: 'Men', IsActive: true },
      { Name: 'Giày Sandal Nữ', Description: 'Giày sandal dành cho nữ', TargetGroup: 'Women', IsActive: true },
      { Name: 'Sneaker Unisex', Description: 'Sneaker dành cho cả nam và nữ', TargetGroup: 'Unisex', IsActive: true },
    ]);
    console.log('  ✅ Categories seeded');

    // --- 3. Seed Products ---
    console.log('  → Seeding Products...');
    const categories = await db.Category.findAll();
    const catMap = {};
    categories.forEach(c => { catMap[c.Name] = c.CategoryID; });

    const products = [
      // Sport Men
      { Name: 'Giày Thể Thao Nam Sport 01', Description: 'Giày thể thao nam phong cách hiện đại', Price: 2500000, DiscountPercent: 10, CategoryID: catMap['Giày Thể Thao Nam'] },
      { Name: 'Giày Thể Thao Nam Sport 02', Description: 'Giày thể thao nam thoải mái', Price: 2600000, DiscountPercent: 5, CategoryID: catMap['Giày Thể Thao Nam'] },
      // Sport Women
      { Name: 'Giày Thể Thao Nữ Sport 01', Description: 'Giày thể thao nữ phong cách', Price: 2400000, DiscountPercent: 15, CategoryID: catMap['Giày Thể Thao Nữ'] },
      { Name: 'Giày Thể Thao Nữ Sport 02', Description: 'Giày thể thao nữ năng động', Price: 2300000, DiscountPercent: 10, CategoryID: catMap['Giày Thể Thao Nữ'] },
      // Office Men
      { Name: 'Giày Công Sở Nam Office 01', Description: 'Giày công sở nam lịch lãm', Price: 1800000, DiscountPercent: 5, CategoryID: catMap['Giày Công Sở Nam'] },
      { Name: 'Giày Công Sở Nam Office 02', Description: 'Giày công sở nam sang trọng', Price: 1900000, DiscountPercent: 0, CategoryID: catMap['Giày Công Sở Nam'] },
      // Office Women
      { Name: 'Giày Công Sở Nữ Office 01', Description: 'Giày công sở nữ thanh lịch', Price: 1600000, DiscountPercent: 10, CategoryID: catMap['Giày Công Sở Nữ'] },
      { Name: 'Giày Công Sở Nữ Office 02', Description: 'Giày công sở nữ cao cấp', Price: 1700000, DiscountPercent: 5, CategoryID: catMap['Giày Công Sở Nữ'] },
      // Sandal
      { Name: 'Sandal Nam Casual 01', Description: 'Sandal nam thoải mái', Price: 800000, DiscountPercent: 20, CategoryID: catMap['Giày Sandal Nam'] },
      { Name: 'Sandal Nữ Casual 01', Description: 'Sandal nữ thời trang', Price: 750000, DiscountPercent: 15, CategoryID: catMap['Giày Sandal Nữ'] },
      // Sneaker
      { Name: 'Sneaker Unisex Classic 01', Description: 'Sneaker unisex phong cách', Price: 2200000, DiscountPercent: 10, CategoryID: catMap['Sneaker Unisex'] },
      { Name: 'Sneaker Unisex Modern 02', Description: 'Sneaker unisex hiện đại', Price: 2400000, DiscountPercent: 5, CategoryID: catMap['Sneaker Unisex'] },
    ];
    
    await db.Product.bulkCreate(products);
    console.log('  ✅ Products seeded');

    // --- 4. Seed Product Variants ---
    console.log('  → Seeding Product Variants...');
    const allProducts = await db.Product.findAll();
    const variants = [];
    
    allProducts.forEach((prod, idx) => {
      const sizes = prod.CategoryID === catMap['Giày Thể Thao Nữ'] || prod.CategoryID === catMap['Giày Công Sở Nữ'] || prod.CategoryID === catMap['Giày Sandal Nữ']
        ? ['36', '37', '38', '39']
        : ['40', '41', '42', '43'];
      
      sizes.forEach(size => {
        ['Đen', 'Trắng'].forEach(color => {
          variants.push({
            ProductID: prod.ProductID,
            Size: size,
            Color: color,
            StockQuantity: 10,
            SKU: `SKU-${prod.ProductID}-${size}-${color === 'Đen' ? 'BLK' : 'WHT'}`,
            IsActive: true
          });
        });
      });
    });
    
    await db.ProductVariant.bulkCreate(variants);
    console.log('  ✅ Product Variants seeded');

    // --- 5. Seed Product Images (using Cloudinary URLs) ---
    console.log('  → Seeding Product Images...');
    const allVariants = await db.ProductVariant.findAll({ include: ['product'] });
    const images = [];
    
    // Map category to image folder and prefix
    const categoryImageMap = {
      'Giày Thể Thao Nam': { folder: 'SPORT/MEN', prefix: 'sport' },
      'Giày Thể Thao Nữ': { folder: 'SPORT/WOMEN', prefix: 'sport' },
      'Giày Công Sở Nam': { folder: 'OFFICE/MEN', prefix: 'office' },
      'Giày Công Sở Nữ': { folder: 'OFFICE/WOMEN', prefix: 'office' },
      'Giày Sandal Nam': { folder: 'SANDAL/MEN', prefix: 'sandal' },
      'Giày Sandal Nữ': { folder: 'SANDAL/WOMEN', prefix: 'sandal' },
      'Sneaker Unisex': { folder: 'SNEAKER/UNISEX', prefix: 'sneaker' },
    };
    
    // Get category names
    const prodCategories = {};
    const prods = await db.Product.findAll({ include: ['category'] });
    prods.forEach(p => {
      prodCategories[p.ProductID] = p.category?.Name;
    });
    
    // Product index tracker per category
    const categoryProductIndex = {};
    
    allVariants.forEach((variant) => {
      const catName = prodCategories[variant.ProductID];
      const imgConfig = categoryImageMap[catName];
      
      if (!imgConfig) return;
      
      // Track product index within category
      const key = `${catName}-${variant.ProductID}`;
      if (!categoryProductIndex[key]) {
        const existingCount = Object.keys(categoryProductIndex).filter(k => k.startsWith(catName)).length;
        categoryProductIndex[key] = existingCount + 1;
      }
      const prodNum = categoryProductIndex[key];
      
      const colorSuffix = variant.Color === 'Đen' ? 'den' : 'trang';
      const imageUrl = `${CLOUDINARY_BASE}/${imgConfig.folder}/${imgConfig.prefix}${prodNum}${colorSuffix}.jpg`;
      
      images.push({
        ProductID: variant.ProductID,
        VariantID: variant.VariantID,
        ImageURL: imageUrl,
        IsDefault: variant.Color === 'Đen'
      });
    });
    
    await db.ProductImage.bulkCreate(images);
    console.log('  ✅ Product Images seeded');

    // --- 6. Seed Payment Methods ---
    console.log('  → Seeding Payment Methods...');
    await db.PaymentMethod.bulkCreate([
      { Code: 'COD', Name: 'Thanh toán khi nhận hàng', Type: 'OFFLINE', IsActive: true },
      { Code: 'VNPAY', Name: 'Thanh toán qua VNPay', Type: 'ONLINE', Provider: 'VNPay', IsActive: true },
    ]);
    console.log('  ✅ Payment Methods seeded');

    // --- 7. Seed Shipping Providers ---
    console.log('  → Seeding Shipping Providers...');
    await db.ShippingProvider.bulkCreate([
      { Code: 'STANDARD', Name: 'Giao hàng tiêu chuẩn', Fee: 30000, IsActive: true },
      { Code: 'EXPRESS', Name: 'Giao hàng nhanh', Fee: 50000, IsActive: true },
    ]);
    console.log('  ✅ Shipping Providers seeded');

    // --- 8. Seed Blogs ---
    console.log('  → Seeding Blogs...');
    await db.Blog.bulkCreate([
      {
        Title: 'Hướng dẫn chọn giày phù hợp',
        Content: 'Việc chọn giày phù hợp rất quan trọng để bảo vệ đôi chân của bạn. Đầu tiên, hãy đo kích thước chân chính xác. Thử giày vào buổi chiều khi chân đã giãn nở. Đảm bảo có khoảng trống 1cm ở mũi giày...',
        Author: 'Admin',
        ImageURL: `${CLOUDINARY_BASE}/blogs/blog-size-online.webp`,
        IsActive: true
      },
      {
        Title: 'Xu hướng giày 2025',
        Content: 'Năm 2025 chứng kiến sự trở lại của phong cách retro với sneaker chunky và giày cao gót block heel. Màu sắc pastel và earth tone vẫn được ưa chuộng...',
        Author: 'Admin',
        ImageURL: `${CLOUDINARY_BASE}/blogs/blog-5-kieu-giay.webp`,
        IsActive: true
      },
      {
        Title: 'Cách bảo quản giày da',
        Content: 'Giày da cần được bảo quản đúng cách để giữ được độ bền. Hãy lau sạch sau mỗi lần sử dụng, dùng xi đánh giày định kỳ, và bảo quản nơi khô ráo thoáng mát...',
        Author: 'Admin',
        ImageURL: `${CLOUDINARY_BASE}/blogs/blog-cham-soc-giay-da.webp`,
        IsActive: true
      }
    ]);
    console.log('  ✅ Blogs seeded');

    console.log('🎉 Auto-seed completed successfully!');
    
  } catch (error) {
    console.error('❌ Auto-seed failed:', error.message);
    console.error(error.stack);
    // Don't throw - let server continue even if seed fails
  }
};

module.exports = autoSeed;
