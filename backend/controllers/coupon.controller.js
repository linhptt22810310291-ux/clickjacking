'use strict';
const db = require('../models');
const { Op, Sequelize } = require('sequelize');
const { addDays } = require('date-fns');
const emailService = require('../services/email.service');

// =======================================================
// ===               CONTROLLERS CHO USER              ===
// =======================================================

/**
 * @route   GET /api/user/coupons
 * @desc    Lấy danh sách các coupon CÔNG KHAI còn hiệu lực (cho Guest)
 * @access  Public
 */
exports.listAvailableCoupons = async (req, res) => {
    try {
        const now = new Date();  

        const coupons = await db.Coupon.findAll({
            where: {
                ExpiryDate: { [Op.gte]: now }, // Chưa hết hạn
                IsPublic: true,                // CHỈ LẤY CÁC MÃ CÔNG KHAI
                [Op.or]: [
                    { MaxUses: 0 }, // Hoặc không giới hạn lượt dùng
                    { UsedCount: { [Op.lt]: Sequelize.col('MaxUses') } } // Hoặc lượt dùng < max
                ]
            },
            order: [['ExpiryDate', 'ASC']]
        });
        
        res.json({ success: true, coupons });  
    } catch (error) {
        console.error("coupons list error:", error);  
        res.status(500).json({ success: false, message: "Không lấy được danh sách mã." });
    }
};

/**
 * @route   POST /api/user/coupons/validate
 * @desc    Kiểm tra một mã coupon có hợp lệ không (Khi thanh toán)
 * @access  Public (có thể kèm token nếu user login)
 */
exports.validateCoupon = async (req, res) => {
    try {
        // SỬA: Nhận cả 'items' và 'total' từ body
        const { code, total, items } = req.body; 
        const userId = req.user?.id;
        const subtotal = Number(total || 0);

        if (!code) {
             return res.json({ success: true, valid: false, message: "Vui lòng nhập mã." });
        }
        
        const coupon = await db.Coupon.findOne({ where: { Code: code } });

        // --- BƯỚC 1: KIỂM TRA TỒN TẠI & HẾT HẠN ---
        if (!coupon) {
            return res.json({ success: true, valid: false, message: "Mã không tồn tại." });
        }
        if (new Date(coupon.ExpiryDate) < new Date()) {
            return res.json({ success: true, valid: false, message: "Mã đã hết hạn." });
        }
        if (coupon.MaxUses > 0 && coupon.UsedCount >= coupon.MaxUses) {
            return res.json({ success: true, valid: false, message: "Mã đã hết lượt sử dụng." });
        }
        
        // --- BƯỚC 2: KIỂM TRA ĐIỀU KIỆN ĐƠN HÀNG TỐI THIỂU ---
        const minAmount = Number(coupon.MinPurchaseAmount || 0);
        if (subtotal < minAmount) {
             return res.json({ success: true, valid: false, message: `Đơn hàng phải đạt tối thiểu ${minAmount.toLocaleString('vi-VN')}₫.` });
        }
        
        // === BƯỚC 3: SAO CHÉP LOGIC eligibleSubtotal TỪ order.service.js ===
        // (Giả định 'items' được gửi lên là [{ variantId: X, quantity: Y, price: Z }])
        
        let eligibleSubtotal = subtotal; // Mặc định

        if (coupon.ApplicableType !== 'All' && coupon.ApplicableIDs && items && items.length > 0) {
            const applicableIds = coupon.ApplicableIDs.split(',').map(id => parseInt(id.trim(), 10)).filter(Number.isInteger);
            
            if (applicableIds.length > 0) {
                const variantIdsInCart = items.map(item => item.variantId);
                
                const productsInCart = await db.ProductVariant.findAll({
                    where: { VariantID: { [Op.in]: variantIdsInCart } },
                    include: {
                        model: db.Product,
                        as: 'product',
                        attributes: ['ProductID', 'CategoryID']
                    },
                    attributes: ['VariantID'],
                    // Không cần transaction ở đây vì đây chỉ là check
                });

                let eligibleItems = []; 
                
                if (coupon.ApplicableType === 'Category') {
                    const eligibleProductIds = productsInCart
                        .filter(v => v.product && applicableIds.includes(v.product.CategoryID))
                        .map(v => v.VariantID);
                    eligibleItems = items.filter(item => eligibleProductIds.includes(item.variantId));

                } else if (coupon.ApplicableType === 'Product') {
                    const eligibleProductIds = productsInCart
                        .filter(v => v.product && applicableIds.includes(v.product.ProductID))
                        .map(v => v.VariantID);
                    eligibleItems = items.filter(item => eligibleProductIds.includes(item.variantId));
                }
                
                if (eligibleItems.length === 0) {
                    // SỬA: Thay vì ném lỗi 500, trả về JSON lỗi
                    return res.json({ success: true, valid: false, message: 'Mã giảm giá không áp dụng cho sản phẩm nào trong giỏ.' });
                }
                
                // Tính lại subtotal CHỈ cho các sản phẩm hợp lệ
                eligibleSubtotal = eligibleItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            }
        }
        // === KẾT THÚC BƯỚC 3 ===

        // --- BƯỚC 4: KIỂM TRA GIỚI HẠN SỬ DỤNG CÁ NHÂN ---
        if (userId) {
            if (!coupon.IsPublic) {
                const userVoucher = await db.UserVoucher.findOne({
                    where: { UserID: userId, CouponID: coupon.CouponID, IsUsed: false }
                });
                if (!userVoucher) {
                    return res.json({ success: true, valid: false, message: "Bạn không có voucher này hoặc đã sử dụng." });
                }
            } else if (coupon.UsesPerUser > 0) {
                const userUsageCount = await db.UsageLog.count({
                    where: { CouponID: coupon.CouponID, UserID: userId }
                });
                if (userUsageCount >= coupon.UsesPerUser) {
                     return res.json({ success: true, valid: false, message: `Bạn đã dùng mã này ${coupon.UsesPerUser} lần.` });
                }
            }
        } else if (!coupon.IsPublic) {
            return res.json({ success: true, valid: false, message: "Bạn phải đăng nhập để dùng mã này." });
        }
        
        // --- BƯỚC 5: TÍNH TOÁN VÀ TRẢ VỀ DISCOUNT (ĐÃ SỬA) ---
        let discount = 0;
        const discountValue = Number(coupon.DiscountValue);
        
        if (coupon.DiscountType === 'Percent') {
            // SỬA: Tính toán dựa trên eligibleSubtotal
            discount = Math.round((eligibleSubtotal * discountValue) / 100);
        } else if (coupon.DiscountType === 'FixedAmount') {
            // SỬA: Chỉ giảm tối đa bằng eligibleSubtotal
            discount = Math.min(eligibleSubtotal, discountValue);
        }
        
        return res.json({ 
            success: true, 
            valid: true, 
            message: "Áp dụng mã thành công!", // Thêm message
            discount: discount, // SỐ TIỀN GIẢM ĐÃ ĐÚNG
            code: coupon.Code // Trả về code để Redux lưu
            // (Bạn có thể trả về thêm type và value nếu frontend cần)
        });

    } catch (error) {
        console.error("coupon validate error:", error);
        res.status(500).json({ success: false, valid: false, message: "Lỗi máy chủ khi xác thực mã." });
    }
};

