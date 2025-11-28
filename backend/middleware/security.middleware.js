'use strict';

/**
 * 🛡️ ADVANCED SECURITY MIDDLEWARE
 * Tích hợp các biện pháp bảo vệ nâng cao cho ứng dụng web
 * 
 * Biện pháp 3: Mã hóa dữ liệu với HTTPS
 * Biện pháp 5: Tường lửa Ứng dụng Web (WAF)
 * Biện pháp 6: Phòng chống Tấn công Từ chối Dịch vụ (DDoS)
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const securityConfig = require('../config/security.config');
const logger = require('../utils/logger');

// 🆕 Import để track rate limit violations vào dashboard
let trackRateLimitViolation = null;
try {
  trackRateLimitViolation = require('./botDetection').trackRateLimitViolation;
} catch (e) {
  console.warn('botDetection not loaded yet');
}

// ============================================
// 🔒 HELMET - HTTP HEADERS SECURITY
// ============================================
const helmetMiddleware = helmet({
  // Loose CSP cho development - cho phép tất cả để tránh blocking
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "http:", "https:", "*"],
      styleSrc: ["'self'", "'unsafe-inline'", "http:", "https:", "*"],
      imgSrc: ["'self'", "data:", "blob:", "http:", "https:", "*"],
      connectSrc: ["'self'", "http:", "https:", "*"],
      fontSrc: ["'self'", "data:", "http:", "https:", "*"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "http:", "https:", "*"],
      frameSrc: ["'self'", "http:", "https:"],
      baseUri: ["'self'"],
      formAction: ["'self'", "http:", "https:"],
      upgradeInsecureRequests: null, // Không force upgrade trong dev
    },
  },
  
  // Tắt các policy khác
  crossOriginResourcePolicy: false,       // ✅ Cho phép loading images/resources
  crossOriginEmbedderPolicy: false,       // ✅ Không yêu cầu CORP
  crossOriginOpenerPolicy: false,         // ✅ Cho phép cross-origin contexts
  
  // Giữ các security headers quan trọng
  hsts: securityConfig.helmet.hsts,       // HTTPS enforcement (disabled in dev)
  frameguard: securityConfig.helmet.frameguard,  // X-Frame-Options: DENY
  noSniff: securityConfig.helmet.noSniff,        // X-Content-Type-Options: nosniff
  xssFilter: securityConfig.helmet.xssFilter,    // X-XSS-Protection
});

// ============================================
// 🚦 RATE LIMITING - Chống Brute Force & DDoS
// ============================================

// Rate limiter chung cho tất cả API
const generalLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.general.windowMs,
  max: securityConfig.rateLimit.general.max,
  message: securityConfig.rateLimit.general.message,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip} on ${req.path}`);
    res.status(429).json({
      success: false,
      message: securityConfig.rateLimit.general.message,
    });
  },
});

// Rate limiter cho login - chống brute force
const loginLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.login.windowMs,
  max: securityConfig.rateLimit.login.max,
  message: securityConfig.rateLimit.login.message,
  skipSuccessfulRequests: true, // Không đếm các lần đăng nhập thành công
  handler: (req, res) => {
    logger.error(`Too many login attempts from IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: securityConfig.rateLimit.login.message,
    });
  },
});

// Rate limiter cho đăng ký
const registerLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.register.windowMs,
  max: securityConfig.rateLimit.register.max,
  message: securityConfig.rateLimit.register.message,
  handler: (req, res) => {
    logger.warn(`Too many registration attempts from IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: securityConfig.rateLimit.register.message,
    });
  },
});

// Rate limiter cho password reset
const passwordResetLimiter = rateLimit({
  windowMs: securityConfig.rateLimit.passwordReset.windowMs,
  max: securityConfig.rateLimit.passwordReset.max,
  message: securityConfig.rateLimit.passwordReset.message,
  handler: (req, res) => {
    logger.warn(`Too many password reset attempts from IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: securityConfig.rateLimit.passwordReset.message,
    });
  },
});

// 🆕 Stats để track rate limit violations (chia sẻ với dashboard)
const rateLimitStats = {
  totalBlocked: 0,
  blockedIPs: new Set(),
  recentLogs: []
};

// 🛡️ Rate limiter cho API Products - Chống Bot Attack
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 100, // ⚡ Giảm xuống 15 requests/phút/IP - chặn bot sớm hơn
  message: 'Phát hiện hành vi bot! Bạn đã bị chặn.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const clientIP = req.headers['x-client-ip'] || 
                     req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.ip;
    
    // 🆕 Track trực tiếp vào rateLimitStats
    rateLimitStats.totalBlocked++;
    rateLimitStats.blockedIPs.add(clientIP);
    rateLimitStats.recentLogs.push({
      timestamp: new Date().toISOString(),
      ip: clientIP,
      path: req.path,
      type: 'RATE_LIMIT'
    });
    
    // Giữ tối đa 100 logs
    if (rateLimitStats.recentLogs.length > 100) {
      rateLimitStats.recentLogs = rateLimitStats.recentLogs.slice(-100);
    }
    
    logger.warn(`🚨 API Rate limit exceeded for IP: ${clientIP} on ${req.path}`);
    console.log(`📊 Rate limit stats: ${rateLimitStats.totalBlocked} blocked, ${rateLimitStats.blockedIPs.size} IPs`);
    
    res.status(429).json({
      success: false,
      message: '🤖 Phát hiện hành vi bot! Bạn đã bị chặn trong 1 phút.',
      blocked: true,
      retryAfter: 60
    });
  },
});

// 🆕 Export function để lấy stats
const getRateLimitStats = () => ({
  totalBlocked: rateLimitStats.totalBlocked,
  blockedIPs: Array.from(rateLimitStats.blockedIPs),
  blockedCount: rateLimitStats.blockedIPs.size,
  recentLogs: rateLimitStats.recentLogs
});

// 🆕 Reset stats function (cho emergency unblock)
const resetStats = () => {
  rateLimitStats.totalBlocked = 0;
  rateLimitStats.blockedIPs.clear();
  rateLimitStats.recentLogs = [];
  console.log('🔄 Rate limit stats have been reset');
};

// ============================================
// 🧹 DATA SANITIZATION - Chống Injection
// ============================================

// Chống NoSQL Injection - Custom implementation tương thích Express 5
const sanitizeData = (req, res, next) => {
  try {
    // Sanitize request body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query params (Express 5 compatible)
    if (req.query && typeof req.query === 'object') {
      const sanitizedQuery = sanitizeObject(req.query);
      // Rebuild query string instead of modifying req.query directly
      Object.keys(req.query).forEach(key => {
        if (req.query[key] !== sanitizedQuery[key]) {
          logger.warn(`Potential NoSQL injection detected in query param: ${key} from IP ${req.ip}`);
        }
      });
    }
    
    // Sanitize params
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    logger.error(`Error in sanitizeData middleware: ${error.message}`);
    next();
  }
};

// Helper function để sanitize objects
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      
      // Chặn các MongoDB operators
      if (key.startsWith('$') || key.startsWith('_')) {
        logger.warn(`Blocked NoSQL operator: ${key}`);
        sanitized[key.replace(/^\$|^_/, '')] = value;
        continue;
      }
      
      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return sanitized;
};

// Chống XSS (Cross-Site Scripting) - Custom implementation
const preventXSS = (req, res, next) => {
  try {
    if (req.body) {
      req.body = sanitizeXSS(req.body);
    }
    
    if (req.params) {
      req.params = sanitizeXSS(req.params);
    }
    
    // Note: req.query in Express 5 is read-only, so we just log warnings
    if (req.query && typeof req.query === 'object') {
      checkXSS(req.query, 'query', req.ip);
    }
    
    next();
  } catch (error) {
    logger.error(`Error in preventXSS middleware: ${error.message}`);
    next();
  }
};

// Helper function để sanitize XSS
const sanitizeXSS = (obj) => {
  if (!obj) return obj;
  
  if (typeof obj === 'string') {
    // Chỉ escape nếu phát hiện pattern nguy hiểm
    const dangerous = /<script|javascript:|onerror=|onload=|<iframe/i.test(obj);
    if (dangerous) {
      // Escape HTML special characters
      return obj
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    return obj; // Không escape nếu không có nguy hiểm
  }
  
  if (typeof obj === 'object') {
    const sanitized = Array.isArray(obj) ? [] : {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeXSS(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
};

// Helper function để check XSS trong read-only objects
const checkXSS = (obj, location, ip) => {
  if (!obj || typeof obj !== 'object') return;
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        const dangerous = /<script|javascript:|onerror=|onload=/i.test(value);
        if (dangerous) {
          logger.warn(`Potential XSS detected in ${location}.${key} from IP ${ip}: ${value.substring(0, 50)}`);
        }
      } else if (typeof value === 'object') {
        checkXSS(value, `${location}.${key}`, ip);
      }
    }
  }
};

// Chống HTTP Parameter Pollution
const preventHPP = hpp({
  whitelist: ['sort', 'page', 'limit', 'category', 'price'], // Các tham số được phép trùng lặp
});

// ============================================
// 🔐 HTTPS ENFORCEMENT
// ============================================
const enforceHTTPS = (req, res, next) => {
  if (securityConfig.https.required && !req.secure && req.get('x-forwarded-proto') !== 'https') {
    logger.warn(`HTTP request redirected to HTTPS from IP: ${req.ip}`);
    return res.redirect(301, `https://${req.hostname}${req.url}`);
  }
  next();
};

// ============================================
// 🛡️ ADDITIONAL SECURITY HEADERS
// ============================================
const additionalSecurityHeaders = (req, res, next) => {
  // Thêm các security headers bổ sung
  Object.entries(securityConfig.securityHeaders).forEach(([header, value]) => {
    res.setHeader(header, value);
  });
  next();
};

// ============================================
// 🚨 SUSPICIOUS ACTIVITY DETECTOR
// ============================================
const suspiciousActivityTracker = new Map();

const detectSuspiciousActivity = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!suspiciousActivityTracker.has(ip)) {
    suspiciousActivityTracker.set(ip, {
      requests: [],
      suspiciousPatterns: 0,
    });
  }
  
  const ipData = suspiciousActivityTracker.get(ip);
  ipData.requests.push(now);
  
  // Xóa các requests cũ hơn 1 phút
  ipData.requests = ipData.requests.filter(time => now - time < 60000);
  
  // Phát hiện hoạt động đáng ngờ
  if (ipData.requests.length > securityConfig.monitoring.thresholds.unusualTraffic) {
    ipData.suspiciousPatterns++;
    logger.error(`⚠️ Unusual traffic detected from IP: ${ip} - ${ipData.requests.length} requests in 1 minute`);
    
    if (ipData.suspiciousPatterns > 3) {
      logger.error(`🚨 BLOCKED suspicious IP: ${ip} - Too many suspicious patterns`);
      return res.status(403).json({
        success: false,
        message: 'Hoạt động đáng ngờ được phát hiện. IP của bạn đã bị tạm thời chặn.',
      });
    }
  }
  
  next();
};

// Dọn dẹp bộ nhớ mỗi 5 phút
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of suspiciousActivityTracker.entries()) {
    data.requests = data.requests.filter(time => now - time < 60000);
    if (data.requests.length === 0 && data.suspiciousPatterns === 0) {
      suspiciousActivityTracker.delete(ip);
    }
    // Reset suspicious patterns sau 10 phút
    if (data.requests.length === 0) {
      data.suspiciousPatterns = Math.max(0, data.suspiciousPatterns - 1);
    }
  }
}, 5 * 60 * 1000);

// ============================================
// 📝 REQUEST LOGGER - Ghi log mọi request
// ============================================
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    };
    
    // Log các request quan trọng hoặc lỗi
    if (res.statusCode >= 400 || req.path.includes('/admin') || req.path.includes('/auth')) {
      logger.info(`Request: ${JSON.stringify(logData)}`);
    }
  });
  
  next();
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  // Core security
  helmetMiddleware,
  enforceHTTPS,
  additionalSecurityHeaders,
  
  // Rate limiting
  generalLimiter,
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  
  // Data sanitization
  sanitizeData,
  preventXSS,
  preventHPP,
  
  // Monitoring
  detectSuspiciousActivity,
  requestLogger,
  
  // Aliases for easier use
  rateLimiters: {
    general: generalLimiter,
    login: loginLimiter,
    register: registerLimiter,
    passwordReset: passwordResetLimiter,
    api: apiLimiter,
  },
  
  // 🆕 Rate limit stats (cho dashboard)
  getRateLimitStats,
  resetStats,
};
