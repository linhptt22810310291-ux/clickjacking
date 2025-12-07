'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ChatAutoReply extends Model {
    static associate(models) {
      // No associations needed
    }
  }

  ChatAutoReply.init({
    ReplyID: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      field: 'ReplyID'
    },
    TriggerKeywords: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'TriggerKeywords',
      comment: 'Comma-separated list of trigger keywords'
    },
    Response: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'Response'
    },
    Priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'Priority'
    },
    IsActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'IsActive'
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
    modelName: 'ChatAutoReply',
    tableName: 'ChatAutoReplies',
    timestamps: false
  });

  return ChatAutoReply;
};
