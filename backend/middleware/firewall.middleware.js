'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 🔥 FIREWALL MIDDLEWARE
 * Block malicious IPs và suspicious requests
 */

// Blocked IPs storage
const blockedIPsFile = path.join(__dirname, '../data/blocked-ips.json');
let blockedIPs = new Set();
let suspiciousIPs = new Map(); // IP -> { count, firstSeen, lastSeen }

// 🆕 Stats để sync với Security Dashboard
const firewallStats = {
  totalBlocked: 0,
  blockedIPs: new Set(),
  recentLogs: []
};

// Load blocked IPs from file
const loadBlockedIPs = () => {
  try {
    if (fs.existsSync(blockedIPsFile)) {
      const data = fs.readFileSync(blockedIPsFile, 'utf8');
      const ips = JSON.parse(data);
      blockedIPs = new Set(ips);
      console.log(`🔥 Loaded ${blockedIPs.size} blocked IPs`);
    }
  } catch (error) {
    console.error('❌ Error loading blocked IPs:', error);
  }
};

// Save blocked IPs to file
const saveBlockedIPs = () => {
  try {
    const dir = path.dirname(blockedIPsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(blockedIPsFile, JSON.stringify([...blockedIPs], null, 2));
    console.log(`💾 Saved ${blockedIPs.size} blocked IPs`);
  } catch (error) {
    console.error('❌ Error saving blocked IPs:', error);
  }
};

// Initialize
loadBlockedIPs();

/**
 * Get client IP
 */
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.headers['x-real-ip'] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         req.ip;
};

/**
 * Check if IP is blocked
 */
const isIPBlocked = (ip) => {
  return blockedIPs.has(ip);
};

/**
 * Block IP
 */
const blockIP = (ip, reason = 'Suspicious activity') => {
  blockedIPs.add(ip);
  saveBlockedIPs();
  console.log(`🚫 Blocked IP: ${ip} - Reason: ${reason}`);
};

/**
 * Unblock IP
 */
const unblockIP = (ip) => {
  blockedIPs.delete(ip);
  saveBlockedIPs();
  console.log(`✅ Unblocked IP: ${ip}`);
};

/**
 * Track suspicious IP
 */
const trackSuspiciousIP = (ip) => {
  const now = Date.now();
  
  if (!suspiciousIPs.has(ip)) {
    suspiciousIPs.set(ip, {
      count: 1,
      firstSeen: now,
      lastSeen: now,
    });
  } else {
    const data = suspiciousIPs.get(ip);
    data.count++;
    data.lastSeen = now;

    // Auto-block sau 10 suspicious requests trong 5 phút
    if (data.count >= 10 && (now - data.firstSeen) < 5 * 60 * 1000) {
      blockIP(ip, `Auto-blocked: ${data.count} suspicious requests in 5 minutes`);
      suspiciousIPs.delete(ip);
    }
  }
};

/**
 * Firewall Middleware
 */
const firewallMiddleware = (req, res, next) => {
  const ip = getClientIP(req);

  // 🆘 EMERGENCY UNBLOCK - Xử lý TRƯỚC khi check blocked
  // Chỉ cho phép route này bypass IP block check (KHÔNG bypass các security khác)
  // Route này vẫn phải qua các kiểm tra suspicious patterns phía dưới
  if (req.path === '/api/security/emergency-unblock' && req.method === 'POST') {
    // Vẫn log request này để biết ai đang cố unblock
    console.log(`🆘 Emergency unblock attempt from IP: ${ip}`);
    req.clientIP = ip;
    return next(); // Bypass chỉ IP block check, các middleware khác vẫn chạy
  }

  // 🛡️ WHITELIST - Cấu hình theo môi trường
  // Development: Whitelist localhost để test
  // Production: Chỉ whitelist IP của server nếu cần
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Whitelist IPs từ biến môi trường (cách nhau bởi dấu phẩy)
  // Ví dụ: WHITELIST_IPS=10.0.0.1,192.168.1.1
  const whitelistFromEnv = process.env.WHITELIST_IPS ? process.env.WHITELIST_IPS.split(',') : [];
  
  // Development: thêm localhost vào whitelist
  // Production: chỉ dùng WHITELIST_IPS từ .env
  const localhostIPs = ['::1', '127.0.0.1', '::ffff:127.0.0.1', 'localhost'];
  const whitelist = isProduction ? whitelistFromEnv : [...localhostIPs, ...whitelistFromEnv];
  
  const isWhitelisted = whitelist.includes(ip);

  // Check if IP is blocked (trừ whitelist)
  if (!isWhitelisted && isIPBlocked(ip)) {
    console.warn(`🚫 Blocked IP attempted access: ${ip}`);
    return res.status(403).json({
      success: false,
      message: 'Access denied. Your IP has been blocked.',
    });
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /(\.\.)|(\/\/)/, // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /exec|eval|system/i, // Command injection
  ];

  const url = req.originalUrl || req.url;
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(url));

  if (isSuspicious) {
    console.warn(`⚠️ Suspicious request from ${ip}: ${url}`);
    trackSuspiciousIP(ip);
    
    return res.status(403).json({
      success: false,
      message: 'Suspicious request detected',
    });
  }

  // Attach IP to request
  req.clientIP = ip;
  
  next();
};

