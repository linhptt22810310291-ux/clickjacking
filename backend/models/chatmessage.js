'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ChatMessage extends Model {
    static associate(models) {
      ChatMessage.belongsTo(models.ChatConversation, { foreignKey: 'ConversationID', as: 'conversation' });
      ChatMessage.belongsTo(models.User, { foreignKey: 'SenderID', as: 'sender' });
    }
  }

  ChatMessage.init({
    MessageID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'MessageID'
    },
    ConversationID: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'ConversationID'
    },
    SenderType: {
      type: DataTypes.ENUM('user', 'guest', 'admin', 'bot'),
      allowNull: false,
      field: 'SenderType'
    },
    SenderID: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'SenderID'
    },
    Message: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'Message'
    },
    IsBlocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'IsBlocked'
    },
    BlockedReason: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'BlockedReason'
    },
    ReadAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'ReadAt'
    },
    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'CreatedAt'
    }
  }, {
    sequelize,
    modelName: 'ChatMessage',
    tableName: 'ChatMessages',
    timestamps: false
  });

  return ChatMessage;
};
