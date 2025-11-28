/**
 * Middleware phát hiện bot dựa trên Time Measurement
 * Phát hiện bot bằng cách:
 * 1. Đo thời gian từ lúc vào trang đến lúc click (quá nhanh = bot)
 * 2. Phát hiện pattern nhất quán đáng ngờ (timing quá đều = bot)
 * 
 * 🆕 Tích hợp Winston Logger + Alert System
 */

const logger = require('../utils/logger');
const { alertBotAttack } = require('../utils/alertSystem');

// Lưu trữ thông tin truy cập của mỗi IP
const visitTracking = new Map();
const botBlacklist = new Set();

// 🆕 Tracking Rate Limit violations (để hiển thị trên dashboard)
const rateLimitStats = {
  totalBlocked: 0,
  blockedIPs: new Set(),
  recentLogs: [] // Lưu 100 logs gần nhất
};

// 🔥 XÓA BLACKLIST KHI KHỞI ĐỘNG (Tránh IP bị block vĩnh viễn)
setTimeout(() => {
  if (botBlacklist.size > 0) {
    console.log(`🧹 Clearing ${botBlacklist.size} IPs from blacklist...`);
    botBlacklist.clear();
    visitTracking.clear();
  }
}, 2000); // Xóa sau 2 giây khởi động

// Configuration
const CONFIG = {
  MIN_TIME_HUMAN: 500,         // Người thật ít nhất mất 0.5 giây
  MAX_REQUESTS_PER_MINUTE: 30, // Tăng lên 30 requests/phút cho bình thường
  PATTERN_THRESHOLD: 5,        // Tăng lên 5 requests mới phát hiện pattern
  TIMING_TOLERANCE: 100,       // Sai số cho phép (ms)
  BLACKLIST_DURATION: 300000   // Block 5 phút
};

/**
 * Middleware track thời gian page load
 * 🎯 FIX: Chỉ track page load cho non-API GET requests
 */
const trackPageVisit = (req, res, next) => {
  // Chỉ track page load cho các request GET không phải là API
  // Điều này ngăn việc các API call liên tiếp reset pageLoadTime
  const isApiRequest = req.path.startsWith('/api/');
  if (req.method !== 'GET' || isApiRequest) {
    return next();
  }

  // 🎯 Ưu tiên lấy IP từ custom header (để test bot với nhiều IP khác nhau)
  const clientIP = req.headers['x-client-ip'] || 
                   req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.ip || 
                   req.connection.remoteAddress;
  
  const now = Date.now();
  
  if (!visitTracking.has(clientIP)) {
    visitTracking.set(clientIP, {
      pageLoadTime: now,
      actions: [],
      requestTimes: []
    });
  } else {
    const tracking = visitTracking.get(clientIP);
    tracking.pageLoadTime = now;
  }
  
  next();
};

/**
 * Middleware phát hiện bot dựa trên timing
 * 🔥 CHỈ áp dụng cho /demo-attack endpoint
 * ✅ Các route user bình thường KHÔNG qua middleware này
 */
const detectBot = (req, res, next) => {
  // 🎯 Lấy IP
  const clientIP = req.headers['x-client-ip'] || 
                   req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.ip || 
                   req.connection.remoteAddress;
  
  const now = Date.now();
  
  // 🎯 Kiểm tra blacklist
  if (botBlacklist.has(clientIP)) {
    logger.botBlocked(clientIP, 'IP đã bị chặn trước đó', {
      endpoint: req.path,
      method: req.method
    });
    
    return res.status(403).json({
      success: false,
      error: 'Bot detected. Access denied.',
      reason: 'Hành vi đáng ngờ đã được phát hiện'
    });
  }
  
  const tracking = visitTracking.get(clientIP);
  
  if (!tracking) {
    // Không có thông tin tracking -> tạo mới
    visitTracking.set(clientIP, {
      pageLoadTime: now,
      actions: [],
      requestTimes: [now]
    });
    return next();
  }
  
  // 1️⃣ PHÁT HIỆN: Hành động quá nhanh
  const timeSincePageLoad = now - tracking.pageLoadTime;
  if (timeSincePageLoad < CONFIG.MIN_TIME_HUMAN) {
    logger.botDetected(clientIP, 'Hành động quá nhanh', {
      timeSincePageLoad: `${timeSincePageLoad}ms`,
      threshold: `${CONFIG.MIN_TIME_HUMAN}ms`,
      endpoint: req.path,
      method: req.method
    });
    
    blockBot(clientIP, 'Action too fast');
    return res.status(403).json({
      success: false,
      error: 'Bot detected: Action too fast',
      timeSincePageLoad,
      reason: 'Thời gian phản ứng nhanh hơn con người'
    });
  }
  
  // 2️⃣ PHÁT HIỆN: Rate limiting
  tracking.requestTimes.push(now);
  // Xóa requests cũ hơn 1 phút
  tracking.requestTimes = tracking.requestTimes.filter(
    time => now - time < 60000
  );
  
  if (tracking.requestTimes.length > CONFIG.MAX_REQUESTS_PER_MINUTE) {
    logger.botDetected(clientIP, 'Rate limit exceeded', {
      requestCount: tracking.requestTimes.length,
      limit: CONFIG.MAX_REQUESTS_PER_MINUTE,
      endpoint: req.path,
      method: req.method
    });
    
    blockBot(clientIP, 'Too many requests');
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      requestCount: tracking.requestTimes.length,
      reason: 'Vượt quá giới hạn requests cho phép'
    });
  }
  
  // 3️⃣ PHÁT HIỆN: Pattern nhất quán đáng ngờ
  tracking.actions.push({
    timestamp: now,
    timeSinceLoad: timeSincePageLoad,
    path: req.path
  });
  
  // Giữ lại 10 actions gần nhất
  if (tracking.actions.length > 10) {
    tracking.actions = tracking.actions.slice(-10);
  }
  
  // Phân tích pattern
  if (tracking.actions.length >= CONFIG.PATTERN_THRESHOLD) {
    const timings = tracking.actions.map(a => a.timeSinceLoad);
    const isConsistentPattern = checkConsistentPattern(timings);
    
    if (isConsistentPattern) {
      logger.botDetected(clientIP, 'Suspicious pattern', {
        timings,
        endpoint: req.path,
        method: req.method
      });
      
      blockBot(clientIP, 'Suspicious pattern');
      return res.status(403).json({
        success: false,
        error: 'Bot detected: Suspicious pattern',
        timings,
        reason: 'Hành vi quá đều đặn, không giống người thật'
      });
    }
  }
  
  logger.debug(`✅ Human verified: IP ${clientIP}`, {
    timeSincePageLoad: `${timeSincePageLoad}ms`,
    requestsPerMin: tracking.requestTimes.length
  });
  next();
};

