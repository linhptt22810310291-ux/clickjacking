'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Coupons', {
      CouponID: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      Code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      DiscountType: {
        type: Sequelize.ENUM('Percent', 'FixedAmount'),
        allowNull: false,
        defaultValue: 'Percent'
      },
      DiscountValue: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      MinPurchaseAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
      },
      ExpiryDate: {
        type: Sequelize.DATE,
        allowNull: false
      },
      MaxUses: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      UsedCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      IsPublic: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      UsesPerUser: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      ApplicableType: {
        type: Sequelize.ENUM('All', 'Category', 'Product'),
        allowNull: false,
        defaultValue: 'All',
        comment: 'Voucher áp dụng cho: Toàn bộ, Danh mục, hoặc Sản phẩm cụ thể'
      },
      ApplicableIDs: {
        type: Sequelize.STRING(1000), // Lưu một chuỗi các ID, ví dụ: "1,5,12"
        allowNull: true,
        comment: 'Danh sách ID (CategoryIDs hoặc ProductIDs) được áp dụng'
      },

      CreatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Coupons');
  }
};