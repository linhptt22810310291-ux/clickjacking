'use strict';

const db = require('../models');
const { sortObject } = require('../utils/vnpay.util');
const crypto = require('crypto');
const qs = require('qs');

/**
 * Helper: phân tích vnp_TxnRef => loại đơn + ID
 *  - USER_8  => { isGuest: false, orderId: 8 }
 *  - GUEST_9 => { isGuest: true,  orderId: 9 }
 */
function parseVnpRef(ref) {
  if (!ref || typeof ref !== 'string') {
    return { isGuest: false, orderId: null };
  }

  if (ref.startsWith('GUEST_')) {
    return { isGuest: true, orderId: parseInt(ref.replace('GUEST_', ''), 10) };
  }

  if (ref.startsWith('USER_')) {
    return { isGuest: false, orderId: parseInt(ref.replace('USER_', ''), 10) };
  }

  // Không dùng số trần nữa để tránh trùng OrderID / GuestOrderID
  return { isGuest: false, orderId: null };
}

/**
 * IPN từ VNPAY (dùng khi deploy public)
 * @route GET /api/payment/vnpay_ipn
 */
exports.vnpayIpnHandler = async (req, res) => {
  try {
    let vnp_Params = req.query;
    let secureHash = vnp_Params['vnp_SecureHash'];

    // Loại bỏ các field checksum trước khi kiểm tra
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    const secretKey = process.env.VNPAY_HASH_SECRET; // chú ý đúng tên env
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Sai checksum
    if (secureHash !== signed) {
      return res.status(200).json({ RspCode: '97', Message: 'Fail checksum' });
    }

    const ref = vnp_Params['vnp_TxnRef']; // ví dụ: USER_8 hoặc GUEST_9
    const rspCode = vnp_Params['vnp_ResponseCode']; // '00' = thành công

    const { isGuest, orderId } = parseVnpRef(ref);

    if (!orderId || Number.isNaN(orderId)) {
      return res.status(200).json({ RspCode: '01', Message: 'Invalid order ref' });
    }

    let order;
    if (isGuest) {
      order = await db.GuestOrder.findByPk(orderId);
    } else {
      order = await db.Order.findByPk(orderId);
    }

    if (!order) {
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
    }

    // Nếu đã Paid rồi thì bỏ qua, tránh xử lý trùng
    if (order.PaymentStatus === 'Paid') {
      return res.status(200).json({
        RspCode: '02',
        Message: 'Order already confirmed'
      });
    }

    // ----------------- THANH TOÁN THÀNH CÔNG -----------------
    if (rspCode === '00') {
      let newStatus = order.Status;

      // Đơn đang "Pending" hoặc "PendingPayment" thì chuyển sang "Confirmed"
      if (['Pending', 'PendingPayment'].includes(order.Status)) {
        newStatus = 'Confirmed';
      }

      await order.update({
        PaymentStatus: 'Paid',
        PaymentTxnRef: vnp_Params['vnp_TransactionNo'] || null,
        PaidAt: new Date(),
        Status: newStatus
      });

      console.log(
        `✅ [IPN] ${isGuest ? 'GuestOrder' : 'Order'} #${orderId} → Status=${newStatus}, PaymentStatus=Paid`
      );

      return res.status(200).json({ RspCode: '00', Message: 'Success' });
    }

    // ----------------- THANH TOÁN THẤT BẠI / BỊ HỦY -----------------
    // Nếu đã hủy trước đó thì không làm gì thêm
    if (order.Status === 'Cancelled') {
      return res
        .status(200)
        .json({ RspCode: '00', Message: 'Order already cancelled' });
    }

    const t = await db.sequelize.transaction();
    try {
      await order.update(
        {
          PaymentStatus: 'Failed',
          Status: 'Cancelled'
        },
        { transaction: t }
      );

      const ItemModel = isGuest ? db.GuestOrderItem : db.OrderItem;
      const orderIdField = isGuest ? 'GuestOrderID' : 'OrderID';

      const items = await ItemModel.findAll({
        where: { [orderIdField]: order[orderIdField] || orderId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      // Hoàn lại tồn kho
      for (const item of items) {
        if (!item.VariantID || !item.Quantity) continue;

        await db.ProductVariant.increment(
          { StockQuantity: item.Quantity },
          {
            where: { VariantID: item.VariantID },
            transaction: t
          }
        );
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      console.error('Restore stock on VNPAY IPN fail error:', err);
    }

    return res
      .status(200)
      .json({ RspCode: '00', Message: 'Fail payment processed' });
  } catch (error) {
    console.error('VNPAY IPN Error:', error);
    return res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
  }
};

/**
 * RETURN từ VNPAY (redirect về FE – dùng cho localhost / FE call lại)
 * @route GET /api/payment/vnpay_return
 */
exports.vnpayReturnHandler = async (req, res) => {
  try {
    console.log('===== VNPAY RETURN PARAMS =====');
    console.log(req.query);

    const vnp_Params = req.query;
    const ref = vnp_Params['vnp_TxnRef'];             // USER_8 hoặc GUEST_9
    const rspCode = vnp_Params['vnp_ResponseCode'];   // '00' = thành công
    const txnNo = vnp_Params['vnp_TransactionNo'] || null;

    const { isGuest, orderId } = parseVnpRef(ref);

    if (!orderId || Number.isNaN(orderId)) {
      return res
        .status(400)
        .json({ success: false, message: 'Mã đơn hàng (vnp_TxnRef) không hợp lệ.' });
    }

    // Tìm Order / GuestOrder
    let order;
    if (isGuest) {
      order = await db.GuestOrder.findByPk(orderId);
    } else {
      order = await db.Order.findByPk(orderId);
    }

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    // Nếu đã Paid rồi thì không xử lý lại
    if (order.PaymentStatus === 'Paid') {
      return res.json({
        success: true,
        message: 'Đơn hàng đã được xử lý trước đó.',
        orderStatus: order.Status,
        paymentStatus: order.PaymentStatus
      });
    }

    // ----------------- THANH TOÁN THÀNH CÔNG -----------------
    if (rspCode === '00') {
      let newStatus = order.Status;

      // Đơn đang "Pending" hoặc "PendingPayment" thì chuyển sang "Confirmed"
      if (['Pending', 'PendingPayment'].includes(order.Status)) {
        newStatus = 'Confirmed';
      }

      await order.update({
        PaymentStatus: 'Paid',
        PaymentTxnRef: txnNo,
        PaidAt: new Date(),
        Status: newStatus
      });

      console.log(
        `✅ [RETURN] ${isGuest ? 'GuestOrder' : 'Order'} #${orderId} → Status=${newStatus}, PaymentStatus=Paid`
      );

      // FE đang gọi API này bằng axios → trả JSON
      return res.json({
        success: true,
        message: 'Thanh toán thành công.',
        orderStatus: newStatus,
        paymentStatus: 'Paid'
      });
    }

    // ----------------- THANH TOÁN THẤT BẠI / BỊ HỦY -----------------
    const t = await db.sequelize.transaction();
    try {
      await order.update(
        {
          PaymentStatus: 'Failed',
          Status: 'Cancelled'
        },
        { transaction: t }
      );

      const ItemModel = isGuest ? db.GuestOrderItem : db.OrderItem;
      const orderIdField = isGuest ? 'GuestOrderID' : 'OrderID';

      const items = await ItemModel.findAll({
        where: { [orderIdField]: order[orderIdField] || orderId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      // Hoàn lại tồn khi thanh toán fail/hủy
      for (const item of items) {
        if (!item.VariantID || !item.Quantity) continue;

        await db.ProductVariant.increment(
          { StockQuantity: item.Quantity },
          {
            where: { VariantID: item.VariantID },
            transaction: t
          }
        );
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      console.error('Restore stock on VNPAY RETURN error:', err);
    }

    return res.json({
      success: false,
      message: 'Thanh toán thất bại hoặc bị hủy.',
      orderStatus: 'Cancelled',
      paymentStatus: 'Failed'
    });
  } catch (error) {
    console.error('VNPAY RETURN Error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Lỗi máy chủ khi xử lý return.' });
  }
};
