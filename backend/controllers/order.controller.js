'use strict';
const dotenv = require('dotenv');
dotenv.config();

const db = require('../models');
const { Op, Sequelize } = require('sequelize');
const OrderService = require('../services/order.service');
const { createPaymentUrl } = require('../utils/vnpay.util');
const { isPostgres } = require('../utils/dbHelper');

// =======================================================
// ===               CONTROLLERS CHO USER              ===
// =======================================================

/**
 * @route   POST /api/user/orders/place
 * @desc    Người dùng đặt hàng
 * @access  Private
 */
exports.placeOrder = async (req, res) => {
  const userId = req.user.id;

  try {
    let orderData = { ...req.body, userId };

    // Xử lý ShippingProvider nếu truyền shippingProviderId
    if (req.body.shippingProviderId) {
      const provider = await db.ShippingProvider.findByPk(
        req.body.shippingProviderId
      );
      if (provider) {
        orderData.ShippingProvider = provider.Name;
        orderData.ShippingProviderID = provider.ProviderID;
      } else {
        return res
          .status(400)
          .json({ success: false, message: 'Đơn vị vận chuyển không hợp lệ.' });
      }
      delete orderData.shippingProviderId;
    }

    const totalAmount = req.body.totalAmount || 0;
    orderData.totalAmount = totalAmount;

    // Thiết lập trạng thái ban đầu theo phương thức thanh toán
    if (orderData.paymentMethod === 'VNPAY') {
      // Đơn chờ thanh toán online
      orderData.initialStatus = 'PendingPayment';  // Chờ thanh toán
      orderData.initialPaymentStatus = 'Pending';  // Chờ VNPAY xử lý
    } else {
      // COD hoặc phương thức khác
      orderData.initialStatus = 'Pending';         // Chờ xác nhận
      orderData.initialPaymentStatus =
        orderData.paymentMethod === 'COD' ? 'Unpaid' : 'Pending';
    }

    // BƯỚC 1: Tạo đơn hàng & trừ tồn kho
    const newOrder = await OrderService.placeOrderTransaction(orderData, false);

    // Đảm bảo đơn VNPAY luôn ở trạng thái "Chờ thanh toán"
    if (orderData.paymentMethod === 'VNPAY') {
      await db.Order.update(
        {
          Status: orderData.initialStatus || 'PendingPayment',
          PaymentStatus: orderData.initialPaymentStatus || 'Pending'
        },
        { where: { OrderID: newOrder.OrderID } }
      );

      // Đồng bộ lại object newOrder nếu phía dưới có dùng tới
      newOrder.Status = orderData.initialStatus || 'PendingPayment';
      newOrder.PaymentStatus = orderData.initialPaymentStatus || 'Pending';
    }

    // BƯỚC 2: Nếu là VNPAY → trả về link thanh toán
    if (orderData.paymentMethod === 'VNPAY') {
      const ipAddr =
        req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.connection.socket && req.connection.socket.remoteAddress);

      // Auto-detect return URL for production vs localhost
      const vnpayReturnUrl = process.env.VNPAY_RETURN_URL || 
        (process.env.NODE_ENV === 'production' 
          ? 'https://clickjacking-frontend.onrender.com/payment-result'
          : 'http://localhost:3000/payment-result');
      
      const paymentUrl = createPaymentUrl(
      ipAddr,
      newOrder.TotalAmount,
      `USER_${newOrder.OrderID}`,    // ✅ THÊM PREFIX
      vnpayReturnUrl,
      `Thanh toan don hang ${newOrder.OrderID}`
    );


      return res.status(200).json({
        success: true,
        code: '01', // Cần thanh toán VNPAY để hoàn tất
        message: 'Vui lòng thanh toán để hoàn tất đơn hàng.',
        paymentUrl
      });
    }

    // COD hoặc phương thức khác
    return res.status(201).json({
      success: true,
      code: '00', // Đặt hàng thành công ngay (không cần redirect thanh toán)
      message: 'Đặt hàng thành công!',
      orderId: newOrder.OrderID
    });
  } catch (error) {
    console.error('USER place order error:', error);
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Lỗi khi đặt hàng.' });
  }
};

/**
 * @route   POST /api/user/orders/:id/pay
 * @desc    Người dùng thanh toán lại đơn VNPAY (chưa thanh toán, trong 24h)
 * @access  Private
 */
