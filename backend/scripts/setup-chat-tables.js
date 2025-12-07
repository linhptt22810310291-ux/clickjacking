/**
 * Script to create Chat tables and add OrderItemID to Reviews
 * Run this script to set up the chat system on production PostgreSQL
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://clickjacking_user:VqysEFnX4EwNwCvwRihCGXgxP9ONOKA1@dpg-d4kmpafpm1nc738btuo0-a.singapore-postgres.render.com/clickjacking';

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: console.log
});

async function setupChatTables() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connected successfully!\n');

    // 1. Add OrderItemID to Reviews if not exists
    console.log('1. Adding OrderItemID column to Reviews table...');
    try {
      await sequelize.query(`
        ALTER TABLE "Reviews" 
        ADD COLUMN IF NOT EXISTS "OrderItemID" INTEGER REFERENCES "OrderItems"("OrderItemID") ON DELETE SET NULL
      `);
      console.log('   ✓ OrderItemID column added or already exists\n');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('   ✓ OrderItemID column already exists\n');
      } else {
        throw err;
      }
    }

    // 2. Create ChatConversations table
    console.log('2. Creating ChatConversations table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "ChatConversations" (
        "ConversationID" SERIAL PRIMARY KEY,
        "UserID" INTEGER REFERENCES "Users"("UserID") ON DELETE SET NULL,
        "GuestSessionID" VARCHAR(100),
        "GuestName" VARCHAR(100),
        "GuestEmail" VARCHAR(255),
        "Subject" VARCHAR(255),
        "ProductID" INTEGER REFERENCES "Products"("ProductID") ON DELETE SET NULL,
        "OrderID" INTEGER REFERENCES "Orders"("OrderID") ON DELETE SET NULL,
        "Status" VARCHAR(20) DEFAULT 'open',
        "AssignedAdminID" INTEGER REFERENCES "Users"("UserID") ON DELETE SET NULL,
        "IsBotHandling" BOOLEAN DEFAULT true,
        "LastMessageAt" TIMESTAMP,
        "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "UpdatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✓ ChatConversations table created or already exists\n');

    // 3. Create ChatMessages table
    console.log('3. Creating ChatMessages table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "ChatMessages" (
        "MessageID" SERIAL PRIMARY KEY,
        "ConversationID" INTEGER NOT NULL REFERENCES "ChatConversations"("ConversationID") ON DELETE CASCADE,
        "SenderType" VARCHAR(20) NOT NULL,
        "SenderID" INTEGER,
        "Message" TEXT NOT NULL,
        "IsBlocked" BOOLEAN DEFAULT false,
        "BlockedReason" VARCHAR(255),
        "ReadAt" TIMESTAMP,
        "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✓ ChatMessages table created or already exists\n');

    // 4. Create ChatBannedKeywords table
    console.log('4. Creating ChatBannedKeywords table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "ChatBannedKeywords" (
        "KeywordID" SERIAL PRIMARY KEY,
        "Keyword" VARCHAR(100) UNIQUE NOT NULL,
        "IsActive" BOOLEAN DEFAULT true,
        "CreatedBy" INTEGER REFERENCES "Users"("UserID"),
        "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✓ ChatBannedKeywords table created or already exists\n');

    // 5. Create ChatAutoReplies table
    console.log('5. Creating ChatAutoReplies table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "ChatAutoReplies" (
        "ReplyID" SERIAL PRIMARY KEY,
        "TriggerKeywords" TEXT NOT NULL,
        "Response" TEXT NOT NULL,
        "Priority" INTEGER DEFAULT 0,
        "IsActive" BOOLEAN DEFAULT true,
        "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "UpdatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✓ ChatAutoReplies table created or already exists\n');

    // 6. Insert default auto-replies
    console.log('6. Seeding default auto-replies and banned keywords...');
    
    // Check if auto replies exist
    const [existingReplies] = await sequelize.query(`SELECT COUNT(*) as count FROM "ChatAutoReplies"`);
    if (parseInt(existingReplies[0].count) === 0) {
      await sequelize.query(`
        INSERT INTO "ChatAutoReplies" ("TriggerKeywords", "Response", "Priority", "IsActive")
        VALUES 
          ('xin chào,hello,hi,chào,hey', 'Xin chào! Cảm ơn bạn đã liên hệ với ShoeShop. Tôi có thể giúp gì cho bạn?', 100, true),
          ('giá,bao nhiêu,giá tiền,price,cost', 'Bạn có thể xem giá sản phẩm trực tiếp trên trang web của chúng tôi. Nếu cần hỗ trợ thêm về giá, vui lòng cho biết tên sản phẩm cụ thể!', 90, true),
          ('size,kích cỡ,kích thước,cỡ giày', 'Chúng tôi có đầy đủ các size từ 36-45. Bạn có thể tham khảo bảng size trên trang chi tiết sản phẩm hoặc cho tôi biết chiều dài chân để được tư vấn!', 85, true),
          ('giao hàng,ship,shipping,vận chuyển,delivery', 'Chúng tôi giao hàng toàn quốc trong 2-5 ngày làm việc. Phí ship tùy thuộc vào khu vực của bạn. Bạn muốn biết thêm chi tiết không?', 80, true),
          ('đổi trả,return,hoàn tiền,refund,đổi size', 'ShoeShop hỗ trợ đổi trả trong vòng 7 ngày kể từ ngày nhận hàng với sản phẩm còn nguyên tem mác. Bạn cần hỗ trợ đổi trả sản phẩm nào?', 80, true),
          ('thanh toán,payment,trả tiền,cod,chuyển khoản', 'Chúng tôi hỗ trợ thanh toán: COD (thanh toán khi nhận hàng), chuyển khoản ngân hàng, và các ví điện tử. Bạn muốn thanh toán bằng phương thức nào?', 75, true),
          ('khuyến mãi,giảm giá,sale,discount,mã giảm', 'Để xem các chương trình khuyến mãi hiện tại, bạn vui lòng truy cập trang chủ hoặc theo dõi fanpage của chúng tôi để không bỏ lỡ ưu đãi nào nhé!', 70, true),
          ('đơn hàng,order,theo dõi,tracking,tình trạng', 'Bạn có thể theo dõi đơn hàng trong mục "Đơn hàng của tôi" sau khi đăng nhập. Nếu cần hỗ trợ, vui lòng cung cấp mã đơn hàng để tôi kiểm tra giúp bạn!', 70, true),
          ('tư vấn,consult,hỗ trợ,help,giúp', 'Tôi sẵn sàng tư vấn cho bạn! Bạn đang quan tâm đến loại giày nào? (giày thể thao, giày da, sneaker, giày chạy bộ...)', 65, true),
          ('cảm ơn,thank,thanks,tks,tạm biệt,bye', 'Cảm ơn bạn đã liên hệ với ShoeShop! Nếu cần hỗ trợ thêm, đừng ngần ngại nhắn tin cho chúng tôi nhé. Chúc bạn một ngày tốt lành! 😊', 60, true)
      `);
      console.log('   ✓ Auto-replies seeded\n');
    } else {
      console.log('   ✓ Auto-replies already exist, skipping seed\n');
    }

    // Check if banned keywords exist
    const [existingKeywords] = await sequelize.query(`SELECT COUNT(*) as count FROM "ChatBannedKeywords"`);
    if (parseInt(existingKeywords[0].count) === 0) {
      await sequelize.query(`
        INSERT INTO "ChatBannedKeywords" ("Keyword", "IsActive")
        VALUES 
          ('spam', true),
          ('quảng cáo', true),
          ('lừa đảo', true),
          ('fake', true),
          ('scam', true)
      `);
      console.log('   ✓ Banned keywords seeded\n');
    } else {
      console.log('   ✓ Banned keywords already exist, skipping seed\n');
    }

    console.log('========================================');
    console.log('✓ All chat tables setup completed!');
    console.log('========================================');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error setting up chat tables:', error);
    await sequelize.close();
    process.exit(1);
  }
}

setupChatTables();
