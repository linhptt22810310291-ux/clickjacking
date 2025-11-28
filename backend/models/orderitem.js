'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class OrderItem extends Model {
    static associate(models) {
      // PHẢI đúng alias 'variant' và 'order' để controller include không lỗi
      OrderItem.belongsTo(models.ProductVariant, { foreignKey: 'VariantID', as: 'variant' });
      OrderItem.belongsTo(models.Order,         { foreignKey: 'OrderID',   as: 'order'   });
      // nếu có liên kết khác thì giữ nguyên
    }
  }

  OrderItem.init({
    OrderItemID: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, field: 'OrderItemID' },
    OrderID:     { type: DataTypes.INTEGER, allowNull: false, field: 'OrderID' },
    VariantID:   { type: DataTypes.INTEGER, allowNull: false, field: 'VariantID' },
    Quantity:    { type: DataTypes.INTEGER, allowNull: false, field: 'Quantity' },
    Price:       { type: DataTypes.DECIMAL(18,2), allowNull: false, field: 'Price' }
  }, {
    sequelize,
    modelName: 'OrderItem',
    tableName: 'OrderItems',
    timestamps: false
  });

  return OrderItem;
};