exports.retryVnpayPayment = async (req, res) => {
  const userId = req.user.id;
  const orderId = req.params.id;

  try {
    const order = await db.Order.findOne({
      where: { OrderID: orderId, UserID: userId }
    });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    if (order.PaymentMethod !== 'VNPAY') {
      return res
        .status(400)
        .json({ success: false, message: 'Đơn này không dùng VNPAY.' });
    }

    if (!(order.Status === 'PendingPayment' && order.PaymentStatus === 'Pending')) {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng không còn ở trạng thái chờ thanh toán.'
      });
    }

    // Giới hạn thanh toán lại trong 24h kể từ OrderDate
    const createdTime = new Date(order.OrderDate);
    const now = new Date();
    const diffHours = (now - createdTime) / (1000 * 60 * 60);
    if (diffHours > 24) {
      return res.status(400).json({
        success: false,
        message: 'Đơn hàng đã quá thời gian thanh toán (24h).'
      });
    }

    const ipAddr =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket && req.connection.socket.remoteAddress);

    // Auto-detect return URL for production vs localhost
    const vnpayReturnUrl = process.env.VNPAY_RETURN_URL || 
        (process.env.NODE_ENV === 'production' 
          ? 'https://clickjacking-frontend.onrender.com/payment-result'
          : 'http://localhost:3000/payment-result');

    const paymentUrl = createPaymentUrl(
    ipAddr,
    order.TotalAmount,
    `USER_${order.OrderID}`,       // ✅
    vnpayReturnUrl,
    `Thanh toan lai don hang ${order.OrderID}`
  );

    return res.json({
      success: true,
      paymentUrl
    });
  } catch (error) {
    console.error('retryVnpayPayment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo link thanh toán lại.'
    });
  }
};

