'use strict';

/**
 * 📝 AUDIT LOGGER
 * Ghi log chi tiết các hoạt động quan trọng trong hệ thống
 * 
 * Biện pháp 7: Quản lý và Phân quyền Người dùng
 * Biện pháp 9: Giám sát & Cải tiến Liên tục
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const securityConfig = require('../config/security.config');

// Tạo thư mục logs nếu chưa có
const logsDir = path.join(__dirname, '../logs');

// Custom format cho audit logs
const auditFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      msg += ` | ${JSON.stringify(metadata)}`;
    }
    
    return msg;
  })
);

// Transport cho audit logs - lưu riêng các hoạt động quan trọng
const auditTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'audit-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: `${securityConfig.audit.retentionDays}d`,
  format: auditFormat,
  level: 'info',
});

// Transport cho security events
const securityTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'security-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '90d',
  format: auditFormat,
  level: 'warn',
});

// Audit logger instance
const auditLogger = winston.createLogger({
  format: auditFormat,
  transports: [
    auditTransport,
    securityTransport,
    // Console output trong development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
    }),
  ],
});

/**
 * Các loại audit event
 */
const AuditEventTypes = {
  // Authentication
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  
  // MFA
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',
  MFA_VERIFICATION_SUCCESS: 'MFA_VERIFICATION_SUCCESS',
  MFA_VERIFICATION_FAILED: 'MFA_VERIFICATION_FAILED',
  
  // Session Management
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_DESTROYED: 'SESSION_DESTROYED',
  SESSION_LIMIT_REACHED: 'SESSION_LIMIT_REACHED',
  
  // User Management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  
  // Permissions
  PERMISSION_GRANTED: 'PERMISSION_GRANTED',
  PERMISSION_REVOKED: 'PERMISSION_REVOKED',
  UNAUTHORIZED_ACCESS_ATTEMPT: 'UNAUTHORIZED_ACCESS_ATTEMPT',
  
  // Data Operations
  SENSITIVE_DATA_ACCESSED: 'SENSITIVE_DATA_ACCESSED',
  DATA_EXPORTED: 'DATA_EXPORTED',
  DATA_DELETED: 'DATA_DELETED',
  BULK_OPERATION: 'BULK_OPERATION',
  
  // Security Events
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  BRUTE_FORCE_ATTEMPT: 'BRUTE_FORCE_ATTEMPT',
  SQL_INJECTION_ATTEMPT: 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT: 'XSS_ATTEMPT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  IP_BLOCKED: 'IP_BLOCKED',
  
  // System
  BACKUP_STARTED: 'BACKUP_STARTED',
  BACKUP_COMPLETED: 'BACKUP_COMPLETED',
  BACKUP_FAILED: 'BACKUP_FAILED',
  SYSTEM_CONFIG_CHANGED: 'SYSTEM_CONFIG_CHANGED',
};

/**
 * Log audit event
 */
const log = (eventData) => {
  const {
    action,
    userId,
    username,
    ip,
    userAgent,
    resource,
    details,
    status = 'success',
    severity = 'info',
  } = eventData;
  
  const auditEntry = {
    action,
    userId: userId || 'anonymous',
    username: username || 'N/A',
    ip: ip || 'unknown',
    userAgent: userAgent || 'unknown',
    resource: resource || 'N/A',
    details: details || '',
    status,
    severity,
    timestamp: new Date().toISOString(),
  };
  
  // Chọn level dựa trên severity
  const logLevel = severity === 'critical' || severity === 'error' ? 'error' 
                  : severity === 'warning' ? 'warn' 
                  : 'info';
  
  auditLogger.log(logLevel, `Audit: ${action}`, auditEntry);
  
  // Gửi alert cho các sự kiện nghiêm trọng
  if (securityConfig.monitoring.realTimeAlerts && 
      (severity === 'critical' || severity === 'error')) {
    sendSecurityAlert(auditEntry);
  }
};

/**
 * Log login attempt
 */
