'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add OrderItemID column to Reviews table
    await queryInterface.addColumn('Reviews', 'OrderItemID', {
      type: Sequelize.INTEGER,
      allowNull: true, // Allow null for existing reviews
      references: {
        model: 'OrderItems',
        key: 'OrderItemID'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Reviews', 'OrderItemID');
  }
};
