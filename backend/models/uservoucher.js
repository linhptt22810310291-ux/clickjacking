'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserVoucher extends Model {
    static associate(models) {
      UserVoucher.belongsTo(models.User, { foreignKey: 'UserID', as: 'user' });
      UserVoucher.belongsTo(models.Coupon, { foreignKey: 'CouponID', as: 'coupon' });
    }
  }
  UserVoucher.init({
    // === THÊM KHÓA CHÍNH MỚI ===
    UserVoucherID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    // === SỬA KHÓA CŨ ===
    UserID: {
      type: DataTypes.INTEGER,
      // primaryKey: false, // <-- Xóa dòng này
      allowNull: false,
      references: {
        model: 'Users', 
        key: 'UserID'
      }
    },
    CouponID: {
      type: DataTypes.INTEGER,
      // primaryKey: false, // <-- Xóa dòng này
      allowNull: false,
      references: {
        model: 'Coupons', 
        key: 'CouponID'
      }
    },
    IsUsed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  }, {
    sequelize,
    modelName: 'UserVoucher',
    tableName: 'UserVouchers',
    timestamps: true, 
    updatedAt: false  
  });
  return UserVoucher;
};