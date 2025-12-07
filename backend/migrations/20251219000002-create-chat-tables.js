'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create ChatConversations table
    await queryInterface.createTable('ChatConversations', {
      ConversationID: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      UserID: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'UserID'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      GuestSessionID: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'For guest users without login'
      },
      GuestName: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      GuestEmail: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      Subject: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Topic or subject of conversation'
      },
      ProductID: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Products',
          key: 'ProductID'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Product context for inquiry'
      },
      OrderID: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Orders',
          key: 'OrderID'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Order context for inquiry'
      },
      Status: {
        type: Sequelize.ENUM('open', 'waiting', 'replied', 'closed'),
        defaultValue: 'open',
        comment: 'open: new, waiting: awaiting admin reply, replied: admin replied, closed: resolved'
      },
      AssignedAdminID: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'UserID'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Admin assigned to handle this conversation'
      },
      IsBotHandling: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        comment: 'True if bot is currently handling, false if human took over'
      },
      LastMessageAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      CreatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      UpdatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 2. Create ChatMessages table
    await queryInterface.createTable('ChatMessages', {
      MessageID: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      ConversationID: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'ChatConversations',
          key: 'ConversationID'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      SenderType: {
        type: Sequelize.ENUM('user', 'guest', 'admin', 'bot'),
        allowNull: false
      },
      SenderID: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'UserID if user/admin, null if guest/bot'
      },
      Message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      IsBlocked: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'True if message was blocked due to banned keywords'
      },
      BlockedReason: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      ReadAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      CreatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 3. Create ChatBannedKeywords table
    await queryInterface.createTable('ChatBannedKeywords', {
      KeywordID: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      Keyword: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      IsActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      CreatedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'UserID'
        }
      },
      CreatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // 4. Create ChatAutoReplies table for chatbot
    await queryInterface.createTable('ChatAutoReplies', {
      ReplyID: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      TriggerKeywords: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'Comma-separated list of trigger keywords'
      },
      Response: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      Priority: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Higher priority = checked first'
      },
      IsActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      CreatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      UpdatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('ChatConversations', ['UserID']);
    await queryInterface.addIndex('ChatConversations', ['GuestSessionID']);
    await queryInterface.addIndex('ChatConversations', ['Status']);
    await queryInterface.addIndex('ChatConversations', ['ProductID']);
    await queryInterface.addIndex('ChatConversations', ['OrderID']);
    await queryInterface.addIndex('ChatMessages', ['ConversationID']);
    await queryInterface.addIndex('ChatMessages', ['SenderType']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ChatMessages');
    await queryInterface.dropTable('ChatConversations');
    await queryInterface.dropTable('ChatBannedKeywords');
    await queryInterface.dropTable('ChatAutoReplies');
  }
};
