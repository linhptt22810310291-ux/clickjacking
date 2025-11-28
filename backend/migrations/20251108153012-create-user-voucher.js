'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('UserVouchers', {
      // THÊM: Khóa chính mới (thay vì composite key)
      UserVoucherID: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      UserID: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users', // Tên bảng
          key: 'UserID'
        },
        onDelete: 'CASCADE' // Tự động xóa nếu user bị xóa
      },
      CouponID: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Coupons', // Tên bảng
          key: 'CouponID'
        },
        onDelete: 'CASCADE' // Tự động xóa nếu coupon bị xóa
      },
      IsUsed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
      // Bỏ 'updatedAt' nếu bạn không cần
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('UserVouchers');
  }
};