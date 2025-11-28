/**
 * 🛡️ ADVANCED LOGGING SYSTEM (Cloudflare-style)
 * 
 * Ghi log vào:
 * - Console (development)
 * - File logs/combined.log (tất cả logs)
 * - File logs/error.log (chỉ errors)
 * - File logs/bot-attacks-%DATE%.log (rotate hàng ngày)
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Tạo thư mục logs nếu chưa có
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Định nghĩa format log
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Format cho console (màu sắc đẹp)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return msg;
  })
);

// Logger chính
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // 1. Console (development)
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    }),

    // 2. File tổng hợp (combined.log)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),

    // 3. File lỗi (error.log)
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5
    }),

    // 4. File bot attacks (rotate hàng ngày)
    new DailyRotateFile({
      filename: path.join(logsDir, 'bot-attacks-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'warn',
      maxSize: '20m',
      maxFiles: '14d', // Giữ 14 ngày
      zippedArchive: true
    })
  ],

  // Xử lý lỗi logging
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Logger chuyên dụng cho Bot Attacks
const botAttackLogger = winston.createLogger({
  level: 'warn',
  format: logFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'bot-attacks-%DATE%.log'),
      datePattern: 'YYYY-MM-DD-HH',
      maxSize: '20m',
      maxFiles: '7d',
      zippedArchive: true
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Helper functions
logger.botAttack = (message, meta = {}) => {
  const logData = {
    type: 'BOT_ATTACK',
    timestamp: new Date().toISOString(),
    message,
    ...meta
  };
  
  botAttackLogger.warn(message, logData);
  logger.warn(message, logData);
};

logger.botBlocked = (ip, reason, meta = {}) => {
  logger.botAttack(`🚫 BOT BLOCKED: IP ${ip}`, {
    ip,
    reason,
    action: 'BLOCKED',
    ...meta
  });
};

logger.botDetected = (ip, reason, meta = {}) => {
  logger.botAttack(`⚠️ BOT DETECTED: IP ${ip}`, {
    ip,
    reason,
    action: 'DETECTED',
    ...meta
  });
};

logger.securityEvent = (event, meta = {}) => {
  logger.warn(`🔐 SECURITY EVENT: ${event}`, {
    type: 'SECURITY',
    event,
    ...meta
  });
};

// Thống kê logging
let logStats = {
  botAttacks: 0,
  blockedIPs: new Set(),
  startTime: Date.now()
};

logger.getStats = () => ({
  ...logStats,
  blockedIPs: Array.from(logStats.blockedIPs),
  uptime: Date.now() - logStats.startTime
});

logger.incrementBotAttack = (ip) => {
  logStats.botAttacks++;
  logStats.blockedIPs.add(ip);
};

// 🔄 Reset statistics (for admin dashboard)
logger.resetStats = () => {
  logStats.botAttacks = 0;
  logStats.blockedIPs.clear();
  logger.info('📊 Statistics reset by admin');
};

module.exports = logger;