/**
 * @route   GET /api/profile/orders
 * @desc    Lấy danh sách đơn hàng người dùng
 * @access  Private
 */
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { q, status, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const limitNum = parseInt(limit, 10);

    const whereClause = { UserID: userId };
    
    // Filter by status if provided
    if (status && status !== 'all') {
      whereClause.Status = status;
    }
    
    if (q) {
      whereClause[Op.or] = [
        { OrderID: { [Op.like]: `%${q}%` } },
        { Status: { [Op.like]: `%${q}%` } },
        { TrackingCode: { [Op.like]: `%${q}%` } },
        { '$shippingAddress.FullName$': { [Op.like]: `%${q}%` } },
        { '$shippingAddress.Phone$': { [Op.like]: `%${q}%` } }
      ];
    }

    // Build dynamic SQL based on database type
    let addressLiteral, itemsCountLiteral, firstItemImageLiteral, firstItemNameLiteral;
    
    if (isPostgres()) {
      addressLiteral = `"shippingAddress"."Street" || ', ' || "shippingAddress"."City" || ', ' || COALESCE("shippingAddress"."State" || ', ', '') || "shippingAddress"."Country"`;
      itemsCountLiteral = `(SELECT COUNT(*) FROM "OrderItems" AS oi WHERE oi."OrderID" = "Order"."OrderID")`;
      firstItemImageLiteral = `(
          SELECT
              COALESCE(
                  (SELECT pi."ImageURL"
                   FROM "ProductImages" pi
                   WHERE pi."VariantID" = pv."VariantID"
                   ORDER BY pi."IsDefault" DESC, pi."ImageID" LIMIT 1),
                  (SELECT pi2."ImageURL"
                   FROM "ProductImages" pi2
                   INNER JOIN "ProductVariants" pv2 ON pi2."VariantID" = pv2."VariantID"
                   WHERE pv2."ProductID" = pv."ProductID"
                     AND pv2."Color" = pv."Color"
                   ORDER BY pi2."IsDefault" DESC, pi2."ImageID" LIMIT 1),
                  (SELECT pi3."ImageURL"
                   FROM "ProductImages" pi3
                   WHERE pi3."ProductID" = pv."ProductID"
                   ORDER BY pi3."IsDefault" DESC, pi3."ImageID" LIMIT 1)
              )
          FROM "OrderItems" oi
          JOIN "ProductVariants" pv ON pv."VariantID" = oi."VariantID"
          WHERE oi."OrderID" = "Order"."OrderID"
          ORDER BY oi."OrderItemID" ASC
          LIMIT 1
      )`;
      firstItemNameLiteral = `(
          SELECT p."Name"
          FROM "OrderItems" oi
          JOIN "ProductVariants" pv ON pv."VariantID" = oi."VariantID"
          JOIN "Products" p ON p."ProductID" = pv."ProductID"
          WHERE oi."OrderID" = "Order"."OrderID"
          ORDER BY oi."OrderItemID" ASC
          LIMIT 1
      )`;
    } else {
      addressLiteral = `shippingAddress.Street + ', ' + shippingAddress.City + ', ' + ISNULL(shippingAddress.State + ', ', '') + shippingAddress.Country`;
      itemsCountLiteral = `(SELECT COUNT(*) FROM OrderItems AS oi WHERE oi.OrderID = "Order"."OrderID")`;
      firstItemImageLiteral = `(
          SELECT TOP 1
              COALESCE(
                  (SELECT TOP 1 pi.ImageURL
                   FROM ProductImages pi
                   WHERE pi.VariantID = pv.VariantID
                   ORDER BY pi.IsDefault DESC, pi.ImageID),
                  (SELECT TOP 1 pi2.ImageURL
                   FROM ProductImages pi2
                   INNER JOIN ProductVariants pv2 ON pi2.VariantID = pv2.VariantID
                   WHERE pv2.ProductID = pv.ProductID
                     AND pv2.Color = pv.Color
                   ORDER BY pi2.IsDefault DESC, pi2.ImageID),
                  (SELECT TOP 1 pi3.ImageURL
                   FROM ProductImages pi3
                   WHERE pi3.ProductID = pv.ProductID
                   ORDER BY pi3.IsDefault DESC, pi3.ImageID)
              )
          FROM OrderItems oi
          JOIN ProductVariants pv ON pv.VariantID = oi.VariantID
          WHERE oi.OrderID = "Order"."OrderID"
          ORDER BY oi.OrderItemID ASC
      )`;
      firstItemNameLiteral = `(
          SELECT TOP 1 p.Name
          FROM OrderItems oi
          JOIN ProductVariants pv ON pv.VariantID = oi.VariantID
          JOIN Products p ON p.ProductID = pv.ProductID
          WHERE oi.OrderID = "Order"."OrderID"
          ORDER BY oi.OrderItemID ASC
      )`;
    }

    // Get total count for pagination
    let totalCount;
    try {
      if (q) {
        // For search with join, use findAll and count manually
        const countResult = await db.Order.findAll({
          where: whereClause,
          attributes: ['OrderID'],
          include: [
            {
              model: db.Address,
              as: 'shippingAddress',
              attributes: [],
              required: false
            }
          ],
          raw: true
        });
        totalCount = countResult.length;
      } else {
        // Simple count without join
        totalCount = await db.Order.count({
          where: whereClause
        });
      }
    } catch (countError) {
      console.error('Count error:', countError);
      totalCount = 0;
    }

    const orders = await db.Order.findAll({
      where: whereClause,
      attributes: [
        'OrderID',
        'TotalAmount',
        'Status',
        'PaymentStatus',
        'OrderDate',
        'TrackingCode',
        'ShippingProvider',
        [Sequelize.col('shippingAddress.FullName'), 'RecipientName'],
        [Sequelize.col('shippingAddress.Phone'), 'ShippingPhone'],
        [Sequelize.literal(addressLiteral), 'Address'],
        [Sequelize.literal(itemsCountLiteral), 'ItemsCount'],
        [Sequelize.literal(firstItemImageLiteral), 'FirstItemImage'],
        [Sequelize.literal(firstItemNameLiteral), 'FirstItemName']
      ],
      include: [
        {
          model: db.Address,
          as: 'shippingAddress',
          attributes: ['FullName', 'Phone', 'Street', 'City', 'State', 'Country']
        }
      ],
      order: [['OrderDate', 'DESC']],
      limit: limitNum,
      offset: offset,
      raw: true
    });

    const processed = orders.map((o) => ({
      ...o,
      FirstItemImage: o.FirstItemImage || null
    }));

    // Also get counts by status for tabs
    const statusCounts = await db.Order.findAll({
      where: { UserID: userId },
      attributes: [
        'Status',
        [Sequelize.fn('COUNT', Sequelize.col('OrderID')), 'count']
      ],
      group: ['Status'],
      raw: true
    });

    const counts = {
      PendingPayment: 0,
      Pending: 0,
      Confirmed: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0
    };
    statusCounts.forEach(sc => {
      if (counts.hasOwnProperty(sc.Status)) {
        counts[sc.Status] = parseInt(sc.count, 10);
      }
    });

    return res.json({
      orders: processed,
      total: totalCount,
      page: parseInt(page, 10),
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
      counts
    });
  } catch (error) {
    console.error('GET user orders error:', error);
    return res.status(500).json({ message: 'Lỗi khi tải danh sách đơn hàng.' });
  }
};

