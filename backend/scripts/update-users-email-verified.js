const db = require('../models');

async function updateExistingUsers() {
  try {
    console.log('🔄 Đang cập nhật users hiện tại...');

    // 1. Cập nhật tất cả admin: auto-verify email
    const [adminUpdated] = await db.sequelize.query(`
      UPDATE Users 
      SET IsEmailVerified = 1, 
          HasReceivedWelcomeVoucher = 0
      WHERE Role = 'admin'
    `);
    console.log(`✅ Đã cập nhật ${adminUpdated} tài khoản admin`);

    // 2. Cập nhật tất cả user hiện tại: auto-verify email
    const [userUpdated] = await db.sequelize.query(`
      UPDATE Users 
      SET IsEmailVerified = 1
      WHERE (IsEmailVerified = 0 OR IsEmailVerified IS NULL)
        AND Role = 'user'
    `);
    console.log(`✅ Đã cập nhật ${userUpdated} tài khoản user hiện tại`);

    // 3. Hiển thị kết quả
    const [users] = await db.sequelize.query(`
      SELECT UserID, Username, Email, Role, IsEmailVerified, HasReceivedWelcomeVoucher 
      FROM Users
      ORDER BY Role, UserID
    `);

    console.log('\n📋 Danh sách users sau khi cập nhật:');
    console.table(users);

    console.log('\n✨ Hoàn tất! Giờ bạn có thể restart backend và test.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Lỗi khi cập nhật:', error);
    process.exit(1);
  }
}

updateExistingUsers();
