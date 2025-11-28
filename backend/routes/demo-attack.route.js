const express = require('express');
const router = express.Router();
const { detectBot } = require('../middleware/botDetection');

// Database giả lập vouchers
let voucherDatabase = [];

// Khởi tạo vouchers khi server start
function initializeVouchers() {
  voucherDatabase = [];
  for (let i = 1; i <= 100; i++) {
    voucherDatabase.push({
      id: i,
      code: `VOUCHER${String(i).padStart(3, '0')}`,
      discount: Math.floor(Math.random() * 50) + 10, // 10-60%
      used: false
    });
  }
  console.log(`✅ Đã khởi tạo ${voucherDatabase.length} vouchers`);
}

initializeVouchers();

/**
 * API: Chatbot lấy voucher
 * Endpoint này sẽ bị bot tấn công để săn voucher
 */
router.post('/chat', detectBot, async (req, res) => {
  try {
    const { message } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    
    console.log(`💬 [CHATBOT] IP ${clientIP}: "${message}"`);
    
    // Xử lý message từ user
    const normalizedMessage = message.toLowerCase().trim();
    
    // Lệnh lấy voucher
    if (normalizedMessage.includes('voucher') || 
        normalizedMessage.includes('mã giảm giá') ||
        normalizedMessage.includes('lấy voucher')) {
      
      // Tìm voucher chưa dùng
      const availableVoucher = voucherDatabase.find(v => !v.used);
      
      if (!availableVoucher) {
        return res.json({
          success: false,
          message: '😔 Rất tiếc! Tất cả voucher đã được sử dụng hết.',
          remainingVouchers: 0
        });
      }
      
      // Đánh dấu voucher đã dùng
      availableVoucher.used = true;
      
      const remainingVouchers = voucherDatabase.filter(v => !v.used).length;
      
      console.log(`🎁 [VOUCHER ISSUED] IP ${clientIP} nhận được ${availableVoucher.code}. Còn lại: ${remainingVouchers}`);
      
      return res.json({
        success: true,
        message: `🎉 Chúc mừng! Bạn nhận được voucher giảm ${availableVoucher.discount}%`,
        voucher: {
          code: availableVoucher.code,
          discount: availableVoucher.discount
        },
        remainingVouchers
      });
    }
    
    // Lệnh xem còn bao nhiêu voucher
    if (normalizedMessage.includes('còn') && normalizedMessage.includes('voucher')) {
      const remainingVouchers = voucherDatabase.filter(v => !v.used).length;
      return res.json({
        success: true,
        message: `Hiện còn ${remainingVouchers} voucher khả dụng.`,
        remainingVouchers
      });
    }
    
    // Default response
    res.json({
      success: true,
      message: 'Xin chào! Gõ "LẤY VOUCHER" để nhận mã giảm giá nhé! 😊'
    });
    
  } catch (error) {
    console.error('❌ [CHATBOT ERROR]:', error);
    res.status(500).json({
      success: false,
      error: 'Chatbot error',
      message: 'Đã xảy ra lỗi, vui lòng thử lại sau.'
    });
  }
});

/**
 * API: Thêm vào giỏ hàng
 * Endpoint này sẽ bị bot tấn công để gây DoS
 */
router.post('/add-to-cart', detectBot, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Giả lập xử lý chậm (như query database thật)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    console.log(`🛒 [ADD TO CART] IP ${clientIP} - Product: ${productId}, Qty: ${quantity}`);
    
    res.json({
      success: true,
      message: 'Đã thêm sản phẩm vào giỏ hàng',
      productId,
      quantity
    });
    
  } catch (error) {
    console.error('❌ [CART ERROR]:', error);
    res.status(500).json({
      success: false,
      error: 'Cart error'
    });
  }
});

/**
 * API: Reset vouchers (cho demo)
 */
router.post('/reset-vouchers', (req, res) => {
  initializeVouchers();
  res.json({
    success: true,
    message: 'Đã reset vouchers',
    totalVouchers: voucherDatabase.length
  });
});

/**
 * API: Thống kê vouchers
 */
router.get('/voucher-stats', (req, res) => {
  const used = voucherDatabase.filter(v => v.used).length;
  const remaining = voucherDatabase.filter(v => !v.used).length;
  
  res.json({
    total: voucherDatabase.length,
    used,
    remaining
  });
});

/**
 * API: Test endpoint cho bot attack demo
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Demo attack endpoint',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