/**
 * @route   GET /api/user/vouchers
 * @desc    Lấy danh sách voucher trong ví của user (còn hạn hoặc hết hạn trong 2 ngày gần đây)
 * @access  Private
 */
exports.getUserVouchers = async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        
        // Tính ngày 2 ngày trước (giữ lại voucher hết hạn trong 2 ngày để user biết)
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const userVouchers = await db.UserVoucher.findAll({
            where: { UserID: userId }, // Lấy tất cả voucher của user
            attributes: ['IsUsed'], // Lấy trạng thái từ bảng gán
            include: [{
                model: db.Coupon,
                as: 'coupon',
                where: { 
                    // Lấy voucher còn hạn HOẶC hết hạn trong vòng 2 ngày gần đây
                    ExpiryDate: { [Op.gte]: twoDaysAgo }
                },
                attributes: [
                    'CouponID', 'Code', 'DiscountType', 'DiscountValue', 
                    'MinPurchaseAmount', 'ExpiryDate', 'MaxUses', 'UsedCount', 
                    'IsPublic', 'UsesPerUser','ApplicableType','ApplicableIDs' // Đảm bảo lấy đủ các trường này
                ],
                required: true // Bắt buộc phải join được (lọc ra voucher rác)
            }],
            order: [['createdAt', 'DESC']]
        });

        // Map lại dữ liệu
        const validVouchers = userVouchers
            .filter(uv => uv.coupon !== null) // Lọc lại (dù required: true đã làm)
            .map(uv => {
                const coupon = uv.coupon.toJSON(); // Lấy dữ liệu thô (PascalCase)
                
                // *** BẮT ĐẦU SỬA ***
                // Ánh xạ thủ công sang camelCase để frontend dùng nhất quán
                return {
                    // Lấy các trường cơ bản
                    CouponID: coupon.CouponID,
                    Code: coupon.Code,
                    DiscountType: coupon.DiscountType,
                    DiscountValue: coupon.DiscountValue,
                    MinPurchaseAmount: coupon.MinPurchaseAmount,
                    ExpiryDate: coupon.ExpiryDate,
                    MaxUses: coupon.MaxUses,
                    UsedCount: coupon.UsedCount,
                    IsPublic: coupon.IsPublic,
                    UsesPerUser: coupon.UsesPerUser,
                    
                    // ÁNH XẠ SANG camelCase (PHẦN QUAN TRỌNG NHẤT)
                    applicableType: coupon.ApplicableType, // PascalCase -> camelCase
                    applicableIDs: coupon.ApplicableIDs,   // PascalCase -> camelCase

                    // Trạng thái riêng của user
                    IsUsedInWallet: uv.IsUsed 
                };
                // *** KẾT THÚC SỬA ***
            });

        res.json({ success: true, vouchers: validVouchers });

    } catch (error) {
        console.error("user vouchers list error:", error);
        res.status(500).json({ success: false, message: "Không lấy được danh sách ví voucher." });
    }
};

