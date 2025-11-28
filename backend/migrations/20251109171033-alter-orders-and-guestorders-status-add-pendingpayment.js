'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // --- ORDERS ---
    // 1. Xoá mọi CHECK constraint đang gắn với cột Status của bảng Orders (nếu có)
    await queryInterface.sequelize.query(`
      DECLARE @ConstraintName NVARCHAR(200);
      SELECT @ConstraintName = dc.name
      FROM sys.check_constraints dc
      INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
      WHERE dc.parent_object_id = OBJECT_ID('dbo.Orders')
        AND c.name = 'Status';

      IF @ConstraintName IS NOT NULL
      BEGIN
        EXEC('ALTER TABLE [dbo].[Orders] DROP CONSTRAINT [' + @ConstraintName + ']');
      END
    `);

    // 2. Tạo lại CHECK constraint mới cho Orders (có PendingPayment)
    await queryInterface.sequelize.query(`
      ALTER TABLE [dbo].[Orders]
      ADD CONSTRAINT [CK_Orders_Status]
      CHECK (
        [Status] IN (
          'PendingPayment', -- Chờ thanh toán
          'Pending',        -- Chờ xác nhận
          'Confirmed',      -- Chờ lấy hàng
          'Shipped',        -- Chờ giao hàng
          'Delivered',      -- Đã giao
          'Cancelled'       -- Đã hủy
        )
      );
    `);

    // --- GUESTORDERS (nếu bảng này có cột Status tương tự) ---
    await queryInterface.sequelize.query(`
      DECLARE @ConstraintName2 NVARCHAR(200);
      IF OBJECT_ID('dbo.GuestOrders', 'U') IS NOT NULL
      BEGIN
        SELECT @ConstraintName2 = dc.name
        FROM sys.check_constraints dc
        INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.GuestOrders')
          AND c.name = 'Status';

        IF @ConstraintName2 IS NOT NULL
        BEGIN
          EXEC('ALTER TABLE [dbo].[GuestOrders] DROP CONSTRAINT [' + @ConstraintName2 + ']');
        END

        ALTER TABLE [dbo].[GuestOrders]
        ADD CONSTRAINT [CK_GuestOrders_Status]
        CHECK (
          [Status] IN (
            'PendingPayment',
            'Pending',
            'Confirmed',
            'Shipped',
            'Delivered',
            'Cancelled'
          )
        );
      END
    `);
  },

  async down(queryInterface, Sequelize) {
    // Rollback: đưa về trạng thái cũ (không có PendingPayment)

    // ORDERS
    await queryInterface.sequelize.query(`
      IF OBJECT_ID('dbo.Orders', 'U') IS NOT NULL
      BEGIN
        DECLARE @ConstraintName NVARCHAR(200);
        SELECT @ConstraintName = dc.name
        FROM sys.check_constraints dc
        INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.Orders')
          AND c.name = 'Status';

        IF @ConstraintName IS NOT NULL
        BEGIN
          EXEC('ALTER TABLE [dbo].[Orders] DROP CONSTRAINT [' + @ConstraintName + ']');
        END

        ALTER TABLE [dbo].[Orders]
        ADD CONSTRAINT [CK_Orders_Status]
        CHECK (
          [Status] IN (
            'Pending',
            'Confirmed',
            'Shipped',
            'Delivered',
            'Cancelled'
          )
        );
      END
    `);

    // GUESTORDERS
    await queryInterface.sequelize.query(`
      IF OBJECT_ID('dbo.GuestOrders', 'U') IS NOT NULL
      BEGIN
        DECLARE @ConstraintName2 NVARCHAR(200);
        SELECT @ConstraintName2 = dc.name
        FROM sys.check_constraints dc
        INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.GuestOrders')
          AND c.name = 'Status';

        IF @ConstraintName2 IS NOT NULL
        BEGIN
          EXEC('ALTER TABLE [dbo].[GuestOrders] DROP CONSTRAINT [' + @ConstraintName2 + ']');
        END

        ALTER TABLE [dbo].[GuestOrders]
        ADD CONSTRAINT [CK_GuestOrders_Status]
        CHECK (
          [Status] IN (
            'Pending',
            'Confirmed',
            'Shipped',
            'Delivered',
            'Cancelled'
          )
        );
      END
    `);
  }
};