const logLogin = (userId, username, ip, userAgent, success, reason = '') => {
  log({
    action: success ? AuditEventTypes.LOGIN_SUCCESS : AuditEventTypes.LOGIN_FAILED,
    userId,
    username,
    ip,
    userAgent,
    details: success ? 'User logged in successfully' : `Login failed: ${reason}`,
    status: success ? 'success' : 'failed',
    severity: success ? 'info' : 'warning',
  });
};

/**
 * Log unauthorized access
 */
const logUnauthorizedAccess = (userId, username, ip, resource, action) => {
  log({
    action: AuditEventTypes.UNAUTHORIZED_ACCESS_ATTEMPT,
    userId,
    username,
    ip,
    resource,
    details: `Attempted to ${action} without permission`,
    status: 'blocked',
    severity: 'warning',
  });
};

/**
 * Log permission change
 */
const logPermissionChange = (adminId, targetUserId, changes, ip) => {
  if (securityConfig.audit.logPermissionChanges) {
    log({
      action: AuditEventTypes.PERMISSION_GRANTED,
      userId: adminId,
      ip,
      resource: `User ${targetUserId}`,
      details: `Permission changes: ${JSON.stringify(changes)}`,
      severity: 'warning',
    });
  }
};

/**
 * Log sensitive data access
 */
const logSensitiveDataAccess = (userId, username, ip, dataType, recordId) => {
  if (securityConfig.audit.logSensitiveOperations) {
    log({
      action: AuditEventTypes.SENSITIVE_DATA_ACCESSED,
      userId,
      username,
      ip,
      resource: `${dataType}:${recordId}`,
      details: `Accessed sensitive ${dataType}`,
      severity: 'info',
    });
  }
};

/**
 * Log data export
 */
const logDataExport = (userId, username, ip, exportType, recordCount) => {
  if (securityConfig.audit.logDataExports) {
    log({
      action: AuditEventTypes.DATA_EXPORTED,
      userId,
      username,
      ip,
      resource: exportType,
      details: `Exported ${recordCount} records of ${exportType}`,
      severity: 'warning',
    });
  }
};

/**
 * Log security event
 */
const logSecurityEvent = (eventType, ip, details, severity = 'warning') => {
  log({
    action: eventType,
    ip,
    details,
    severity,
    status: 'detected',
  });
};

/**
 * Log backup operation
 */
const logBackup = (status, details) => {
  const action = status === 'started' ? AuditEventTypes.BACKUP_STARTED
                : status === 'completed' ? AuditEventTypes.BACKUP_COMPLETED
                : AuditEventTypes.BACKUP_FAILED;
  
  log({
    action,
    details,
    severity: status === 'failed' ? 'error' : 'info',
    status,
  });
};

/**
 * Gửi alert về sự kiện bảo mật nghiêm trọng
 */
const sendSecurityAlert = (auditEntry) => {
  try {
    // TODO: Tích hợp với email/SMS/webhook để gửi alert
    // Ở đây có thể sử dụng nodemailer, twilio, hoặc webhook
    
    if (securityConfig.monitoring.emailAlerts) {
      // Gửi email alert (cần implement nodemailer)
      console.error('🚨 SECURITY ALERT:', auditEntry);
    }
    
    // Log alert
    auditLogger.error('SECURITY ALERT', auditEntry);
  } catch (error) {
    auditLogger.error('Failed to send security alert:', error);
  }
};

/**
 * Query audit logs
 */
const queryLogs = async (filters) => {
  // TODO: Implement log query functionality
  // Có thể sử dụng file system hoặc database để query logs
  // Filters: { userId, action, startDate, endDate, severity }
  
  return {
    success: false,
    message: 'Log query feature is under development',
  };
};

/**
 * Generate audit report
 */
const generateAuditReport = async (startDate, endDate) => {
  // TODO: Implement audit report generation
  // Tạo báo cáo tổng hợp các hoạt động trong khoảng thời gian
  
  return {
    success: false,
    message: 'Audit report feature is under development',
  };
};

module.exports = {
  log,
  logLogin,
  logUnauthorizedAccess,
  logPermissionChange,
  logSensitiveDataAccess,
  logDataExport,
  logSecurityEvent,
  logBackup,
  queryLogs,
  generateAuditReport,
  AuditEventTypes,
};
