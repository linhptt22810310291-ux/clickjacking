// backend/seeders/20251017174535-demo-users.js
'use strict';
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const salt = await bcrypt.genSalt(10);
    const hashedPasswordAdmin = await bcrypt.hash('Linh2308@', salt);
    // === SỬA LỖI VALIDATION: Đổi mật khẩu 'password' thành 'User123456' ===
    const hashedPasswordUser1 = await bcrypt.hash('User123456', salt);

    // Kiểm tra xem users đã tồn tại chưa
    const existingUsers = await queryInterface.sequelize.query(
      `SELECT Email FROM Users WHERE Email IN ('admin@example.com', 'user1@example.com')`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (existingUsers.length === 0) {
      await queryInterface.bulkInsert('Users', [{
        Username: 'admin',
        Email: 'admin@example.com',
        Password: hashedPasswordAdmin,
        Role: 'admin',
        FullName: 'Nguyễn Văn Quản Trị',
        Phone: '0901234567',
        Address: '123 Lý Thường Kiệt, Hà Nội',
        TwoFactorEnabled: false,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      }, {
        Username: 'user1',
        Email: 'user1@example.com',
        Password: hashedPasswordUser1,
        Role: 'user',
        FullName: 'Trần Thị Người Dùng',
        Phone: '0912345678',
        Address: '456 Trần Hưng Đạo, TP.HCM',
        TwoFactorEnabled: false,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      }], {});
    } else {
      console.log('Users already exist, skipping...');
    }
  },

  async down(queryInterface, Sequelize) {
    // Lệnh "down" sẽ xóa tất cả dữ liệu trong bảng Users
    await queryInterface.bulkDelete('Users', null, {});
  }
};