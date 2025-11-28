'use strict';

/**
 * Migration: Add Email Verification, Welcome Voucher & MFA fields to Users table
 * Combined from multiple migrations for cleaner structure
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check existing columns to avoid duplicate errors
    const tableDescription = await queryInterface.describeTable('Users');

    // Email Verification fields
    if (!tableDescription.IsEmailVerified) {
      await queryInterface.addColumn('Users', 'IsEmailVerified', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    if (!tableDescription.EmailVerificationToken) {
      await queryInterface.addColumn('Users', 'EmailVerificationToken', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
    }

    if (!tableDescription.EmailVerificationExpires) {
      await queryInterface.addColumn('Users', 'EmailVerificationExpires', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    // Welcome Voucher field
    if (!tableDescription.HasReceivedWelcomeVoucher) {
      await queryInterface.addColumn('Users', 'HasReceivedWelcomeVoucher', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    // MFA (Multi-Factor Authentication) fields
    if (!tableDescription.MFASecret) {
      await queryInterface.addColumn('Users', 'MFASecret', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
    }

    if (!tableDescription.MFAEnabled) {
      await queryInterface.addColumn('Users', 'MFAEnabled', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    console.log('✅ Migration: Added Email Verification, Welcome Voucher & MFA fields to Users table');
  },

  async down(queryInterface, Sequelize) {
    // Remove all added columns
    await queryInterface.removeColumn('Users', 'IsEmailVerified');
    await queryInterface.removeColumn('Users', 'EmailVerificationToken');
    await queryInterface.removeColumn('Users', 'EmailVerificationExpires');
    await queryInterface.removeColumn('Users', 'HasReceivedWelcomeVoucher');
    await queryInterface.removeColumn('Users', 'MFASecret');
    await queryInterface.removeColumn('Users', 'MFAEnabled');

    console.log('✅ Migration: Removed Email Verification, Welcome Voucher & MFA fields from Users table');
  }
};
