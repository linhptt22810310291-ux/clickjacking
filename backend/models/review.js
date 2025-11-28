'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Review extends Model {
    static associate(models) {
      Review.belongsTo(models.User,    { foreignKey: 'UserID',   as: 'user' });
      Review.belongsTo(models.Product, { foreignKey: 'ProductID',as: 'product' });
      Review.belongsTo(models.Order,   { foreignKey: 'OrderID',  as: 'order' }); // ✅
      Review.hasMany(models.ReviewMedia, { foreignKey: 'ReviewID', as: 'media' });
    }
  }

  Review.init({
    ReviewID:  { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true, field: 'ReviewID' },
    UserID:    { type: DataTypes.INTEGER, allowNull: false, field: 'UserID' },
    ProductID: { type: DataTypes.INTEGER, allowNull: false, field: 'ProductID' },
    OrderID:   { type: DataTypes.INTEGER, allowNull: false, field: 'OrderID' }, // ✅
    Rating:    { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 }, field: 'Rating' },
    Comment:   { type: DataTypes.STRING(500), allowNull: true, field: 'Comment' },
    CreatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'CreatedAt' }
  }, {
    sequelize,
    modelName: 'Review',
    tableName: 'Reviews',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['UserID', 'ProductID', 'OrderID'] } // ✅
    ]
  });

  return Review;
};
