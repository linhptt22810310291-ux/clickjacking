'use strict';

const db = require('../models');
const { Op, Sequelize } = require('sequelize');
const OrderService = require('../services/order.service');
const { createPaymentUrl } = require('../utils/vnpay.util');
const { isPostgres } = require('../utils/dbHelper');
// =======================================================
// ===           CONTROLLERS CHO GUEST (PUBLIC)        ===
// =======================================================

/**
 * @route   POST /api/guest-orders/place
 * @desc    Khách vãng lai đặt hàng
 * @access  Public
 */
exports.placeGuestOrder = async (req, res) => {
    const sessionId = req.header('X-Session-ID') || null;

    try {
        const { fullName, phone, email, street, city, ...restOfBody } = req.body;

        const guestInfo = {
            FullName: fullName,
            Phone: phone,
            Email: email,
            Address: `${street}, ${city}`
        };

        let orderData = {
            ...restOfBody,          // items, paymentMethod, shippingFee, couponCode, totalAmount...
            shipping: guestInfo,
            sessionId
        };

        // GÁN PHƯƠNG THỨC THANH TOÁN CHO CHẮC
        orderData.paymentMethod = req.body.paymentMethod;

        // Xử lý ShippingProvider
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

        // ⚠️ PHẢI DÙNG totalAmount (chữ t thường) cho OrderService
        orderData.totalAmount = req.body.totalAmount || 0;

        // Thiết lập trạng thái ban đầu giống user
        if (orderData.paymentMethod === 'VNPAY') {
            orderData.initialStatus = 'PendingPayment';     // Chờ thanh toán
            orderData.initialPaymentStatus = 'Pending';     // Chờ VNPAY
        } else {
            orderData.initialStatus = 'Pending';            // Chờ xác nhận
            orderData.initialPaymentStatus =
                orderData.paymentMethod === 'COD' ? 'Unpaid' : 'Pending';
        }

        // BƯỚC 1: Tạo đơn hàng GuestOrder
        const newOrder = await OrderService.placeOrderTransaction(orderData, true);

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
            `GUEST_${newOrder.GuestOrderID}`,  // ✅
            vnpayReturnUrl,
            `Thanh toan don hang ${newOrder.GuestOrderID}`
            );


            return res.status(200).json({
                success: true,
                code: '01',
                message: 'Vui lòng thanh toán để hoàn tất đơn hàng.',
                paymentUrl
            });
        }

        // Nếu là COD
        return res.status(201).json({
            success: true,
            code: '00',
            message: 'Đặt hàng thành công!',
            guestOrderId: newOrder.GuestOrderID
        });
    } catch (error) {
        console.error('GUEST place order error:', error);
        return res
            .status(500)
            .json({ success: false, message: error.message || 'Lỗi khi đặt hàng.' });
    }
};
/**
 * @route   POST /api/guest-orders/:id/pay
 * @desc    Khách thanh toán lại đơn VNPAY (chưa thanh toán, trong 24h)
 * @access  Public
 */
exports.retryGuestVnpayPayment = async (req, res) => {
    const orderId = req.params.id;

    try {
        const order = await db.GuestOrder.findByPk(orderId);

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

        // Giới hạn 24h
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
            `GUEST_${order.GuestOrderID}`,     // ✅
            vnpayReturnUrl,
            `Thanh toan lai don hang ${order.GuestOrderID}`
            );

        return res.json({
            success: true,
            paymentUrl
        });
    } catch (error) {
        console.error('retryGuestVnpayPayment error:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo link thanh toán lại.'
        });
    }
};


