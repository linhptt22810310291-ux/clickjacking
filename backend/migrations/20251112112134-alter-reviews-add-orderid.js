'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) Thêm OrderID (cho phép NULL tạm thời để backfill)
    await queryInterface.addColumn('Reviews', 'OrderID', {
      type: Sequelize.INTEGER,
      allowNull: true, // tạm cho phép null để backfill
      references: { model: 'Orders', key: 'OrderID' },
      onDelete: 'NO ACTION'
    });

    // 2) Backfill OrderID cho các review cũ (SQL Server)
    //    Quy tắc: lấy đơn "Delivered" gần nhất của đúng User và chứa Product đó
    //    Nếu không có đơn "Delivered" chứa product → để NULL (xử lý ở bước 3)
    await queryInterface.sequelize.query(`
      UPDATE r
      SET r.OrderID = x.OrderID
      FROM Reviews r
      OUTER APPLY (
        SELECT TOP 1 o.OrderID
        FROM Orders o
        JOIN OrderItems oi ON oi.OrderID = o.OrderID
        JOIN ProductVariants pv ON pv.VariantID = oi.VariantID
        WHERE o.UserID = r.UserID
          AND pv.ProductID = r.ProductID
          AND o.Status = 'Delivered'
        ORDER BY o.OrderDate DESC, o.OrderID DESC
      ) x
      WHERE r.OrderID IS NULL
    `);

    // 3) Nếu còn review nào chưa backfill được OrderID:
    //    - Lựa chọn A (khuyến nghị): XÓA các review "mồ côi" vì không gắn được vào đơn đã giao
    //    - Lựa chọn B: Giữ lại và cho phép OrderID NULL (nhưng sẽ mâu thuẫn với ràng buộc mới)
    //    → Ở đây chọn A (khuyến nghị)
    await queryInterface.sequelize.query(`
      DELETE FROM Reviews WHERE OrderID IS NULL
    `);

    // 4) Đặt NOT NULL cho OrderID sau backfill
    //    (SQL Server cần dùng câu lệnh ALTER riêng)
    await queryInterface.sequelize.query(`
      ALTER TABLE Reviews
      ALTER COLUMN OrderID INT NOT NULL
    `);

    // 5) Gỡ unique cũ nếu tồn tại (tên theo migration cũ của bạn)
    try {
      await queryInterface.removeConstraint('Reviews', 'UQ_Reviews_User_Product');
    } catch (e) { /* bỏ qua nếu chưa tồn tại */ }

    // 6) Thêm unique mới: (UserID, ProductID, OrderID)
    await queryInterface.addConstraint('Reviews', {
      fields: ['UserID', 'ProductID', 'OrderID'],
      type: 'unique',
      name: 'UQ_Reviews_User_Product_Order'
    });
  },

  async down(queryInterface, Sequelize) {
    // Gỡ unique mới
    try {
      await queryInterface.removeConstraint('Reviews', 'UQ_Reviews_User_Product_Order');
    } catch (e) {}

    // Đặt lại unique cũ
    await queryInterface.addConstraint('Reviews', {
      fields: ['UserID', 'ProductID'],
      type: 'unique',
      name: 'UQ_Reviews_User_Product'
    });

    // Cho phép NULL để drop cột
    await queryInterface.sequelize.query(`
      ALTER TABLE Reviews
      ALTER COLUMN OrderID INT NULL
    `);

    await queryInterface.removeColumn('Reviews', 'OrderID');
  }
};
