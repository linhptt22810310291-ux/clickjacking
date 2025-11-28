'use strict';

const db = require('../models');
const { Op } = require('sequelize');

/**
 * Service xử lý toàn bộ quy trình đặt hàng trong một transaction.
 * @param {object} orderData - Dữ liệu đơn hàng.
 * @param {boolean} isGuest - Cờ xác định đây là đơn của khách hay user.
 * @returns {object} - Đơn hàng vừa được tạo.
 */
exports.placeOrderTransaction = async (orderData, isGuest = false) => {
    const t = await db.sequelize.transaction();
    try {
        // Giả định totalAmount từ controller là SUBtotal (tiền hàng)
        const subtotal = Number(orderData.totalAmount) || 0;
        const shippingFee = Number(orderData.shippingFee) || 0;
        const userId = isGuest ? null : orderData.userId;

        // Cho phép controller truyền trạng thái ban đầu (phục vụ luồng chờ thanh toán, VNPAY...)
        const initialStatus = orderData.initialStatus || 'Pending';
        const initialPaymentStatus = orderData.initialPaymentStatus || 'Unpaid';

        /** ================== 1. KHÓA & KIỂM TRA TỒN KHO ================== */
        for (const item of orderData.items) {
            const variant = await db.ProductVariant.findByPk(item.variantId, {
                lock: t.LOCK.UPDATE,
                transaction: t
            });

            if (!variant) {
                throw new Error(`Sản phẩm với ID ${item.variantId} không tồn tại.`);
            }

            if (variant.StockQuantity < item.quantity) {
                throw new Error(`Sản phẩm ${variant.SKU} không đủ số lượng tồn kho.`);
            }
        }

        /** ================== 2. XỬ LÝ COUPON & TÍNH TOÁN ================== */
        let finalDiscount = 0;
        let finalTotalAmount = subtotal + shippingFee;
        let validatedCoupon = null;

        const rawCouponCode = orderData.couponCode && orderData.couponCode.trim();
        if (rawCouponCode) {
            const coupon = await db.Coupon.findOne({
                where: { Code: rawCouponCode },
                lock: t.LOCK.UPDATE,
                transaction: t
            });

            if (!coupon) {
                throw new Error('Mã giảm giá không tồn tại.');
            }

            // 2a. Kiểm tra điều kiện chung
            if (new Date(coupon.ExpiryDate) < new Date()) {
                throw new Error('Mã giảm giá đã hết hạn.');
            }

            if (coupon.MaxUses > 0 && coupon.UsedCount >= coupon.MaxUses) {
                throw new Error('Mã giảm giá đã hết lượt sử dụng.');
            }

            if (subtotal < Number(coupon.MinPurchaseAmount)) {
                throw new Error(
                    `Đơn hàng phải đạt tối thiểu ${Number(
                        coupon.MinPurchaseAmount
                    ).toLocaleString('vi-VN')}₫ để dùng mã này.`
                );
            }

            /** ===== 2b. Kiểm tra phạm vi áp dụng: All / Category / Product ===== */
            let eligibleSubtotal = subtotal;

            if (coupon.ApplicableType !== 'All' && coupon.ApplicableIDs) {
                const applicableIds = coupon.ApplicableIDs
                    .split(',')
                    .map((id) => parseInt(id.trim(), 10))
                    .filter(Number.isInteger);

                if (applicableIds.length > 0) {
                    const variantIdsInCart = orderData.items.map((item) => item.variantId);

                    const productsInCart = await db.ProductVariant.findAll({
                        where: { VariantID: { [Op.in]: variantIdsInCart } },
                        include: {
                            model: db.Product,
                            as: 'product',
                            attributes: ['ProductID', 'CategoryID']
                        },
                        attributes: ['VariantID'],
                        transaction: t
                    });

                    let eligibleItems = [];

                    if (coupon.ApplicableType === 'Category') {
                        const eligibleVariantIds = productsInCart
                            .filter((v) => applicableIds.includes(v.product.CategoryID))
                            .map((v) => v.VariantID);

                        eligibleItems = orderData.items.filter((item) =>
                            eligibleVariantIds.includes(item.variantId)
                        );
                    } else if (coupon.ApplicableType === 'Product') {
                        const eligibleVariantIds = productsInCart
                            .filter((v) => applicableIds.includes(v.product.ProductID))
                            .map((v) => v.VariantID);

                        eligibleItems = orderData.items.filter((item) =>
                            eligibleVariantIds.includes(item.variantId)
                        );
                    }

                    if (eligibleItems.length === 0) {
                        throw new Error(
                            'Mã giảm giá này không áp dụng cho bất kỳ sản phẩm nào trong giỏ hàng của bạn.'
                        );
                    }

                    eligibleSubtotal = eligibleItems.reduce(
                        (acc, item) => acc + item.price * item.quantity,
                        0
                    );
                }
            }

            /** ===== 2c. Kiểm tra quyền dùng theo User / Ví voucher / UsesPerUser ===== */
            if (!coupon.IsPublic) {
                // Mã private
                if (isGuest) {
                    throw new Error('Mã này chỉ dành cho thành viên đã đăng nhập.');
                }

                const userVoucher = await db.UserVoucher.findOne({
                    where: {
                        UserID: userId,
                        CouponID: coupon.CouponID,
                        IsUsed: false
                    },
                    transaction: t
                });

                if (!userVoucher) {
                    throw new Error('Bạn không có voucher này hoặc đã sử dụng.');
                }
            } else if (coupon.UsesPerUser > 0 && !isGuest) {
                // Mã public nhưng giới hạn số lần/ user → kiểm tra qua UsageLog
                const userUsageCount = await db.UsageLog.count({
                    where: {
                        CouponID: coupon.CouponID,
                        UserID: userId
                    },
                    transaction: t
                });

                if (userUsageCount >= coupon.UsesPerUser) {
                    throw new Error(
                        `Bạn đã dùng mã này ${coupon.UsesPerUser} lần (tối đa).`
                    );
                }
            }

            /** ===== 2d. Tính số tiền giảm ===== */
            const discountValue = Number(coupon.DiscountValue);

            if (coupon.DiscountType === 'Percent') {
                finalDiscount = Math.round((eligibleSubtotal * discountValue) / 100);
            } else if (coupon.DiscountType === 'FixedAmount') {
                finalDiscount = Math.min(eligibleSubtotal, discountValue);
            }

            validatedCoupon = coupon;
        }

        /** ================== 3. Tổng tiền cuối cùng ================== */
        finalTotalAmount = subtotal + shippingFee - finalDiscount;

        /** ================== 4. Tạo Order / GuestOrder ================== */
        let newOrder;
        const commonOrderData = {
            Subtotal: subtotal,
            ShippingFee: shippingFee,
            DiscountAmount: finalDiscount,
            TotalAmount: finalTotalAmount,
            CouponCode: validatedCoupon ? rawCouponCode : null,
            PaymentMethod: orderData.paymentMethod,
            ShippingProvider: orderData.ShippingProvider,
            ShippingProviderID: orderData.ShippingProviderID,
            Status: initialStatus,             // <-- từ file 2
            PaymentStatus: initialPaymentStatus // <-- từ file 2
        };

        if (isGuest) {
            // orderData.shipping: { Email, FullName, Phone, Address, ... }
            newOrder = await db.GuestOrder.create(
                {
                    ...commonOrderData,
                    ...orderData.shipping
                },
                { transaction: t }
            );
        } else {
            newOrder = await db.Order.create(
                {
                    ...commonOrderData,
                    UserID: userId,
                    ShippingAddressID: orderData.shippingAddressId
                },
                { transaction: t }
            );
        }

        /** ================== 5. Tạo OrderItems / GuestOrderItems ================== */
        const orderIdField = isGuest ? 'GuestOrderID' : 'OrderID';

        const orderItemsData = orderData.items.map((item) => ({
            [orderIdField]: newOrder[orderIdField],
            VariantID: item.variantId,
            Quantity: item.quantity,
            Price: item.price
        }));

        const OrderItemModel = isGuest ? db.GuestOrderItem : db.OrderItem;
        await OrderItemModel.bulkCreate(orderItemsData, { transaction: t });

        /** ================== 6. Trừ tồn kho ================== */
        for (const item of orderData.items) {
            await db.ProductVariant.decrement('StockQuantity', {
                by: item.quantity,
                where: { VariantID: item.variantId },
                transaction: t
            });
        }

        /** ================== 7. Xoá khỏi giỏ hàng (nếu không phải Buy Now) ================== */
        if (orderData.source !== 'buy-now') {
            const cartWhere = isGuest
                ? { SessionID: orderData.sessionId }
                : { UserID: userId };

            const cart = await db.Cart.findOne({ where: cartWhere, transaction: t });
            if (cart) {
                await db.CartItem.destroy({
                    where: {
                        CartID: cart.CartID,
                        VariantID: { [Op.in]: orderData.items.map((i) => i.variantId) }
                    },
                    transaction: t
                });
            }
        }

        /** ================== 8. Ghi log & cập nhật sử dụng coupon ================== */
        if (validatedCoupon) {
            // 8a. Ghi log sử dụng
            await db.UsageLog.create(
                {
                    CouponID: validatedCoupon.CouponID,
                    UserID: isGuest ? null : userId,
                    OrderID: isGuest ? null : newOrder.OrderID,
                    GuestOrderID: isGuest ? newOrder.GuestOrderID : null
                },
                { transaction: t }
            );

            // 8b. Tăng UsedCount tổng
            await validatedCoupon.increment('UsedCount', { by: 1, transaction: t });

            // 8c. Cập nhật 1 instance trong ví voucher (cho user đăng nhập)
            if (!isGuest && userId) {
                const instanceToUse = await db.UserVoucher.findOne({
                    where: {
                        UserID: userId,
                        CouponID: validatedCoupon.CouponID,
                        IsUsed: false
                    },
                    transaction: t
                });

                if (instanceToUse) {
                    await instanceToUse.update(
                        { IsUsed: true },
                        { transaction: t }
                    );
                }
            }
        }

        /** ================== HOÀN TẤT ================== */
        await t.commit();
        return newOrder;
    } catch (error) {
        await t.rollback();
        throw error;
    }
};
