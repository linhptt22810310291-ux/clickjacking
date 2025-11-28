const Joi = require('joi');

// ===============================
//  SCHEMA CHO ADMIN (TẠO/SỬA COUPON)
// ===============================
exports.couponSchema = Joi.object({
    Code: Joi.string().trim().min(3).max(50).required().messages({
        'string.empty': 'Mã coupon không được để trống.',
        'string.min': 'Mã coupon phải có ít nhất 3 ký tự.',
        'string.max': 'Mã coupon không được vượt quá 50 ký tự.',
        'any.required': 'Mã coupon là bắt buộc.'
    }),
    
    DiscountType: Joi.string().valid('Percent', 'FixedAmount').required().messages({
        'any.only': 'Loại giảm giá không hợp lệ (chỉ chấp nhận Percent hoặc FixedAmount).',
        'any.required': 'Loại giảm giá là bắt buộc.'
    }),

    DiscountValue: Joi.number().min(1).required().messages({
        'number.base': 'Giá trị giảm phải là số.',
        'number.min': 'Giá trị giảm phải lớn hơn hoặc bằng 1.',
        'any.required': 'Giá trị giảm là bắt buộc.'
    }),

    MinPurchaseAmount: Joi.number().min(0).required().messages({
        'number.base': 'Giá trị đơn hàng tối thiểu phải là số.',
        'number.min': 'Giá trị đơn hàng tối thiểu không được âm.',
        'any.required': 'Giá trị đơn hàng tối thiểu là bắt buộc.'
    }),
    
    // Chỉ bắt buộc là ngày, không check min('now') cho đỡ nhạy cảm múi giờ
    ExpiryDate: Joi.date().required().messages({
        'date.base': 'Ngày hết hạn không hợp lệ.',
        'any.required': 'Ngày hết hạn là bắt buộc.'
    }),
    
    MaxUses: Joi.number().integer().min(0).default(0).messages({
        'number.base': 'Tổng lượt dùng phải là số nguyên.',
        'number.min': 'Tổng lượt dùng không được âm.'
    }),

    UsesPerUser: Joi.number().integer().min(0).default(1).messages({
        'number.base': 'Lượt dùng/User phải là số nguyên.',
        'number.min': 'Lượt dùng/User không được âm.'
    }),

    IsPublic: Joi.boolean().default(true),

    EmailTo: Joi.string().allow(null, '').optional()
})
// 👉 DÒNG QUAN TRỌNG: cho phép thêm các key khác như ApplicableType, ApplicableIDs
.unknown(true);


// ===============================
//  SCHEMA CHO USER KHI CHECK COUPON Ở CHECKOUT
// ===============================
exports.checkCouponSchema = Joi.object({
    code: Joi.string().trim().required().messages({
        'string.empty': 'Vui lòng nhập mã coupon.',
        'any.required': 'Mã coupon là bắt buộc.'
    }),
    total: Joi.number().min(0).required().messages({
        'number.base': 'Tổng đơn hàng không hợp lệ.',
        'number.min': 'Tổng đơn hàng không được âm.',
        'any.required': 'Tổng đơn hàng là bắt buộc.'
    })
});