/**
 * Kiểm tra pattern nhất quán
 */
function checkConsistentPattern(timings) {
  if (timings.length < CONFIG.PATTERN_THRESHOLD) return false;
  
  // Tính độ lệch chuẩn
  const mean = timings.reduce((a, b) => a + b, 0) / timings.length;
  const variance = timings.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / timings.length;
  const stdDev = Math.sqrt(variance);
  
  // Nếu độ lệch chuẩn quá nhỏ -> timing quá đều -> bot
  if (stdDev < CONFIG.TIMING_TOLERANCE) {
    return true;
  }
  
  // Kiểm tra khoảng cách giữa các requests
  const intervals = [];
  for (let i = 1; i < timings.length; i++) {
    intervals.push(timings[i] - timings[i - 1]);
  }
  
  // Nếu các khoảng cách quá giống nhau -> bot
  const intervalMean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const intervalVariance = intervals.reduce((sum, val) => sum + Math.pow(val - intervalMean, 2), 0) / intervals.length;
  const intervalStdDev = Math.sqrt(intervalVariance);
  
  return intervalStdDev < CONFIG.TIMING_TOLERANCE;
}

/**
 * Chặn bot
 */
function blockBot(ip, reason) {
  botBlacklist.add(ip);
  logger.incrementBotAttack(ip);
  
  logger.botBlocked(ip, reason, {
    blacklistDuration: `${CONFIG.BLACKLIST_DURATION / 1000}s`,
    totalBlocked: botBlacklist.size
  });
  
  // 🚨 Gửi alert nếu vượt ngưỡng
  const stats = logger.getStats();
  if (stats.blockedIPs.length >= 3) {
    alertBotAttack({
      ip,
      reason,
      attackCount: stats.botAttacks,
      blockedCount: stats.blockedIPs.length
    });
  }
  
  // Tự động unblock sau một thời gian
  setTimeout(() => {
    botBlacklist.delete(ip);
    logger.info(`✅ IP ${ip} unblocked after timeout`);
  }, CONFIG.BLACKLIST_DURATION);
}

/**
 * Clear tracking data định kỳ (tránh memory leak)
 */
setInterval(() => {
  const now = Date.now();
  const CLEANUP_THRESHOLD = 3600000; // 1 giờ
  
  for (const [ip, data] of visitTracking.entries()) {
    if (now - data.pageLoadTime > CLEANUP_THRESHOLD) {
      visitTracking.delete(ip);
    }
  }
  
  logger.info(`🧹 Tracking data cleaned. Active IPs: ${visitTracking.size}`);
}, 600000); // Chạy mỗi 10 phút

/**
 * Lấy thống kê bot attacks (cho admin dashboard)
 */
function getBotStats() {
  // Kết hợp cả bot blacklist và rate limit blocked IPs
  const allBlockedIPs = new Set([...botBlacklist, ...rateLimitStats.blockedIPs]);
  
  return {
    activeTracking: visitTracking.size,
    blockedIPs: Array.from(allBlockedIPs),
    blockedCount: allBlockedIPs.size,
    totalBotAttacks: rateLimitStats.totalBlocked,
    recentLogs: rateLimitStats.recentLogs.slice(-50), // 50 logs gần nhất
    config: CONFIG
  };
}

/**
 * 🆕 Track Rate Limit violation (gọi từ security.middleware)
 */
function trackRateLimitViolation(ip, path) {
  rateLimitStats.totalBlocked++;
  rateLimitStats.blockedIPs.add(ip);
  
  // Thêm vào recent logs
  rateLimitStats.recentLogs.push({
    timestamp: new Date().toISOString(),
    ip: ip,
    path: path,
    type: 'RATE_LIMIT'
  });
  
  // Giữ tối đa 100 logs
  if (rateLimitStats.recentLogs.length > 100) {
    rateLimitStats.recentLogs = rateLimitStats.recentLogs.slice(-100);
  }
  
  logger.warn(`🚨 Rate limit blocked IP: ${ip} on ${path}`);
}

/**
 * 🔥 Xóa blacklist thủ công (dành cho admin hoặc khi cần reset)
 */
function clearBlacklist() {
  const count = botBlacklist.size;
  botBlacklist.clear();
  visitTracking.clear();
  logger.info(`🧹 Manually cleared ${count} IPs from blacklist`);
  return { cleared: count };
}

module.exports = {
  trackPageVisit,
  detectBot,
  getBotStats,
  clearBlacklist, // 🆕 Export để có thể gọi từ route
  trackRateLimitViolation, // 🆕 Track rate limit violations
  CONFIG
};