/**
 * @route   POST /api/guest-history/lookup
 * @desc    Tra cứu lịch sử đơn hàng của khách
 * @access  Public
 */
 exports.lookupOrders = async (req, res) => {
    const { email, phone } = req.body;

    try {
        // Build SQL literals based on database type
        let firstItemNameLiteral, firstItemImageLiteral;
        
        if (isPostgres()) {
            firstItemNameLiteral = `(
                SELECT p."Name"
                FROM "GuestOrderItems" goi
                JOIN "ProductVariants" pv ON pv."VariantID" = goi."VariantID"
                JOIN "Products" p ON p."ProductID" = pv."ProductID"
                WHERE goi."GuestOrderID" = "GuestOrder"."GuestOrderID"
                ORDER BY goi."GuestOrderItemID" ASC
                LIMIT 1
            )`;
            firstItemImageLiteral = `(
                SELECT
                    COALESCE(
                        (SELECT pi."ImageURL" FROM "ProductImages" pi WHERE pi."VariantID" = pv."VariantID" ORDER BY pi."IsDefault" DESC, pi."ImageID" LIMIT 1),
                        (SELECT pi2."ImageURL" FROM "ProductImages" pi2 INNER JOIN "ProductVariants" pv2 ON pi2."VariantID" = pv2."VariantID" WHERE pv2."ProductID" = pv."ProductID" AND pv2."Color" = pv."Color" ORDER BY pi2."IsDefault" DESC, pi2."ImageID" LIMIT 1),
                        (SELECT pi3."ImageURL" FROM "ProductImages" pi3 WHERE pi3."ProductID" = pv."ProductID" ORDER BY pi3."IsDefault" DESC, pi3."ImageID" LIMIT 1)
                    )
                FROM "GuestOrderItems" goi
                JOIN "ProductVariants" pv ON pv."VariantID" = goi."VariantID"
                WHERE goi."GuestOrderID" = "GuestOrder"."GuestOrderID"
                ORDER BY goi."GuestOrderItemID" ASC
                LIMIT 1
            )`;
        } else {
            firstItemNameLiteral = `(
                SELECT TOP 1 p.Name
                FROM GuestOrderItems goi
                JOIN ProductVariants pv ON pv.VariantID = goi.VariantID
                JOIN Products p ON p.ProductID = pv.ProductID
                WHERE goi.GuestOrderID = "GuestOrder"."GuestOrderID"
                ORDER BY goi.GuestOrderItemID ASC
            )`;
            firstItemImageLiteral = `(
                SELECT TOP 1
                    COALESCE(
                        (SELECT TOP 1 pi.ImageURL FROM ProductImages pi WHERE pi.VariantID = pv.VariantID ORDER BY pi.IsDefault DESC, pi.ImageID),
                        (SELECT TOP 1 pi2.ImageURL FROM ProductImages pi2 INNER JOIN ProductVariants pv2 ON pi2.VariantID = pv2.VariantID WHERE pv2.ProductID = pv.ProductID AND pv2.Color = pv.Color ORDER BY pi2.IsDefault DESC, pi2.ImageID),
                        (SELECT TOP 1 pi3.ImageURL FROM ProductImages pi3 WHERE pi3.ProductID = pv.ProductID ORDER BY pi3.IsDefault DESC, pi3.ImageID)
                    )
                FROM GuestOrderItems goi
                JOIN ProductVariants pv ON pv.VariantID = goi.VariantID
                WHERE goi.GuestOrderID = "GuestOrder"."GuestOrderID"
                ORDER BY goi.GuestOrderItemID ASC
            )`;
        }

        const orders = await db.GuestOrder.findAll({
            where: {
                Email: { [Op.like]: email },
                Phone: phone
            },
            attributes: [
                'GuestOrderID',
                'TotalAmount',
                'Status',
                'OrderDate',
                'ShippingProvider',
                [Sequelize.literal(firstItemNameLiteral), 'FirstItemName'],
                [Sequelize.literal(firstItemImageLiteral), 'FirstItemImage']
            ],
            include: [
                {
                    model: db.ShippingProvider,
                    as: 'shippingProvider',
                    attributes: ['Name'],
                    required: false
                }
            ],
            order: [['OrderDate', 'DESC']],
            raw: true
        });

        if (orders.length === 0) {
            return res
                .status(404)
                .json({ errors: [{ msg: 'Không tìm thấy đơn hàng nào với thông tin đã cung cấp.' }] });
        }

        const processedOrders = orders.map((order) => ({
            ...order,
            ShippingProvider:
                order.ShippingProvider || order['shippingProvider.Name'] || 'Chưa chọn'
        }));

        const byStatus = processedOrders.reduce(
            (acc, order) => {
                (acc[order.Status] = acc[order.Status] || []).push(order);
                return acc;
            },
            {
                PendingPayment: [],
                Pending: [],
                Confirmed: [],
                Shipped: [],
                Delivered: [],
                Cancelled: []
            }
        );

        return res.json(byStatus);
    } catch (error) {
        console.error('[guest-history][lookup] Error:', error);
        return res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ.' }] });
    }
};


 /**
 * @route   GET /api/guest-history/:id
 * @desc    Lấy chi tiết đơn hàng của khách
 * @access  Public
 */
