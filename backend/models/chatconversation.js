'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ChatConversation extends Model {
    static associate(models) {
      ChatConversation.belongsTo(models.User, { foreignKey: 'UserID', as: 'user' });
      ChatConversation.belongsTo(models.User, { foreignKey: 'AssignedAdminID', as: 'assignedAdmin' });
      ChatConversation.belongsTo(models.Product, { foreignKey: 'ProductID', as: 'product' });
      ChatConversation.belongsTo(models.Order, { foreignKey: 'OrderID', as: 'order' });
      ChatConversation.hasMany(models.ChatMessage, { foreignKey: 'ConversationID', as: 'messages' });
    }
  }

  ChatConversation.init({
    ConversationID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'ConversationID'
    },
    UserID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'UserID'
    },
    GuestSessionID: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'GuestSessionID'
    },
    GuestName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'GuestName'
    },
    GuestEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'GuestEmail'
    },
    Subject: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'Subject'
    },
    ProductID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'ProductID'
    },
    OrderID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'OrderID'
    },
    Status: {
      type: DataTypes.ENUM('open', 'waiting', 'replied', 'closed'),
      defaultValue: 'open',
      field: 'Status'
    },
    AssignedAdminID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'AssignedAdminID'
    },
    IsBotHandling: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'IsBotHandling'
    },
    LastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'LastMessageAt'
    },
    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'CreatedAt'
    },
    UpdatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'UpdatedAt'
    }
  }, {
    sequelize,
    modelName: 'ChatConversation',
    tableName: 'ChatConversations',
    timestamps: false
  });

  return ChatConversation;
};