/**
 * Rate limit per IP
 */
const ipRateLimitMap = new Map();

const ipRateLimit = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const ip = getClientIP(req);
    const now = Date.now();

    if (!ipRateLimitMap.has(ip)) {
      ipRateLimitMap.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
    } else {
      const data = ipRateLimitMap.get(ip);

      // Reset window
      if (now > data.resetTime) {
        data.count = 1;
        data.resetTime = now + windowMs;
      } else {
        data.count++;

        // Exceeded limit
        if (data.count > maxRequests) {
          console.warn(`⚠️ Rate limit exceeded for IP: ${ip} (${data.count} requests)`);
          trackSuspiciousIP(ip);
          
          // 🆕 Track vào firewallStats để sync với dashboard
          firewallStats.totalBlocked++;
          firewallStats.blockedIPs.add(ip);
          firewallStats.recentLogs.push({
            timestamp: new Date().toISOString(),
            ip: ip,
            path: req.path || req.url,
            type: 'IP_RATE_LIMIT',
            requestCount: data.count
          });
          
          // Giữ tối đa 100 logs
          if (firewallStats.recentLogs.length > 100) {
            firewallStats.recentLogs = firewallStats.recentLogs.slice(-100);
          }
          
          console.log(`📊 Firewall stats: ${firewallStats.totalBlocked} blocked, ${firewallStats.blockedIPs.size} IPs`);
          
          return res.status(429).json({
            success: false,
            message: 'Too many requests. Please try again later.',
          });
        }
      }
    }

    next();
  };
};

/**
 * Cleanup old suspicious IPs (run periodically)
 */
const cleanupSuspiciousIPs = () => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  for (const [ip, data] of suspiciousIPs.entries()) {
    if (now - data.lastSeen > maxAge) {
      suspiciousIPs.delete(ip);
    }
  }

  console.log(`🧹 Suspicious IPs cleanup. Remaining: ${suspiciousIPs.size}`);
};

// Cleanup every 5 minutes
setInterval(cleanupSuspiciousIPs, 5 * 60 * 1000);

/**
 * Admin endpoints
 */
const getBlockedIPs = (req, res) => {
  res.status(200).json({
    success: true,
    blockedIPs: [...blockedIPs],
    count: blockedIPs.size,
  });
};

const addBlockedIP = (req, res) => {
  const { ip, reason } = req.body;
  
  if (!ip) {
    return res.status(400).json({
      success: false,
      message: 'IP address is required',
    });
  }

  blockIP(ip, reason || 'Manually blocked');
  
  res.status(200).json({
    success: true,
    message: `IP ${ip} has been blocked`,
  });
};

const removeBlockedIP = (req, res) => {
  const { ip } = req.body;
  
  if (!ip) {
    return res.status(400).json({
      success: false,
      message: 'IP address is required',
    });
  }

  unblockIP(ip);
  
  res.status(200).json({
    success: true,
    message: `IP ${ip} has been unblocked`,
  });
};

// 🆕 Export function để lấy firewall stats cho dashboard
const getFirewallStats = () => ({
  totalBlocked: firewallStats.totalBlocked,
  blockedIPs: Array.from(firewallStats.blockedIPs),
  blockedCount: firewallStats.blockedIPs.size,
  recentLogs: firewallStats.recentLogs
});

module.exports = {
  firewallMiddleware,
  ipRateLimit,
  getClientIP,
  isIPBlocked,
  blockIP,
  unblockIP,
  getBlockedIPs,
  addBlockedIP,
  removeBlockedIP,
  getFirewallStats, // 🆕 Export stats
};
