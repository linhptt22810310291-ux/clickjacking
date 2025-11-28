'use strict';

/**
 * 🔐 MULTI-FACTOR AUTHENTICATION (MFA) MIDDLEWARE
 * Xác thực đa yếu tố bằng TOTP (Time-based One-Time Password)
 * 
 * Biện pháp 4: Bảo vệ Tài khoản Quản trị
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const securityConfig = require('../config/security.config');
const logger = require('../utils/logger');
const auditLogger = require('../utils/auditLogger');
const db = require('../models');

/**
 * Tạo secret key cho MFA
 */
const generateMFASecret = async (userId, email) => {
  const secret = speakeasy.generateSecret({
    name: `ShoeStore (${email})`,
    issuer: 'ShoeStore',
    length: 32,
  });
  
  // Lưu secret vào database (cần thêm cột MFASecret và MFAEnabled trong User table)
  try {
    await db.User.update(
      { 
        MFASecret: secret.base32,
        MFAEnabled: false, // Chưa kích hoạt, đợi verify
      },
      { where: { UserID: userId } }
    );
    
    logger.info(`MFA secret generated for user ${userId}`);
    auditLogger.log({
      action: 'MFA_SECRET_GENERATED',
      userId,
      details: 'MFA secret created but not yet activated',
    });
    
    return secret;
  } catch (error) {
    logger.error(`Failed to save MFA secret for user ${userId}: ${error.message}`);
    throw error;
  }
};

/**
 * Tạo QR code cho MFA
 */
const generateMFAQRCode = async (secret) => {
  try {
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    return qrCode;
  } catch (error) {
    logger.error(`Failed to generate QR code: ${error.message}`);
    throw error;
  }
};

/**
 * Xác thực MFA token
 */
const verifyMFAToken = async (userId, token) => {
  try {
    const user = await db.User.findByPk(userId, {
      attributes: ['MFASecret', 'MFAEnabled'],
    });
    
    if (!user || !user.MFASecret) {
      return { verified: false, message: 'MFA chưa được thiết lập' };
    }
    
    const verified = speakeasy.totp.verify({
      secret: user.MFASecret,
      encoding: 'base32',
      token: token,
      window: 2, // Cho phép sai lệch ±2 chu kỳ (60 giây)
    });
    
    if (verified) {
      logger.info(`MFA token verified successfully for user ${userId}`);
      auditLogger.log({
        action: 'MFA_VERIFICATION_SUCCESS',
        userId,
      });
    } else {
      logger.warn(`MFA token verification failed for user ${userId}`);
      auditLogger.log({
        action: 'MFA_VERIFICATION_FAILED',
        userId,
      });
    }
    
    return {
      verified,
      message: verified ? 'Xác thực thành công' : 'Mã xác thực không đúng',
    };
  } catch (error) {
    logger.error(`MFA verification error for user ${userId}: ${error.message}`);
    return { verified: false, message: 'Lỗi xác thực' };
  }
};

/**
 * Kích hoạt MFA cho user
 */
const enableMFA = async (userId, verificationToken) => {
  try {
    const result = await verifyMFAToken(userId, verificationToken);
    
    if (!result.verified) {
      return { success: false, message: 'Mã xác thực không đúng' };
    }
    
    await db.User.update(
      { MFAEnabled: true },
      { where: { UserID: userId } }
    );
    
    logger.info(`MFA enabled for user ${userId}`);
    auditLogger.log({
      action: 'MFA_ENABLED',
      userId,
      details: 'Two-factor authentication activated',
    });
    
    return { success: true, message: 'Xác thực 2 lớp đã được kích hoạt' };
  } catch (error) {
    logger.error(`Failed to enable MFA for user ${userId}: ${error.message}`);
    return { success: false, message: 'Lỗi khi kích hoạt MFA' };
  }
};

/**
 * Vô hiệu hóa MFA cho user
 */
