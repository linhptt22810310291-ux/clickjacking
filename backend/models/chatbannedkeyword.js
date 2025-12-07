'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ChatBannedKeyword extends Model {
    static associate(models) {
      ChatBannedKeyword.belongsTo(models.User, { foreignKey: 'CreatedBy', as: 'creator' });
    }
  }

  ChatBannedKeyword.init({
    KeywordID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'KeywordID'
    },
    Keyword: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'Keyword'
    },
    IsActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'IsActive'
    },
    CreatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'CreatedBy'
    },
    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'CreatedAt'
    }
  }, {
    sequelize,
    modelName: 'ChatBannedKeyword',
    tableName: 'ChatBannedKeywords',
    timestamps: false
  });

  return ChatBannedKeyword;
};
