'use strict';

const { Sequelize, QueryTypes } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://clickjacking_user:VqysEFnX4EwNwCvwRihCGXgxP9ONOKA1@dpg-d4kmpafpm1nc738btuo0-a.singapore-postgres.render.com/clickjacking';

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  },
  logging: false
});

async function cleanOrders() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Connected!\n');

    console.log('🗑️ Cleaning all orders and related data...');
    
    // Delete in correct order (child tables first)
    await sequelize.query('DELETE FROM "OrderItems"');
    console.log('  ✅ OrderItems deleted');
    
    await sequelize.query('DELETE FROM "GuestOrderItems"');
    console.log('  ✅ GuestOrderItems deleted');
    
    await sequelize.query('DELETE FROM "PaymentTransactions"');
    console.log('  ✅ PaymentTransactions deleted');
    
    // PaymentCallbackLogs might not exist, skip if error
    try {
      await sequelize.query('DELETE FROM "PaymentCallbackLogs"');
      console.log('  ✅ PaymentCallbackLogs deleted');
    } catch (e) {
      console.log('  ⚠️ PaymentCallbackLogs table not found (skipped)');
    }
    
    await sequelize.query('DELETE FROM "Orders"');
    console.log('  ✅ Orders deleted');
    
    await sequelize.query('DELETE FROM "GuestOrders"');
    console.log('  ✅ GuestOrders deleted');

    // Also clean carts
    await sequelize.query('DELETE FROM "CartItems"');
    console.log('  ✅ CartItems deleted');
    
    await sequelize.query('DELETE FROM "Carts"');
    console.log('  ✅ Carts deleted');

    // Clean reviews
    await sequelize.query('DELETE FROM "ReviewMedia"');
    console.log('  ✅ ReviewMedia deleted');
    
    await sequelize.query('DELETE FROM "Reviews"');
    console.log('  ✅ Reviews deleted');

    console.log('\n========================================');
    console.log('✅ ALL ORDERS & RELATED DATA CLEANED!');
    console.log('========================================\n');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

cleanOrders();