const disableMFA = async (userId, password) => {
  try {
    // Xác thực mật khẩu trước khi tắt MFA
    const user = await db.User.findByPk(userId);
    const bcrypt = require('bcryptjs');
    const passwordMatch = await bcrypt.compare(password, user.Password);
    
    if (!passwordMatch) {
      return { success: false, message: 'Mật khẩu không đúng' };
    }
    
    await db.User.update(
      { 
        MFAEnabled: false,
        MFASecret: null,
      },
      { where: { UserID: userId } }
    );
    
    logger.warn(`MFA disabled for user ${userId}`);
    auditLogger.log({
      action: 'MFA_DISABLED',
      userId,
      details: 'Two-factor authentication deactivated',
    });
    
    return { success: true, message: 'Xác thực 2 lớp đã được tắt' };
  } catch (error) {
    logger.error(`Failed to disable MFA for user ${userId}: ${error.message}`);
    return { success: false, message: 'Lỗi khi tắt MFA' };
  }
};

/**
 * Middleware kiểm tra MFA bắt buộc
 */
const requireMFA = async (req, res, next) => {
  const userId = req.user?.id || req.auth?.id;
  const userRole = req.user?.role || req.auth?.role;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Chưa xác thực',
    });
  }
  
  try {
    const user = await db.User.findByPk(userId, {
      attributes: ['MFAEnabled', 'Role'],
    });
    
    // Kiểm tra xem MFA có bắt buộc cho role này không
    const mfaRequired = 
      (user.Role === 'admin' && securityConfig.mfa.required.admin) ||
      (user.Role === 'user' && securityConfig.mfa.required.user);
    
    if (!mfaRequired) {
      return next();
    }
    
    if (!user.MFAEnabled) {
      logger.warn(`MFA required but not enabled for user ${userId}`);
      return res.status(403).json({
        success: false,
        message: 'Tài khoản của bạn yêu cầu kích hoạt xác thực 2 lớp',
        requireMFASetup: true,
      });
    }
    
    // Kiểm tra MFA token trong header
    const mfaToken = req.headers['x-mfa-token'];
    
    if (!mfaToken) {
      return res.status(403).json({
        success: false,
        message: 'Vui lòng nhập mã xác thực 2 lớp',
        requireMFA: true,
      });
    }
    
    const result = await verifyMFAToken(userId, mfaToken);
    
    if (!result.verified) {
      return res.status(403).json({
        success: false,
        message: 'Mã xác thực 2 lớp không đúng',
        requireMFA: true,
      });
    }
    
    next();
    
  } catch (error) {
    logger.error(`MFA middleware error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Lỗi xác thực',
    });
  }
};

/**
 * Middleware kiểm tra MFA tùy chọn (optional)
 */
const checkMFA = async (req, res, next) => {
  const userId = req.user?.id || req.auth?.id;
  
  if (!userId) {
    return next();
  }
  
  try {
    const user = await db.User.findByPk(userId, {
      attributes: ['MFAEnabled'],
    });
    
    req.mfaEnabled = user?.MFAEnabled || false;
    next();
  } catch (error) {
    logger.error(`MFA check error: ${error.message}`);
    next();
  }
};

/**
 * Tạo backup codes cho MFA
 */
const generateBackupCodes = (count = 10) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
};

/**
 * Xác thực bằng backup code
 */
const verifyBackupCode = async (userId, code) => {
  try {
    // Cần thêm bảng MFABackupCodes trong database để lưu các backup codes
    // Ở đây chỉ là ví dụ cơ bản
    const bcrypt = require('bcryptjs');
    
    // TODO: Implement database lookup for backup codes
    logger.info(`Backup code verification attempted for user ${userId}`);
    auditLogger.log({
      action: 'BACKUP_CODE_VERIFICATION',
      userId,
    });
    
    return { verified: false, message: 'Tính năng backup code đang được phát triển' };
  } catch (error) {
    logger.error(`Backup code verification error: ${error.message}`);
    return { verified: false, message: 'Lỗi xác thực' };
  }
};

module.exports = {
  generateMFASecret,
  generateMFAQRCode,
  verifyMFAToken,
  enableMFA,
  disableMFA,
  requireMFA,
  checkMFA,
  generateBackupCodes,
  verifyBackupCode,
};
