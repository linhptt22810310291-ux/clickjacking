'use strict';

const crypto = require('crypto');

/**
 * 🛡️ CSRF PROTECTION MIDDLEWARE
 * Bảo vệ khỏi Cross-Site Request Forgery attacks
 */

// Store CSRF tokens (in production, use Redis)
const csrfTokens = new Map();

// Token expiry time (15 minutes)
const TOKEN_EXPIRY = 15 * 60 * 1000;

/**
 * Generate CSRF token
 */
const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Middleware: Generate và gửi CSRF token
 */
const csrfProtection = (req, res, next) => {
  // Generate token nếu chưa có
  if (!req.session.csrfToken) {
    const token = generateCsrfToken();
    req.session.csrfToken = token;
    req.session.csrfExpiry = Date.now() + TOKEN_EXPIRY;

    // Store in memory map
    csrfTokens.set(token, {
      expiry: Date.now() + TOKEN_EXPIRY,
      used: false,
    });

    console.log('🔐 Generated CSRF token:', token);
  }

  // Attach token to response locals
  res.locals.csrfToken = req.session.csrfToken;
  
  // Add helper function
  res.csrfToken = () => req.session.csrfToken;

  next();
};

/**
 * Middleware: Verify CSRF token
 */
const verifyCsrfToken = (req, res, next) => {
  try {
    // Skip verification for GET, HEAD, OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const token = req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;
    const sessionToken = req.session.csrfToken;

    console.log('🔍 Verifying CSRF token:', {
      provided: token ? token.substring(0, 10) + '...' : 'none',
      expected: sessionToken ? sessionToken.substring(0, 10) + '...' : 'none',
    });

    if (!token) {
      console.warn('⚠️ Missing CSRF token');
      return res.status(403).json({
        success: false,
        message: 'CSRF token missing',
      });
    }

    if (!sessionToken) {
      console.warn('⚠️ No CSRF token in session');
      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token',
      });
    }

    if (token !== sessionToken) {
      console.warn('⚠️ CSRF token mismatch');
      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token',
      });
    }

    // Check expiry
    const tokenData = csrfTokens.get(token);
    if (tokenData && Date.now() > tokenData.expiry) {
      console.warn('⚠️ CSRF token expired');
      csrfTokens.delete(token);
      delete req.session.csrfToken;
      
      return res.status(403).json({
        success: false,
        message: 'CSRF token expired',
      });
    }

    // Check if token already used (for one-time use endpoints)
    if (tokenData && tokenData.used) {
      console.warn('⚠️ CSRF token already used');
      return res.status(403).json({
        success: false,
        message: 'CSRF token already used',
      });
    }

    console.log('✅ CSRF token verified');
    next();
  } catch (error) {
    console.error('❌ Error verifying CSRF token:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying CSRF token',
    });
  }
};

/**
 * Endpoint: Get CSRF token
 */
const getCsrfToken = (req, res) => {
  try {
    let token = req.session.csrfToken;

    // Generate new token if not exists or expired
    if (!token || Date.now() > req.session.csrfExpiry) {
      token = generateCsrfToken();
      req.session.csrfToken = token;
      req.session.csrfExpiry = Date.now() + TOKEN_EXPIRY;

      csrfTokens.set(token, {
        expiry: Date.now() + TOKEN_EXPIRY,
        used: false,
      });
    }

    res.status(200).json({
      success: true,
      csrfToken: token,
    });
  } catch (error) {
    console.error('❌ Error getting CSRF token:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting CSRF token',
    });
  }
};

/**
 * Cleanup expired tokens (run periodically)
 */
const cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now > data.expiry) {
      csrfTokens.delete(token);
    }
  }
  console.log(`🧹 Cleaned up expired CSRF tokens. Remaining: ${csrfTokens.size}`);
};

// Cleanup every 10 minutes
setInterval(cleanupExpiredTokens, 10 * 60 * 1000);

module.exports = {
  csrfProtection,
  verifyCsrfToken,
  getCsrfToken,
  generateCsrfToken,
};