/**
 * @route   GET /api/user/vouchers/collectible
 * @desc    Lấy danh sách voucher CÔNG KHAI mà user CÓ THỂ LƯU
 * @access  Private
 */
exports.getCollectibleVouchers = async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();

        // 1. Lấy tất cả coupon CÔNG KHAI còn dùng được
        const allPublicCoupons = await db.Coupon.findAll({
            where: {
                IsPublic: true,
                ExpiryDate: { [Op.gte]: now },
                [Op.or]: [
                    { MaxUses: 0 },
                    { UsedCount: { [Op.lt]: Sequelize.col('MaxUses') } }
                ]
            }
        });

        // 2. Lấy danh sách ID các coupon mà user ĐÃ LƯU/NHẬN
        const collectedCouponIds = await db.UserVoucher.findAll({
            where: { UserID: userId },
            attributes: ['CouponID']
        });
        
        const collectedIdSet = new Set(collectedCouponIds.map(v => v.CouponID));

        // 3. Lọc và trả về những coupon mà user CHƯA LƯU
        const collectibleVouchers = allPublicCoupons.filter(
            c => !collectedIdSet.has(c.CouponID)
        );
        
        res.json({ success: true, vouchers: collectibleVouchers });

    } catch (error) {
        console.error("get collectible vouchers error:", error);
        res.status(500).json({ success: false, message: "Lỗi khi tải voucher." });
    }
};

/**
 * @route   POST /api/user/coupons/claim
 * @desc    User NHẬP MÃ CODE để "Nhận" (Riêng tư) hoặc "Lưu" (Công khai) voucher vào ví
 * @access  Private
 */
exports.claimVoucher = async (req, res) => {
    try {
        const userId = req.user.id;
        const { code } = req.body; 

        if (!code) { /* ... (check code) */ }
        const coupon = await db.Coupon.findOne({ where: { Code: code } });

        if (!coupon) { /* ... (check tồn tại) */ }
        if (new Date(coupon.ExpiryDate) < new Date()) { /* ... (check hết hạn) */ }
        if (coupon.MaxUses > 0 && coupon.UsedCount >= coupon.MaxUses) { /* ... (check lượt dùng) */ }

        // 2. Kiểm tra xem đã "Nhận" (Lưu) chưa
        const existingVoucher = await db.UserVoucher.findOne({
            where: { UserID: userId, CouponID: coupon.CouponID }
        });
        if (existingVoucher) {
            return res.status(409).json({ message: "Bạn đã có voucher này trong ví." });
        }
        
        // === SỬA LOGIC TẠO VOUCHER ===
        // 3. Xử lý logic
        // Lấy số lượt dùng (mặc định là 1)
        const uses = coupon.UsesPerUser || 1; 

        // Tạo một mảng các "phiếu"
        const voucherInstances = [];
        for (let i = 0; i < uses; i++) {
            voucherInstances.push({
                UserID: userId,
                CouponID: coupon.CouponID,
                IsUsed: false
            });
        }
        
        // Thêm tất cả "phiếu" vào CSDL
        await db.UserVoucher.bulkCreate(voucherInstances);
        // === KẾT THÚC SỬA ===
        
        const message = coupon.IsPublic ? "Lưu voucher thành công!" : "Nhận voucher thành công!";
        return res.status(201).json({ success: true, message: message });

    } catch (error) {
        console.error("claim voucher error:", error);
        res.status(500).json({ success: false, message: "Lỗi khi nhận voucher." });
    }
};


