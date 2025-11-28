'use strict';

/**
 * 🔐 SESSION MANAGEMENT MIDDLEWARE
 * Quản lý phiên đăng nhập của người dùng
 * 
 * Biện pháp 4: Bảo vệ Tài khoản Quản trị
 * Biện pháp 7: Quản lý và Phân quyền Người dùng
 */

const jwt = require('jsonwebtoken');
const securityConfig = require('../config/security.config');
const logger = require('../utils/logger');
const auditLogger = require('../utils/auditLogger');

// Lưu trữ các phiên hoạt động của user (trong production nên dùng Redis)
const activeSessions = new Map();

/**
 * Tạo session ID unique
 */
const generateSessionId = () => {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

/**
 * Middleware quản lý session
 */
const sessionManager = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const sessionId = req.headers['x-session-id'] || generateSessionId();
    
    // Kiểm tra số lượng session active
    if (!activeSessions.has(userId)) {
      activeSessions.set(userId, new Map());
    }
    
    const userSessions = activeSessions.get(userId);
    
    // Giới hạn số session đồng thời
    if (userSessions.size >= securityConfig.session.maxActiveSessions && !userSessions.has(sessionId)) {
      // Xóa session cũ nhất
      const oldestSession = Array.from(userSessions.entries())[0];
      userSessions.delete(oldestSession[0]);
      logger.warn(`Session limit reached for user ${userId}, removed oldest session`);
      auditLogger.log({
        action: 'SESSION_LIMIT_REACHED',
        userId,
        ip: req.ip,
        details: 'Oldest session removed due to max session limit',
      });
    }
    
    // Cập nhật hoặc tạo session mới
    const now = Date.now();
    const sessionData = userSessions.get(sessionId) || {
      createdAt: now,
      userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    };
    
    sessionData.lastActivity = now;
    userSessions.set(sessionId, sessionData);
    
    // Kiểm tra inactivity timeout
    if (now - sessionData.lastActivity > securityConfig.session.inactivityTimeout) {
      userSessions.delete(sessionId);
      logger.info(`Session ${sessionId} expired due to inactivity`);
      return res.status(401).json({
        success: false,
        message: 'Phiên làm việc đã hết hạn do không hoạt động. Vui lòng đăng nhập lại.',
      });
    }
    
    // Attach session info to request (renamed to avoid conflict with express-session)
    req.userSession = {
      id: sessionId,
      userId,
      createdAt: sessionData.createdAt,
      lastActivity: sessionData.lastActivity,
    };
    
    res.setHeader('X-Session-ID', sessionId);
    next();
    
  } catch (error) {
    logger.error(`Session validation error: ${error.message}`);
    next();
  }
};

/**
 * Xóa session khi logout
 */
const destroySession = (req, res, next) => {
  const sessionId = req.headers['x-session-id'];
  const userId = req.user?.id || req.auth?.id;
  
  if (userId && sessionId && activeSessions.has(userId)) {
    const userSessions = activeSessions.get(userId);
    userSessions.delete(sessionId);
    
    if (userSessions.size === 0) {
      activeSessions.delete(userId);
    }
    
    logger.info(`Session ${sessionId} destroyed for user ${userId}`);
    auditLogger.log({
      action: 'LOGOUT',
      userId,
      ip: req.ip,
      details: `Session ${sessionId} destroyed`,
    });
  }
  
  next();
};

/**
 * Xóa tất cả session của một user
 */
const destroyAllUserSessions = (userId) => {
  if (activeSessions.has(userId)) {
    const sessionCount = activeSessions.get(userId).size;
    activeSessions.delete(userId);
    logger.info(`All ${sessionCount} sessions destroyed for user ${userId}`);
    auditLogger.log({
      action: 'ALL_SESSIONS_DESTROYED',
      userId,
      details: `${sessionCount} sessions removed`,
    });
  }
};

/**
 * Middleware yêu cầu xác thực lại cho thao tác nhạy cảm
 */
const requireReauth = (req, res, next) => {
  if (!securityConfig.session.requireReauthForSensitiveOps) {
    return next();
  }
  
  const reauthToken = req.headers['x-reauth-token'];
  const userId = req.user?.id || req.auth?.id;
  
  if (!reauthToken) {
    return res.status(403).json({
      success: false,
      message: 'Thao tác này yêu cầu xác thực lại. Vui lòng nhập mật khẩu.',
      requireReauth: true,
    });
  }
  
  try {
    const decoded = jwt.verify(reauthToken, process.env.JWT_SECRET);
    
    // Token reauth chỉ có hiệu lực trong 5 phút
    if (Date.now() - decoded.iat * 1000 > 5 * 60 * 1000) {
      return res.status(403).json({
        success: false,
        message: 'Token xác thực đã hết hạn. Vui lòng nhập lại mật khẩu.',
        requireReauth: true,
      });
    }
    
    if (decoded.id !== userId) {
      throw new Error('Invalid reauth token');
    }
    
    auditLogger.log({
      action: 'SENSITIVE_OPERATION_AUTHORIZED',
      userId,
      ip: req.ip,
      path: req.path,
    });
    
    next();
    
  } catch (error) {
    logger.error(`Reauth token validation failed: ${error.message}`);
    return res.status(403).json({
      success: false,
      message: 'Token xác thực không hợp lệ.',
      requireReauth: true,
    });
  }
};

/**
 * Lấy danh sách session active của user
 */
const getUserSessions = (userId) => {
  if (!activeSessions.has(userId)) {
    return [];
  }
  
  const sessions = [];
  for (const [sessionId, sessionData] of activeSessions.get(userId).entries()) {
    sessions.push({
      sessionId,
      ip: sessionData.ip,
      userAgent: sessionData.userAgent,
      createdAt: new Date(sessionData.createdAt).toISOString(),
      lastActivity: new Date(sessionData.lastActivity).toISOString(),
      isActive: Date.now() - sessionData.lastActivity < securityConfig.session.inactivityTimeout,
    });
  }
  
  return sessions;
};

// Dọn dẹp session hết hạn mỗi 10 phút
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [userId, userSessions] of activeSessions.entries()) {
    for (const [sessionId, sessionData] of userSessions.entries()) {
      if (now - sessionData.lastActivity > securityConfig.session.inactivityTimeout) {
        userSessions.delete(sessionId);
        cleanedCount++;
      }
    }
    
    if (userSessions.size === 0) {
      activeSessions.delete(userId);
    }
  }
  
  if (cleanedCount > 0) {
    logger.info(`Cleaned ${cleanedCount} expired sessions`);
  }
}, 10 * 60 * 1000);

module.exports = {
  sessionManager,
  destroySession,
  destroyAllUserSessions,
  requireReauth,
  getUserSessions,
  generateSessionId,
};
