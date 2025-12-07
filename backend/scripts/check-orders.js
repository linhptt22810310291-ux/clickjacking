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

async function checkOrders() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Connected!\n');

    // Check order counts
    const orders = await sequelize.query('SELECT COUNT(*) as count FROM "Orders"', { type: QueryTypes.SELECT });
    const orderItems = await sequelize.query('SELECT COUNT(*) as count FROM "OrderItems"', { type: QueryTypes.SELECT });
    const guestOrders = await sequelize.query('SELECT COUNT(*) as count FROM "GuestOrders"', { type: QueryTypes.SELECT });
    const guestOrderItems = await sequelize.query('SELECT COUNT(*) as count FROM "GuestOrderItems"', { type: QueryTypes.SELECT });

    console.log('📦 Current Order Status:');
    console.log('  - Orders:', orders[0].count);
    console.log('  - OrderItems:', orderItems[0].count);
    console.log('  - GuestOrders:', guestOrders[0].count);
    console.log('  - GuestOrderItems:', guestOrderItems[0].count);

    // Check orphaned order items (variant no longer exists)
    const orphanedItems = await sequelize.query(
      `SELECT COUNT(*) as count FROM "OrderItems" 
       WHERE "VariantID" NOT IN (SELECT "VariantID" FROM "ProductVariants")`,
      { type: QueryTypes.SELECT }
    );
    const orphanedGuestItems = await sequelize.query(
      `SELECT COUNT(*) as count FROM "GuestOrderItems" 
       WHERE "VariantID" NOT IN (SELECT "VariantID" FROM "ProductVariants")`,
      { type: QueryTypes.SELECT }
    );

    console.log('\n⚠️ Orphaned Items (variant deleted):');
    console.log('  - OrderItems without variant:', orphanedItems[0].count);
    console.log('  - GuestOrderItems without variant:', orphanedGuestItems[0].count);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

checkOrders();