/**
 * @route   GET /api/profile/orders/:id
 * @desc    Lấy chi tiết đơn hàng
 * @access  Private
 */
exports.getUserOrderDetail = async (req, res) => {
  try {
    // Build dynamic subquery based on database type
    let productImageSubquery;
    if (isPostgres()) {
      productImageSubquery = `
            COALESCE(
                (SELECT pi."ImageURL"
                 FROM "ProductImages" pi
                 WHERE pi."VariantID" = "items->variant"."VariantID"
                 ORDER BY pi."IsDefault" DESC, pi."ImageID" LIMIT 1),
                (SELECT pi2."ImageURL"
                 FROM "ProductImages" pi2
                 INNER JOIN "ProductVariants" pv2 ON pi2."VariantID" = pv2."VariantID"
                 WHERE pi2."ProductID" = "items->variant"."ProductID"
                   AND pv2."Color" = "items->variant"."Color"
                 ORDER BY pi2."IsDefault" DESC, pi2."ImageID" LIMIT 1),
                (SELECT pi3."ImageURL"
                 FROM "ProductImages" pi3
                 WHERE pi3."ProductID" = "items->variant"."ProductID"
                 ORDER BY pi3."IsDefault" DESC, pi3."ImageID" LIMIT 1)
            )
        `;
    } else {
      productImageSubquery = `
            COALESCE(
                (SELECT TOP 1 pi.ImageURL
                 FROM ProductImages pi
                 WHERE pi.VariantID = [items->variant].VariantID
                 ORDER BY pi.IsDefault DESC, pi.ImageID),
                (SELECT TOP 1 pi2.ImageURL
                 FROM ProductImages pi2
                 INNER JOIN ProductVariants pv2 ON pi2.VariantID = pv2.VariantID
                 WHERE pi2.ProductID = [items->variant].ProductID
                   AND pv2.Color = [items->variant].Color
                 ORDER BY pi2.IsDefault DESC, pi2.ImageID),
                (SELECT TOP 1 pi3.ImageURL
                 FROM ProductImages pi3
                 WHERE pi3.ProductID = [items->variant].ProductID
                 ORDER BY pi3.IsDefault DESC, pi3.ImageID)
            )
        `;
    }

    const order = await db.Order.findOne({
      where: {
        OrderID: req.params.id,
        UserID: req.user.id
      },
      include: [
        { model: db.Address, as: 'shippingAddress' },
        {
          model: db.OrderItem,
          as: 'items',
          include: [
            {
              model: db.ProductVariant,
              as: 'variant',
              attributes: [
                'VariantID',
                'ProductID',
                'Size',
                'Color',
                [Sequelize.literal(productImageSubquery), 'VariantImageURL']
              ],
              include: {
                model: db.Product,
                as: 'product',
                attributes: ['ProductID', 'Name']
              }
            }
          ]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        message: 'Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập.'
      });
    }

    if (order.shippingAddress) {
      order.dataValues.RecipientName = order.shippingAddress.FullName;
      order.dataValues.ShippingPhone = order.shippingAddress.Phone;
      order.dataValues.Address = [
        order.shippingAddress.Street,
        order.shippingAddress.City,
        order.shippingAddress.State,
        order.shippingAddress.Country
      ]
        .filter(Boolean)
        .join(', ');
    }

    for (const item of order.items) {
      const variant = item.variant;
      let img = variant?.dataValues?.VariantImageURL || null;

      if (!img && variant) {
        const productImage = await db.ProductImage.findOne({
          where: { ProductID: variant.ProductID },
          order: [
            ['IsDefault', 'DESC'],
            ['ImageID', 'ASC']
          ]
        });
        if (productImage) img = productImage.ImageURL;
      }

      if (img && !img.startsWith('http')) {
        if (!img.startsWith('/')) img = '/' + img;
      }

      item.dataValues.ImageURL = img || null;
      item.dataValues.Size = item.Size || variant?.Size;
      item.dataValues.Color = item.Color || variant?.Color;
      item.dataValues.ProductName = item.ProductName || variant?.product?.Name;
    }

    return res.json({ Order: order, Items: order.items });
  } catch (error) {
    console.error('Order detail GET error:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy chi tiết đơn hàng.' });
  }
};