exports.getOrderDetail = async (req, res) => {
  try {
    // Lấy ảnh ưu tiên theo Variant -> Color -> Product (DB compatible)
    let productImageSubquery;
    if (isPostgres()) {
      productImageSubquery = `
        COALESCE(
          (SELECT pi."ImageURL" FROM "ProductImages" pi WHERE pi."VariantID" = "items->variant"."VariantID" ORDER BY pi."IsDefault" DESC, pi."ImageID" LIMIT 1),
          (SELECT pi2."ImageURL" FROM "ProductImages" pi2 INNER JOIN "ProductVariants" pv2 ON pi2."VariantID" = pv2."VariantID" WHERE pi2."ProductID" = "items->variant"."ProductID" AND pv2."Color" = "items->variant"."Color" ORDER BY pi2."IsDefault" DESC, pi2."ImageID" LIMIT 1),
          (SELECT pi3."ImageURL" FROM "ProductImages" pi3 WHERE pi3."ProductID" = "items->variant"."ProductID" ORDER BY pi3."IsDefault" DESC, pi3."ImageID" LIMIT 1)
        )
      `;
    } else {
      productImageSubquery = `
        COALESCE(
          (SELECT TOP 1 pi.ImageURL FROM ProductImages pi WHERE pi.VariantID = [items->variant].VariantID ORDER BY pi.IsDefault DESC, pi.ImageID),
          (SELECT TOP 1 pi2.ImageURL FROM ProductImages pi2 INNER JOIN ProductVariants pv2 ON pi2.VariantID = pv2.VariantID WHERE pi2.ProductID = [items->variant].ProductID AND pv2.Color = [items->variant].Color ORDER BY pi2.IsDefault DESC, pi2.ImageID),
          (SELECT TOP 1 pi3.ImageURL FROM ProductImages pi3 WHERE pi3.ProductID = [items->variant].ProductID ORDER BY pi3.IsDefault DESC, pi3.ImageID)
        )
      `;
    }

    const order = await db.GuestOrder.findByPk(req.params.id, {
      include: [
        {
          model: db.GuestOrderItem,
          as: "items",
          include: [
            {
              model: db.ProductVariant,
              as: "variant",
              attributes: [
                "VariantID",
                "ProductID",
                "Size",
                "Color",
                [Sequelize.literal(productImageSubquery), "VariantImageURL"]
              ],
              include: {
                model: db.Product,
                as: "product",
                attributes: ["ProductID", "Name"]
              }
            }
          ]
        },
        {
          model: db.ShippingProvider,
          as: "shippingProvider",
          attributes: ["Name"],
          required: false
        }
      ]
    });

    if (!order)
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

    // Fallback tên đơn vị vận chuyển
    order.dataValues.ShippingProvider =
      order.ShippingProvider ||
      order.shippingProvider?.Name ||
      "Chưa chọn";

    // Chuẩn hóa ảnh + thông tin hiển thị cho từng item
    for (const item of order.items) {
      const variant = item.variant;
      let img = variant?.dataValues?.VariantImageURL || null;

      // Nếu subquery không ra ảnh, fallback về ảnh mặc định theo ProductID
      if (!img && variant) {
        const productImage = await db.ProductImage.findOne({
          where: { ProductID: variant.ProductID },
          order: [
            ["IsDefault", "DESC"],
            ["ImageID", "ASC"]
          ]
        });
        if (productImage) img = productImage.ImageURL;
      }

      // Chuẩn hoá path: để FE chỉ cần nối thêm API_BASE
      if (img && !img.startsWith("http") && !img.startsWith("/")) {
        img = "/" + img;
      }

      item.dataValues.ImageURL = img || "/placeholder.jpg";
      item.dataValues.Size = item.Size || variant?.Size;
      item.dataValues.Color = item.Color || variant?.Color;
      item.dataValues.ProductName =
        item.ProductName || variant?.product?.Name || "";
    }

    return res.json({ Order: order, Items: order.items });
  } catch (error) {
    console.error("[guest-history][detail] Error:", error);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};


/**
 * @route   POST /api/guest-history/:id/cancel
 * @desc    Khách tự hủy đơn hàng
 * @access  Public
 */
exports.cancelOrder = async (req, res) => {
  try {
    const order = await db.GuestOrder.findByPk(req.params.id);
    if (!order)
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });

    // Cho phép hủy cả Pending và PendingPayment (chưa thanh toán)
    if (
      !(
        order.Status === "Pending" ||
        (order.Status === "PendingPayment" && order.PaymentStatus !== "Paid")
      )
    ) {
      return res.status(400).json({
        message:
          'Chỉ có thể hủy đơn khi đang ở "Chờ xác nhận" hoặc "Chờ thanh toán chưa trả tiền".',
      });
    }

    await order.update({ Status: "Cancelled" });
    return res.json({ message: "Đã hủy đơn hàng.", Order: order });
  } catch (error) {
    console.error("[guest-history][cancel] Error:", error);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

// =======================================================
// ===               CONTROLLERS CHO ADMIN               ===
// =======================================================

/**
 * @route   GET /api/admin/orders?customerType=guest
 * @desc    Admin lấy danh sách đơn hàng của khách
 * @access  Private (Admin)
 */
exports.getAllGuestOrdersAdmin = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.max(1, parseInt(req.query.limit || '10', 10));
        const offset = (page - 1) * limit;
        const { keyword, status } = req.query;

        const whereClause = {};
        if (status) whereClause.Status = status;
        if (keyword) {
            whereClause[Op.or] = [
                { FullName: { [Op.like]: `%${keyword}%` } },
                { Email: { [Op.like]: `%${keyword}%` } },
                { Phone: { [Op.like]: `%${keyword}%` } },
                { GuestOrderID: !isNaN(parseInt(keyword)) ? parseInt(keyword) : null },
            ];
        }

        const { count, rows } = await db.GuestOrder.findAndCountAll({
            where: whereClause,
            include: [{  // THÊM: Include ShippingProvider
                model: db.ShippingProvider,
                as: 'shippingProvider',
                attributes: ['Name'],
                required: false
            }],
            limit,
            offset,
            order: [['OrderDate', 'DESC']]
        });

        // SỬA: Fallback Name trong rows
        const processedRows = rows.map(order => ({
            ...order.toJSON(),
            ShippingProvider: order.ShippingProvider || order.shippingProvider?.Name || 'Chưa chọn'
        }));

        res.json({ orders: processedRows, total: count, page, limit });
    } catch (error) {
        console.error("ADMIN GET GUEST ORDERS ERROR:", error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

/**
 * @route   GET /api/admin/orders/guest/:id
 * @desc    Admin lấy chi tiết một đơn hàng của khách
 * @access  Private (Admin)
 */
exports.getGuestOrderDetailAdmin = async (req, res) => {
    try {
        const order = await db.GuestOrder.findByPk(req.params.id, {
            include: [{ 
                model: db.GuestOrderItem, 
                as: 'items',
                include: [{
                    model: db.ProductVariant,
                    as: 'variant',
                    include: { model: db.Product, as: 'product', attributes: ['Name'] }
                }]
            }, {  // THÊM: Include ShippingProvider
                model: db.ShippingProvider,
                as: 'shippingProvider',
                attributes: ['Name'],
                required: false
            }]
        });
        if (!order) return res.status(404).json({ errors: [{ msg: 'Không tìm thấy đơn hàng' }] });

        // SỬA: Fallback Name
        order.dataValues.ShippingProvider = order.ShippingProvider || order.shippingProvider?.Name || 'Chưa chọn';

        res.json(order);
    } catch (error) {
        console.error("ADMIN GET GUEST ORDER DETAIL ERROR:", error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

/**
 * @route   PUT /api/admin/orders/guest/:id/status
 * @desc    Admin cập nhật trạng thái đơn hàng của khách
 * @access  Private (Admin)
 */
exports.updateGuestOrderStatus = async (req, res) => {
    try {
        const order = await db.GuestOrder.findByPk(req.params.id);
        if (!order) return res.status(404).json({ errors: [{ msg: 'Không tìm thấy đơn hàng' }] });

        await order.update({ Status: req.body.Status });
        res.json({ message: 'Cập nhật trạng thái thành công' });
    } catch (error) {
        console.error('ADMIN UPDATE GUEST STATUS ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};