// =======================================================
// ===               CONTROLLERS CHO ADMIN               ===
// =======================================================

/**
 * @route   GET /api/admin/coupons
 * @desc    Admin lấy danh sách coupon (phân trang, tìm kiếm, lọc)
 * @access  Private (Admin)
 */
exports.getAllCouponsAdmin = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.max(1, parseInt(req.query.limit || '10', 10));
        const offset = (page - 1) * limit;
        const { keyword, isNearExpiry } = req.query;

        const whereClause = {};
        if (keyword) {
            whereClause.Code = { [Op.like]: `%${keyword}%` };
        }
        if (isNearExpiry === 'true') {
            whereClause.ExpiryDate = { [Op.between]: [new Date(), addDays(new Date(), 7)] };
        }
        
        const { count, rows } = await db.Coupon.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            order: [['CouponID', 'ASC']]
        });
        res.json({ coupons: rows, total: count, page, limit });
    } catch (error) {
        console.error('ADMIN COUPONS LIST ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

/**
 * @route   POST /api/admin/coupons
 * @desc    Admin tạo coupon mới
 * @access  Private (Admin)
 */
exports.createCoupon = async (req, res) => {
    try {
        const { Code } = req.body;
        
        const existing = await db.Coupon.findOne({ where: { Code } });
        if (existing) {
            return res.status(409).json({ errors: [{ msg: 'Mã coupon đã tồn tại' }] });
        }
        
        const newCoupon = await db.Coupon.create(req.body);
        
        res.status(201).json({ message: 'Tạo coupon thành công', coupon: newCoupon });
    } catch (error) {
        console.error('ADMIN ADD COUPON ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

/**
 * @route   PUT /api/admin/coupons/:id
 * @desc    Admin cập nhật coupon
 * @access  Private (Admin)
 */
exports.updateCoupon = async (req, res) => {
    try {
        const couponId = parseInt(req.params.id, 10);
        if (isNaN(couponId)) {
            return res.status(400).json({ errors: [{ msg: 'Coupon ID không hợp lệ.' }] });
        }
        
        const coupon = await db.Coupon.findByPk(couponId);
        if (!coupon) {
            return res.status(404).json({ errors: [{ msg: 'Không tìm thấy coupon' }] });
        }

        await coupon.update(req.body);
        
        res.json({ message: 'Cập nhật coupon thành công', coupon });
    } catch (error) {
        console.error('ADMIN UPDATE COUPON ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

/**
 * @route   DELETE /api/admin/coupons/:id
 * @desc    Admin xóa coupon
 * @access  Private (Admin)
 */
exports.deleteCoupon = async (req, res) => {
    try {
        const deletedRows = await db.Coupon.destroy({ where: { CouponID: req.params.id } });
        if (deletedRows === 0) {
            return res.status(404).json({ errors: [{ msg: 'Không tìm thấy coupon' }] });
        }
        res.json({ message: 'Xóa coupon thành công' });
    } catch (error) {
        if (error instanceof Sequelize.ForeignKeyConstraintError) {
            return res.status(409).json({ errors: [{ msg: 'Không thể xóa coupon đã được sử dụng.' }] });
        }
        console.error('ADMIN DELETE COUPON ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

/**
 * @route   GET /api/admin/coupons/emails
 * @desc    Lấy danh sách email khách hàng
 * @access  Private (Admin)
 */
exports.getCustomerEmails = async (req, res) => {
    try {
        const userEmails = await db.User.findAll({ attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Email')), 'Email']] });
        const guestEmails = await db.GuestOrder.findAll({ attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Email')), 'Email']] });

        const allEmails = new Set([
            ...userEmails.map(u => u.Email),
            ...guestEmails.map(g => g.Email)
        ]);
        
        res.json({ emails: Array.from(allEmails) });
    } catch (error) {
        console.error('ADMIN FETCH EMAILS ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

/**
 * @route   POST /api/admin/coupons/send-email
 * @desc    Gửi email thông báo coupon (KHÔNG tự động gán)
 * @access  Private (Admin)
 */
exports.sendCouponToCustomers = async (req, res) => {
    const { couponId, emailTo } = req.body; 
    try {
        const coupon = await db.Coupon.findByPk(couponId);
        if (!coupon) return res.status(404).json({ message: 'Không tìm thấy coupon để gửi.' });

        let emailsToSend = [];
        let usersToAssign = []; // Chỉ dùng để lọc email nếu là mã riêng tư
        
        if (emailTo === 'all') {
            const userEmails = await db.User.findAll({ attributes: ['Email', 'UserID'] });
            const guestEmails = await db.GuestOrder.findAll({ attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('Email')), 'Email']] });
            const allEmailSet = new Set();
            userEmails.forEach(u => {
                allEmailSet.add(u.Email);
                usersToAssign.push({ UserID: u.UserID, Email: u.Email }); 
            });
            guestEmails.forEach(g => allEmailSet.add(g.Email));
            emailsToSend = Array.from(allEmailSet);
        } else if (emailTo) {
            emailsToSend = [emailTo];
            const user = await db.User.findOne({ where: { Email: emailTo }, attributes: ['UserID', 'Email'] });
            if (user) usersToAssign.push({ UserID: user.UserID, Email: user.Email }); 
        }
        
        if(emailsToSend.length === 0) {
            return res.status(400).json({ message: 'Không có email nào để gửi.' });
        }

        // Nếu là Riêng tư, chỉ gửi cho User (không gửi cho Guest)
        if (!coupon.IsPublic) { 
            emailsToSend = usersToAssign.map(u => u.Email); 
            if(emailsToSend.length === 0) {
                return res.json({ message: 'Coupon là riêng tư. Không có tài khoản User nào (Khách không được gán) khớp với email để gửi.' });
            }
        }
        
        // Gửi email từng cái một để tránh rate limit (Resend free tier)
        let successCount = 0;
        let failedCount = 0;
        
        for (const email of emailsToSend) {
            try {
                await emailService.sendCouponEmail(email, coupon);
                successCount++;
                // Delay nhỏ giữa các email để tránh rate limit
                if (emailsToSend.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
                }
            } catch (emailError) {
                console.error(`Failed to send coupon email to ${email}:`, emailError.message);
                failedCount++;
            }
        }
        
        let message = `Đã gửi thành công ${successCount}/${emailsToSend.length} email.`;
        if (failedCount > 0) {
            message += ` ${failedCount} email thất bại.`;
        }
        
        return res.json({ message, successCount, failedCount, total: emailsToSend.length });

    } catch(error) {
        console.error('ADMIN SEND COUPON EMAIL ERROR:', error);
        res.status(500).json({ errors: [{ msg: error.message || 'Lỗi khi gửi email' }] });
    }
};

/**
 * @route   GET /api/admin/coupons/:id/usage
 * @desc    Lấy danh sách ai đã dùng 1 coupon
 * @access  Private (Admin)
 */
exports.getCouponUsage = async (req, res) => {
    try {
        const couponId = parseInt(req.params.id, 10);
        if (isNaN(couponId)) {
            return res.status(400).json({ errors: [{ msg: 'Coupon ID không hợp lệ.' }] });
        }
        const logs = await db.UsageLog.findAll({
            where: { CouponID: couponId },
            include: [
                { 
                    model: db.User, 
                    as: 'user', 
                    attributes: ['UserID', 'Username', 'Email'] 
                },
                { 
                    model: db.GuestOrder, 
                    as: 'guestOrder', 
                    attributes: ['GuestOrderID', 'FullName', 'Email'] 
                }
            ],
            order: [['UsedAt', 'DESC']]
        });
        
        const usageDetails = logs.map(log => ({
            UsageID: log.UsageID,
            UsedAt: log.UsedAt,
            Customer: log.user 
                ? `[User] ${log.user.Username} (${log.user.Email})` 
                : `[Guest] ${log.guestOrder.FullName} (${log.guestOrder.Email})`,
            OrderID: log.OrderID || log.GuestOrderID
        }));

        res.json({ usage: usageDetails });

    } catch (error) {
        console.error('ADMIN GET COUPON USAGE ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

/**
 * @route   GET /api/admin/coupons/:id/assignments
 * @desc    Lấy danh sách ai đã được gán 1 voucher (cho mã private)
 * @access  Private (Admin)
 */
exports.getCouponAssignments = async (req, res) => {
    try {
        const couponId = parseInt(req.params.id, 10);
        if (isNaN(couponId)) {
            return res.status(400).json({ errors: [{ msg: 'Coupon ID không hợp lệ.' }] });
        }
        
        const assignments = await db.UserVoucher.findAll({
            where: { CouponID: couponId },
            include: [
                { 
                    model: db.User, 
                    as: 'user', 
                    attributes: ['UserID', 'Username', 'Email'] 
                }
            ],
            attributes: ['IsUsed', 'createdAt'] // Lấy trạng thái đã dùng hay chưa
        });

        res.json({ assignments: assignments });

    } catch (error) {
        console.error('ADMIN GET COUPON ASSIGNMENTS ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};