/**
 * @route   PUT /api/profile/orders/:id/cancel
 * @desc    Người dùng tự hủy đơn hàng (hoàn lại tồn kho theo VariantID)
 * @access  Private
 */
exports.cancelUserOrder = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    // First find order without lock to avoid FOR UPDATE with join issue
    const order = await db.Order.findOne({
      where: {
        OrderID: req.params.id,
        UserID: req.user.id
      },
      include: [
        {
          model: db.OrderItem,
          as: 'items'
        }
      ],
      transaction: t
    });

    if (!order) {
      await t.rollback();
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    }

    // Chỉ cho hủy khi đang chờ xác nhận hoặc chờ thanh toán & chưa thanh toán
    if (!(order.Status === 'Pending' || order.Status === 'PendingPayment')) {
      await t.rollback();
      return res.status(400).json({
        message:
          'Chỉ có thể hủy đơn hàng ở trạng thái "Chờ xác nhận" hoặc "Chờ thanh toán".'
      });
    }

    if (order.PaymentStatus === 'Paid') {
      await t.rollback();
      return res.status(400).json({
        message: 'Đơn hàng đã thanh toán, không thể tự hủy tại đây.'
      });
    }

    // 1. Cập nhật trạng thái đơn
    order.Status = 'Cancelled';
    await order.save({ transaction: t });

    // 2. Hoàn lại tồn kho theo từng OrderItem (VariantID)
    for (const item of order.items) {
      if (!item.VariantID || !item.Quantity) {
        console.warn(`Skipping item without VariantID: OrderItemID=${item.OrderItemID}`);
        continue;
      }

      try {
        await db.ProductVariant.increment(
          { StockQuantity: item.Quantity },
          {
            where: { VariantID: item.VariantID },
            transaction: t
          }
        );
      } catch (variantError) {
        console.error(`Error restoring stock for VariantID=${item.VariantID}:`, variantError);
        // Continue with other items even if one fails
      }
    }

    await t.commit();
    return res.json({
      message: 'Hủy đơn hàng thành công và đã hoàn lại tồn kho.'
    });
  } catch (error) {
    console.error('Order cancel PUT error:', error);
    console.error('Error details:', error.message, error.stack);
    await t.rollback();
    return res.status(500).json({ message: 'Lỗi máy chủ: ' + error.message });
  }
};

// =======================================================
// ===               CONTROLLERS CHO ADMIN               ===
// =======================================================

/**
 * @route   GET /api/admin/orders?customerType=user
 * @desc    Admin lấy danh sách đơn hàng của user
 * @access  Private (Admin)
 */
