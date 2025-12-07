'use strict';

/**
 * Script để xóa và insert lại toàn bộ sản phẩm vào PostgreSQL production
 * Chạy: node scripts/reseed-production.js
 */

const { Sequelize, QueryTypes } = require('sequelize');

// Cloudinary base URL
const CLOUDINARY_BASE = 'https://res.cloudinary.com/ddduuddmz/image/upload/v1764329879/webgiay';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://clickjacking_user:VqysEFnX4EwNwCvwRihCGXgxP9ONOKA1@dpg-d4kmpafpm1nc738btuo0-a.singapore-postgres.render.com/clickjacking';

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false
});

async function reseedProducts() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Connected!\n');

    // 1. Xóa dữ liệu cũ (theo thứ tự để tránh FK constraint)
    console.log('🗑️ Deleting old data...');
    await sequelize.query('DELETE FROM "ProductImages"', { transaction });
    console.log('  - ProductImages deleted');
    await sequelize.query('DELETE FROM "CartItems"', { transaction });
    console.log('  - CartItems deleted');
    await sequelize.query('DELETE FROM "OrderItems"', { transaction });
    console.log('  - OrderItems deleted');
    await sequelize.query('DELETE FROM "GuestOrderItems"', { transaction });
    console.log('  - GuestOrderItems deleted');
    await sequelize.query('DELETE FROM "ProductVariants"', { transaction });
    console.log('  - ProductVariants deleted');
    await sequelize.query('DELETE FROM "Products"', { transaction });
    console.log('  - Products deleted');
    console.log('✅ Old data deleted!\n');

    // 2. Lấy Category IDs
    console.log('📂 Getting categories...');
    const categories = await sequelize.query(
      'SELECT "CategoryID", "Name" FROM "Categories"',
      { type: QueryTypes.SELECT, transaction }
    );
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.Name] = cat.CategoryID;
    });
    console.log('  Categories found:', Object.keys(categoryMap).join(', '));

    // 3. Insert Products
    console.log('\n📦 Inserting products...');
    const allProducts = [
      // Sport Men (10 products)
      ...Array.from({length: 10}, (_, i) => ({
        Name: `Giày Thể Thao Nam Model ${String(i+1).padStart(3, '0')}`,
        Description: `Giày thể thao nam phong cách hiện đại, thoải mái cho mọi hoạt động.`,
        Price: 2500000 + (i * 50000),
        DiscountPercent: [5, 10, 0, 8, 15, 5, 10, 0, 20, 12][i],
        CategoryID: categoryMap['Giày Thể Thao Nam']
      })),
      
      // Sport Women (10 products)
      ...Array.from({length: 10}, (_, i) => ({
        Name: `Giày Thể Thao Nữ Model ${String(i+1).padStart(3, '0')}`,
        Description: `Giày thể thao nữ năng động, thiết kế trẻ trung.`,
        Price: 2400000 + (i * 50000),
        DiscountPercent: [5, 10, 0, 8, 15, 5, 10, 0, 20, 12][i],
        CategoryID: categoryMap['Giày Thể Thao Nữ']
      })),
      
      // Office Men (10 products)
      ...Array.from({length: 10}, (_, i) => ({
        Name: `Giày Công Sở Nam Model ${String(i+1).padStart(3, '0')}`,
        Description: `Giày công sở nam lịch lãm, phù hợp môi trường văn phòng.`,
        Price: 1500000 + (i * 50000),
        DiscountPercent: [5, 10, 0, 8, 15, 5, 10, 0, 20, 12][i],
        CategoryID: categoryMap['Giày Công Sở Nam']
      })),
      
      // Office Women (10 products)
      ...Array.from({length: 10}, (_, i) => ({
        Name: `Giày Công Sở Nữ Model ${String(i+1).padStart(3, '0')}`,
        Description: `Giày công sở nữ thanh lịch, sang trọng.`,
        Price: 1400000 + (i * 50000),
        DiscountPercent: [5, 10, 0, 8, 15, 5, 10, 0, 20, 12][i],
        CategoryID: categoryMap['Giày Công Sở Nữ']
      })),
      
      // Sandal Men (10 products)
      ...Array.from({length: 10}, (_, i) => ({
        Name: `Giày Sandal Nam Model ${String(i+1).padStart(3, '0')}`,
        Description: `Sandal nam thoáng mát, phù hợp mùa hè.`,
        Price: 800000 + (i * 30000),
        DiscountPercent: [5, 10, 0, 8, 15, 5, 10, 0, 20, 12][i],
        CategoryID: categoryMap['Giày Sandal Nam']
      })),
      
      // Sandal Women (10 products)
      ...Array.from({length: 10}, (_, i) => ({
        Name: `Giày Sandal Nữ Model ${String(i+1).padStart(3, '0')}`,
        Description: `Sandal nữ thời trang, dễ phối đồ.`,
        Price: 700000 + (i * 30000),
        DiscountPercent: [5, 10, 0, 8, 15, 5, 10, 0, 20, 12][i],
        CategoryID: categoryMap['Giày Sandal Nữ']
      })),
      
      // Sneaker Unisex (10 products)
      ...Array.from({length: 10}, (_, i) => ({
        Name: `Sneaker Unisex Model ${String(i+1).padStart(3, '0')}`,
        Description: `Sneaker unisex cá tính, phù hợp cả nam và nữ.`,
        Price: 2000000 + (i * 50000),
        DiscountPercent: [5, 10, 0, 8, 15, 5, 10, 0, 20, 12][i],
        CategoryID: categoryMap['Sneaker Unisex']
      })),
    ];

    // Insert products one by one to get IDs
    const insertedProducts = [];
    for (const product of allProducts) {
      const [result] = await sequelize.query(
        `INSERT INTO "Products" ("Name", "Description", "Price", "DiscountPercent", "CategoryID", "CreatedAt") 
         VALUES (:name, :desc, :price, :discount, :catId, NOW()) 
         RETURNING "ProductID"`,
        {
          replacements: {
            name: product.Name,
            desc: product.Description,
            price: product.Price,
            discount: product.DiscountPercent,
            catId: product.CategoryID
          },
          type: QueryTypes.INSERT,
          transaction
        }
      );
      insertedProducts.push({
        ProductID: result[0].ProductID,
        CategoryID: product.CategoryID,
        Name: product.Name
      });
    }
    console.log(`  ✅ Inserted ${insertedProducts.length} products`);

    // 4. Insert Variants
    console.log('\n🎨 Inserting variants...');
    const sizesMap = {
      'Giày Thể Thao Nam': ['39', '40', '41', '42', '43'],
      'Giày Thể Thao Nữ': ['36', '37', '38', '39', '40'],
      'Giày Công Sở Nam': ['39', '40', '41', '42', '43'],
      'Giày Công Sở Nữ': ['36', '37', '38', '39', '40'],
      'Giày Sandal Nam': ['39', '40', '41', '42', '43'],
      'Giày Sandal Nữ': ['36', '37', '38', '39', '40'],
      'Sneaker Unisex': ['36', '37', '38', '39', '40', '41', '42', '43'],
    };
    
    const colors = ['Đen', 'Trắng'];
    const insertedVariants = [];
    let variantCount = 0;

    for (const product of insertedProducts) {
      const categoryName = Object.keys(categoryMap).find(k => categoryMap[k] === product.CategoryID);
      const sizes = sizesMap[categoryName] || ['39', '40', '41'];
      
      for (const size of sizes) {
        for (const color of colors) {
          const colorCode = color === 'Đen' ? 'BLACK' : 'WHITE';
          const sku = `SKU-${product.ProductID}-${size}-${colorCode}`;
          
          const [result] = await sequelize.query(
            `INSERT INTO "ProductVariants" ("ProductID", "Size", "Color", "StockQuantity", "SKU", "IsActive") 
             VALUES (:productId, :size, :color, 10, :sku, true) 
             RETURNING "VariantID"`,
            {
              replacements: {
                productId: product.ProductID,
                size: size,
                color: color,
                sku: sku
              },
              type: QueryTypes.INSERT,
              transaction
            }
          );
          insertedVariants.push({
            VariantID: result[0].VariantID,
            ProductID: product.ProductID,
            Size: size,
            Color: color
          });
          variantCount++;
        }
      }
    }
    console.log(`  ✅ Inserted ${variantCount} variants`);

    // 5. Insert Images với Cloudinary URLs
    console.log('\n🖼️ Inserting images with Cloudinary URLs...');
    const imageMapping = [
      { categoryName: 'Giày Thể Thao Nam', path: 'SPORT/MEN', prefix: 'sport', defaultSize: '39' },
      { categoryName: 'Giày Thể Thao Nữ', path: 'SPORT/WOMEN', prefix: 'sport', defaultSize: '36' },
      { categoryName: 'Giày Công Sở Nam', path: 'OFFICE/MEN', prefix: 'office', defaultSize: '39' },
      { categoryName: 'Giày Công Sở Nữ', path: 'OFFICE/WOMEN', prefix: 'office', defaultSize: '36' },
      { categoryName: 'Giày Sandal Nam', path: 'SANDAL/MEN', prefix: 'sandal', defaultSize: '39' },
      { categoryName: 'Giày Sandal Nữ', path: 'SANDAL/WOMEN', prefix: 'sandal', defaultSize: '36' },
      { categoryName: 'Sneaker Unisex', path: 'SNEAKER/UNISEX', prefix: 'sneaker', defaultSize: '36' },
    ];

    let imageCount = 0;
    for (const mapping of imageMapping) {
      const categoryId = categoryMap[mapping.categoryName];
      const categoryProducts = insertedProducts.filter(p => p.CategoryID === categoryId);
      
      for (let i = 0; i < categoryProducts.length; i++) {
        const product = categoryProducts[i];
        const imageNum = i + 1;
        
        // Tìm variant đen và trắng cho sản phẩm này
        const blackVariant = insertedVariants.find(
          v => v.ProductID === product.ProductID && v.Size === mapping.defaultSize && v.Color === 'Đen'
        );
        const whiteVariant = insertedVariants.find(
          v => v.ProductID === product.ProductID && v.Size === mapping.defaultSize && v.Color === 'Trắng'
        );

        // Insert ảnh đen (IsDefault = true)
        if (blackVariant) {
          const blackImageUrl = `${CLOUDINARY_BASE}/${mapping.path}/${mapping.prefix}${imageNum}den.jpg`;
          await sequelize.query(
            `INSERT INTO "ProductImages" ("ProductID", "VariantID", "ImageURL", "IsDefault", "CreatedAt") 
             VALUES (:productId, :variantId, :imageUrl, true, NOW())`,
            {
              replacements: {
                productId: product.ProductID,
                variantId: blackVariant.VariantID,
                imageUrl: blackImageUrl
              },
              transaction
            }
          );
          imageCount++;
        }

        // Insert ảnh trắng (IsDefault = false)
        if (whiteVariant) {
          const whiteImageUrl = `${CLOUDINARY_BASE}/${mapping.path}/${mapping.prefix}${imageNum}trang.jpg`;
          await sequelize.query(
            `INSERT INTO "ProductImages" ("ProductID", "VariantID", "ImageURL", "IsDefault", "CreatedAt") 
             VALUES (:productId, :variantId, :imageUrl, false, NOW())`,
            {
              replacements: {
                productId: product.ProductID,
                variantId: whiteVariant.VariantID,
                imageUrl: whiteImageUrl
              },
              transaction
            }
          );
          imageCount++;
        }
      }
    }
    console.log(`  ✅ Inserted ${imageCount} images`);

    // Commit transaction
    await transaction.commit();
    
    console.log('\n========================================');
    console.log('✅ RESEED COMPLETED SUCCESSFULLY!');
    console.log('========================================');
    console.log(`📊 Summary:`);
    console.log(`   - Products: ${insertedProducts.length}`);
    console.log(`   - Variants: ${variantCount}`);
    console.log(`   - Images: ${imageCount}`);
    console.log('========================================\n');

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

reseedProducts();
