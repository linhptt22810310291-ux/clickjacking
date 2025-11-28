'use strict';

/**
 * 🛡️ SECURITY CONFIGURATION
 * Cấu hình bảo mật tổng quát cho toàn bộ ứng dụng
 * 
 * Biện pháp 1: Thiết lập Chính sách & Nâng cao Nhận thức
 * Biện pháp 3: Mã hóa dữ liệu với HTTPS
 * Biện pháp 4: Bảo vệ Tài khoản Quản trị
 * Biện pháp 5: Tường lửa Ứng dụng Web (WAF)
 */

module.exports = {
  // ============================================
  // 🔐 PASSWORD POLICY (Biện pháp 4)
  // ============================================
  password: {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90, // Thay đổi mật khẩu sau 90 ngày
    preventReuse: 5, // Không được dùng lại 5 mật khẩu gần nhất
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 phút
  },

  // ============================================
  // 🚦 RATE LIMITING (Biện pháp 5 & 6)
  // ============================================
  rateLimit: {
    // API chung
    general: {
      windowMs: 15 * 60 * 1000, // 15 phút
      max: 100, // Tối đa 100 requests
      message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút.',
    },
    // Login endpoint - chống brute force
    login: {
      windowMs: 15 * 60 * 1000,
      max: 5, // Chỉ 5 lần đăng nhập trong 15 phút
      message: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau 15 phút.',
    },
    // Đăng ký tài khoản
    register: {
      windowMs: 60 * 60 * 1000, // 1 giờ
      max: 3, // Chỉ 3 tài khoản mới trong 1 giờ
      message: 'Quá nhiều yêu cầu đăng ký, vui lòng thử lại sau.',
    },
    // API thay đổi mật khẩu
    passwordReset: {
      windowMs: 60 * 60 * 1000,
      max: 3,
      message: 'Quá nhiều yêu cầu đổi mật khẩu, vui lòng thử lại sau.',
    },
  },

  // ============================================
  // 🔒 HELMET - HTTP HEADERS SECURITY (Biện pháp 3)
  // ============================================
  helmet: {
    // Content Security Policy - Relaxed cho development
    contentSecurityPolicy: false, // Tắt CSP để tránh block resources trong development
    // Trong production, enable lại với config phù hợp
    
    // HTTP Strict Transport Security - chỉ enable trong production
    hsts: false, // Tắt trong development
    
    // Các cấu hình khác
    frameguard: {
      action: 'deny', // Chống clickjacking
    },
    noSniff: true, // Chống MIME sniffing
    xssFilter: true, // XSS Protection
  },

  // ============================================
  // 👤 SESSION MANAGEMENT (Biện pháp 4 & 7)
  // ============================================
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24 giờ
    maxActiveSessions: 3, // Tối đa 3 phiên đăng nhập cùng lúc
    inactivityTimeout: 30 * 60 * 1000, // 30 phút không hoạt động
    requireReauthForSensitiveOps: true, // Yêu cầu xác thực lại cho thao tác nhạy cảm
  },

  // ============================================
  // 🔐 MULTI-FACTOR AUTHENTICATION (Biện pháp 4)
  // ============================================
  mfa: {
    required: {
      admin: true, // Bắt buộc cho admin
      user: false, // Tùy chọn cho user
    },
    tokenExpiry: 30, // Token hết hạn sau 30 giây
    backupCodesCount: 10, // Số lượng backup codes
  },

  // ============================================
  // 📝 AUDIT LOGGING (Biện pháp 7 & 9)
  // ============================================
  audit: {
    logSensitiveOperations: true,
    logFailedLogins: true,
    logPermissionChanges: true,
    logDataExports: true,
    retentionDays: 90, // Giữ log trong 90 ngày
    alertOnSuspiciousActivity: true,
  },

  // ============================================
  // 💾 BACKUP & RECOVERY (Biện pháp 8)
  // ============================================
  backup: {
    enabled: true,
    schedule: {
      daily: '02:00', // 2 giờ sáng hàng ngày
      weekly: 'Sunday 03:00',
      monthly: '1st 04:00',
    },
    retention: {
      daily: 7, // Giữ 7 bản backup hàng ngày
      weekly: 4, // Giữ 4 bản backup hàng tuần
      monthly: 12, // Giữ 12 bản backup hàng tháng
    },
    locations: {
      local: './backups',
      cloud: process.env.BACKUP_CLOUD_PATH || null,
    },
    encryption: true, // Mã hóa bản backup
  },

  // ============================================
  // 🛡️ INPUT VALIDATION (Biện pháp 5)
  // ============================================
  validation: {
    sanitizeInput: true, // Làm sạch đầu vào
    preventSQLInjection: true,
    preventXSS: true,
    preventNoSQLInjection: true,
    maxRequestSize: '10mb', // Giới hạn kích thước request
  },

  // ============================================
  // 🚨 SECURITY MONITORING (Biện pháp 9)
  // ============================================
  monitoring: {
    enabled: true,
    realTimeAlerts: true,
    emailAlerts: process.env.ALERT_EMAIL_ENABLED === 'true',
    alertRecipients: [process.env.ALERT_EMAIL_TO || 'admin@shoestore.com'],
    thresholds: {
      failedLogins: 5, // Cảnh báo khi có 5 lần đăng nhập thất bại
      unusualTraffic: 1000, // Cảnh báo khi có hơn 1000 requests trong 1 phút
      suspiciousIPs: true,
    },
  },

  // ============================================
  // 🌐 HTTPS & SSL/TLS (Biện pháp 3)
  // ============================================
  https: {
    required: process.env.NODE_ENV === 'production',
    redirectToHttps: true,
    certificatePath: process.env.SSL_CERT_PATH,
    keyPath: process.env.SSL_KEY_PATH,
  },

  // ============================================
  // 🔑 USER ROLES & PERMISSIONS (Biện pháp 7)
  // ============================================
  rbac: {
    roles: {
      admin: {
        permissions: ['*'], // Toàn quyền
        requireMFA: true,
      },
      editor: {
        permissions: ['read', 'write', 'update'],
        requireMFA: false,
      },
      user: {
        permissions: ['read'],
        requireMFA: false,
      },
    },
    auditPermissionChanges: true,
    reviewInterval: 90, // Rà soát quyền hạn mỗi 90 ngày
  },

  // ============================================
  // 🚫 SECURITY HEADERS
  // ============================================
  securityHeaders: {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  },
};