exports.getAllUserOrdersAdmin = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, parseInt(req.query.limit || '10', 10));
    const offset = (page - 1) * limit;
    const { keyword, status } = req.query;

    const whereClause = {};
    if (status) whereClause.Status = status;

    const includeWhereUser = {};
    if (keyword) {
      whereClause[Op.or] = [
        { OrderID: !isNaN(parseInt(keyword)) ? parseInt(keyword) : null }
      ];
      includeWhereUser[Op.or] = [
        { Username: { [Op.like]: `%${keyword}%` } },
        { Email: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { count, rows } = await db.Order.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: ['Username', 'Email'],
          where: Object.keys(includeWhereUser).length
            ? includeWhereUser
            : null
        },
        {
          model: db.ShippingProvider,
          as: 'shippingProvider',
          attributes: ['Name'],
          required: false
        }
      ],
      limit,
      offset,
      order: [['OrderDate', 'DESC']],
      distinct: true
    });

    const processedRows = rows.map((order) => ({
      ...order.toJSON(),
      ShippingProvider:
        order.ShippingProvider || order.shippingProvider?.Name || 'Chưa chọn'
    }));

    return res.json({ orders: processedRows, total: count, page, limit });
  } catch (error) {
    console.error('ADMIN GET USER ORDERS ERROR:', error);
    return res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   GET /api/admin/orders/order/:id
 * @desc    Admin lấy chi tiết một đơn hàng của user
 * @access  Private (Admin)
 */
exports.getUserOrderDetailAdmin = async (req, res) => {
  try {
    const order = await db.Order.findByPk(req.params.id, {
      include: [
        { model: db.User, as: 'user', attributes: ['Username', 'Email'] },
        { model: db.Address, as: 'shippingAddress' },
        {
          model: db.OrderItem,
          as: 'items',
          include: [
            {
              model: db.ProductVariant,
              as: 'variant',
              include: {
                model: db.Product,
                as: 'product',
                attributes: ['Name']
              }
            }
          ]
        }
      ]
    });
    if (!order) {
      return res
        .status(404)
        .json({ errors: [{ msg: 'Không tìm thấy đơn hàng' }] });
    }
    return res.json(order);
  } catch (error) {
    console.error('ADMIN GET ORDER DETAIL ERROR:', error);
    return res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   PUT /api/admin/orders/order/:id/status
 * @desc    Admin cập nhật trạng thái đơn hàng của user
 * @access  Private (Admin)
 */
// === ADMIN: cập nhật trạng thái đơn hàng ===
exports.updateOrderStatus = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    // PostgreSQL doesn't support FOR UPDATE with LEFT OUTER JOIN
    // So we need to query the order first without include, then get items separately
    const order = await db.Order.findByPk(req.params.id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!order) {
      await t.rollback();
      return res.status(404).json({ errors: [{ msg: 'Không tìm thấy đơn hàng' }] });
    }

    // ✅ KHÓA: Đơn đã hủy thì không cho đổi trạng thái nữa
    if (order.Status === 'Cancelled') {
      await t.rollback();
      return res.status(409).json({ errors: [{ msg: 'Đơn đã hủy – không thể thay đổi trạng thái.' }] });
    }

    // ✅ KHÓA: Đơn đã giao (Delivered) thì không cho đổi trạng thái
    if (order.Status === 'Delivered') {
      await t.rollback();
      return res.status(409).json({ errors: [{ msg: 'Đơn đã giao – không thể thay đổi trạng thái.' }] });
    }

    const oldStatus = order.Status;
    const newStatus = req.body.Status;

    // ✅ Validate chuyển trạng thái hợp lệ
    // Flow: PendingPayment -> Pending -> Confirmed -> Shipped -> Delivered
    // Cancelled có thể từ: PendingPayment, Pending, Confirmed
    const validTransitions = {
      'PendingPayment': ['Pending', 'Cancelled'],
      'Pending': ['Confirmed', 'Cancelled'],
      'Confirmed': ['Shipped', 'Cancelled'],
      'Shipped': ['Delivered']
    };

    const allowedNextStatuses = validTransitions[oldStatus] || [];
    if (!allowedNextStatuses.includes(newStatus)) {
      await t.rollback();
      return res.status(400).json({ 
        errors: [{ msg: `Không thể chuyển từ "${oldStatus}" sang "${newStatus}". Chỉ có thể chuyển sang: ${allowedNextStatuses.join(', ') || 'không có'}` }] 
      });
    }

    order.Status = newStatus;
    await order.save({ transaction: t });

    // Get order items separately for stock restoration
    const orderItems = await db.OrderItem.findAll({
      where: { OrderID: order.OrderID },
      transaction: t
    });

    // Hoàn tồn khi chuyển sang Cancelled và chưa Paid (giữ nguyên logic cũ)
    if (oldStatus !== 'Cancelled' && newStatus === 'Cancelled' && order.PaymentStatus !== 'Paid') {
      for (const item of orderItems) {
        if (!item.VariantID || !item.Quantity) continue;
        await db.ProductVariant.increment(
          { StockQuantity: item.Quantity },
          { where: { VariantID: item.VariantID }, transaction: t }
        );
      }
    }

    await t.commit();
    return res.json({ message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    console.error('ADMIN UPDATE STATUS ERROR:', error);
    await t.rollback();
    return res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};


/**
 * @route   PUT /api/admin/orders/order/:id/tracking
 * @desc    Admin cập nhật thông tin vận đơn
 * @access  Private (Admin)
 */
exports.updateTrackingInfo = async (req, res) => {
  try {
    const order = await db.Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ errors: [{ msg: 'Không tìm thấy đơn hàng' }] });
    }

    // ✅ KHÓA: Đơn đã hủy thì không cho sửa thông tin vận đơn
    if (order.Status === 'Cancelled') {
      return res.status(409).json({ errors: [{ msg: 'Đơn đã hủy – không thể cập nhật vận đơn.' }] });
    }

    await order.update(req.body); // { TrackingCode, ShippingProvider }
    return res.json({ message: 'Cập nhật tracking thành công' });
  } catch (error) {
    console.error('ADMIN UPDATE TRACKING ERROR:', error);
    return res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

