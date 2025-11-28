// Script to restore ProductImages only (không insert variants)
const db = require('../models');

async function restoreImages() {
  const transaction = await db.sequelize.transaction();
  try {
    console.log('🔄 Đang lấy danh sách variants từ database...');
    
    // Lấy tất cả variants hiện có
    const variants = await db.ProductVariant.findAll({
      attributes: ['VariantID', 'ProductID', 'Size', 'Color'],
      transaction
    });
    
    console.log(`✅ Tìm thấy ${variants.length} variants trong database`);

    // Lấy danh sách products theo category
    const products = await db.sequelize.query(`
      SELECT p.ProductID, c.Name as CategoryName 
      FROM Products p 
      JOIN Categories c ON p.CategoryID = c.CategoryID
      ORDER BY p.ProductID
    `, { 
      type: db.Sequelize.QueryTypes.SELECT, 
      transaction 
    });

    const sportMenProds = products.filter(p => p.CategoryName === 'Giày Thể Thao Nam');
    const sportWomenProds = products.filter(p => p.CategoryName === 'Giày Thể Thao Nữ');
    const officeMenProds = products.filter(p => p.CategoryName === 'Giày Công Sở Nam');
    const officeWomenProds = products.filter(p => p.CategoryName === 'Giày Công Sở Nữ');
    const sandalMenProds = products.filter(p => p.CategoryName === 'Giày Sandal Nam');
    const sandalWomenProds = products.filter(p => p.CategoryName === 'Giày Sandal Nữ');
    const sneakerUnisexProds = products.filter(p => p.CategoryName === 'Sneaker Unisex');

    console.log('📦 Phân loại products theo category:');
    console.log(`  - Sport Men: ${sportMenProds.length}`);
    console.log(`  - Sport Women: ${sportWomenProds.length}`);
    console.log(`  - Office Men: ${officeMenProds.length}`);
    console.log(`  - Office Women: ${officeWomenProds.length}`);
    console.log(`  - Sandal Men: ${sandalMenProds.length}`);
    console.log(`  - Sandal Women: ${sandalWomenProds.length}`);
    console.log(`  - Sneaker Unisex: ${sneakerUnisexProds.length}`);

    // Helper function tìm VariantID
    const getVariantId = (productId, size, color) => {
      const variant = variants.find(v => 
        v.ProductID === productId && v.Size === size && v.Color === color
      );
      return variant ? variant.VariantID : null;
    };

    // Generate image records
    const allImages = [];
    const imageCategories = [
      { products: sportMenProds, path: 'SPORT/MEN', name: 'sport', size: '39' },
      { products: sportWomenProds, path: 'SPORT/WOMEN', name: 'sport', size: '36' },
      { products: officeMenProds, path: 'OFFICE/MEN', name: 'office', size: '39' },
      { products: officeWomenProds, path: 'OFFICE/WOMEN', name: 'office', size: '36' },
      { products: sandalMenProds, path: 'SANDAL/MEN', name: 'sandal', size: '39' },
      { products: sandalWomenProds, path: 'SANDAL/WOMEN', name: 'sandal', size: '36' },
      { products: sneakerUnisexProds, path: 'SNEAKER/UNISEX', name: 'sneaker', size: '36' },
    ];

    console.log('\n🖼️  Đang tạo image records...');
    imageCategories.forEach(cat => {
      cat.products.forEach((product, index) => {
        const counter = index + 1;
        const variantIdBlack = getVariantId(product.ProductID, cat.size, 'Đen');
        const variantIdWhite = getVariantId(product.ProductID, cat.size, 'Trắng');

        if (variantIdBlack) {
          allImages.push({
            ProductID: product.ProductID,
            VariantID: variantIdBlack,
            ImageURL: `/uploads/${cat.path}/${cat.name}${counter}den.jpg`,
            IsDefault: true,
            CreatedAt: new Date()
          });
        }
        if (variantIdWhite) {
          allImages.push({
            ProductID: product.ProductID,
            VariantID: variantIdWhite,
            ImageURL: `/uploads/${cat.path}/${cat.name}${counter}trang.jpg`,
            IsDefault: false,
            CreatedAt: new Date()
          });
        }
      });
    });

    console.log(`📝 Sẽ insert ${allImages.length} image records vào database...`);
    
    // Insert images using bulkCreate
    await db.ProductImage.bulkCreate(allImages, { transaction });

    await transaction.commit();
    console.log('✅ THÀNH CÔNG! Đã khôi phục tất cả ảnh vào database.');
    console.log(`📊 Tổng số ảnh: ${allImages.length}`);
    
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ LỖI khi khôi phục ảnh:', error);
    process.exit(1);
  }
}

restoreImages();
