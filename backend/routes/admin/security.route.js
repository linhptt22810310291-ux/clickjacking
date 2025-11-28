/**
 * 🛡️ CLOUDFLARE-STYLE SECURITY DASHBOARD
 * Admin-only route for viewing bot attack logs, blocked IPs, and security statistics
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');

// 🆕 Import từ security.middleware để lấy rate limit stats
const { getRateLimitStats, resetStats: resetRateLimitStats } = require('../../middleware/security.middleware');

// 🆕 Import từ firewall.middleware để lấy firewall stats
const { getFirewallStats, unblockIP, getBlockedIPs } = require('../../middleware/firewall.middleware');

// Middleware: Kiểm tra admin (giả định bạn đã có middleware này)
const checkAdmin = require('../../middleware/checkAdmin');
const authenticateToken = require('../../middleware/auth.middleware');

/**
 * 🆘 EMERGENCY UNBLOCK - Route công khai để unblock IP khi bị khóa
 * POST /api/security/emergency-unblock
 * Yêu cầu secret key để bảo vệ
 */
router.post('/emergency-unblock', async (req, res) => {
  try {
    const { secretKey, ip } = req.body;
    
    // Secret key để bảo vệ - đặt trong ENV hoặc hardcode tạm
    const EMERGENCY_SECRET = process.env.EMERGENCY_UNBLOCK_SECRET || 'LilyShoes2024Emergency!';
    
    if (secretKey !== EMERGENCY_SECRET) {
      return res.status(403).json({
        success: false,
        error: 'Invalid secret key'
      });
    }
    
    // Nếu không truyền IP, lấy IP của người gọi
    const targetIP = ip || req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim();
    
    // Unblock IP
    unblockIP(targetIP);
    
    // Reset rate limit stats
    if (typeof resetRateLimitStats === 'function') {
      resetRateLimitStats();
    }
    
    logger.securityEvent('Emergency IP unblock', {
      unblockedIP: targetIP,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: `IP ${targetIP} has been unblocked`,
      unblockedIP: targetIP
    });
  } catch (error) {
    logger.error('Emergency unblock failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unblock IP'
    });
  }
});

/**
 * GET /api/security/my-ip
 * Xem IP hiện tại của bạn (để biết IP nào đang bị block)
 */
router.get('/my-ip', (req, res) => {
  const clientIP = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  const blockedIPs = getBlockedIPs ? getBlockedIPs() : [];
  const isBlocked = blockedIPs.includes(clientIP);
  
  res.json({
    success: true,
    data: {
      yourIP: clientIP,
      isBlocked,
      blockedIPs: blockedIPs,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * GET /api/security/stats
 * Lấy thống kê tổng quan về bot attacks (PUBLIC - không cần đăng nhập)
 * 🆕 Kết hợp stats từ CẢ security.middleware VÀ firewall.middleware
 */
router.get('/stats', async (req, res) => {
  try {
    // Lấy stats từ security.middleware (API rate limit)
    const rateLimitStats = getRateLimitStats();
    
    // 🆕 Lấy stats từ firewall.middleware (IP rate limit)
    const firewallStats = getFirewallStats();
    
    // Kết hợp cả 2 nguồn stats
    const combinedBlockedIPs = new Set([
      ...(rateLimitStats.blockedIPs || []),
      ...(firewallStats.blockedIPs || [])
    ]);
    
    const combinedLogs = [
      ...(rateLimitStats.recentLogs || []),
      ...(firewallStats.recentLogs || [])
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100);
    
    res.json({
      success: true,
      data: {
        totalBotAttacks: (rateLimitStats.totalBlocked || 0) + (firewallStats.totalBlocked || 0),
        blockedIPs: Array.from(combinedBlockedIPs),
        blockedCount: combinedBlockedIPs.size,
        recentLogs: combinedLogs,
        // Chi tiết từng nguồn (để debug)
        sources: {
          apiRateLimit: rateLimitStats.totalBlocked || 0,
          ipFirewall: firewallStats.totalBlocked || 0
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to get security stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security statistics'
    });
  }
});

/**
 * GET /api/admin/security/logs
 * Lấy danh sách log files
 */
router.get('/logs', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const logsDir = path.join(__dirname, '../../logs');
    
    // Kiểm tra thư mục logs có tồn tại không
    try {
      await fs.access(logsDir);
    } catch {
      return res.json({
        success: true,
        data: {
          files: [],
          message: 'Logs directory not created yet. Start backend to generate logs.'
        }
      });
    }
    
    const files = await fs.readdir(logsDir);
    const botAttackLogs = files.filter(f => f.startsWith('bot-attacks-'));
    
    const logFiles = await Promise.all(
      botAttackLogs.map(async (filename) => {
        const filepath = path.join(logsDir, filename);
        const stats = await fs.stat(filepath);
        return {
          filename,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        files: logFiles.sort((a, b) => b.modified - a.modified),
        totalFiles: logFiles.length
      }
    });
  } catch (error) {
    logger.error('Failed to list log files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list log files'
    });
  }
});

/**
 * GET /api/admin/security/logs/:filename
 * Xem nội dung của một log file cụ thể
 */
router.get('/logs/:filename', authenticateToken, checkAdmin, async (req, res) => {
  try {
    const { filename } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    
    // Security: Chỉ cho phép đọc bot-attacks-*.log
    if (!filename.startsWith('bot-attacks-') || !filename.endsWith('.log')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this log file'
      });
    }
    
    const filepath = path.join(__dirname, '../../logs', filename);
    const content = await fs.readFile(filepath, 'utf8');
    
    // Parse JSON logs (mỗi dòng là một JSON object)
    const lines = content.trim().split('\n').filter(line => line);
    const logs = lines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(log => log !== null);
    
    // Phân trang
    const total = logs.length;
    const paginatedLogs = logs.slice(offset, offset + limit);
    
    res.json({
      success: true,
      data: {
        logs: paginatedLogs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        error: 'Log file not found'
      });
    }
    logger.error('Failed to read log file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read log file'
    });
  }
});

/**
 * GET /api/security/recent-attacks
 * Lấy danh sách các cuộc tấn công gần đây (PUBLIC - không cần đăng nhập)
 * 🆕 Kết hợp logs từ CẢ security.middleware VÀ firewall.middleware
 */
router.get('/recent-attacks', async (req, res) => {
  try {
    // Lấy real-time logs từ cả 2 nguồn
    const rateLimitStats = getRateLimitStats();
    const firewallStats = getFirewallStats();
    
    // Kết hợp logs từ cả 2 middleware
    const allLogs = [
      ...(rateLimitStats.recentLogs || []),
      ...(firewallStats.recentLogs || [])
    ];
    
    // Sort theo thời gian (mới nhất lên đầu)
    const sortedLogs = allLogs.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    ).slice(0, 100); // Giới hạn 100 logs
    
    // Format logs cho frontend
    const attacks = sortedLogs.map(log => ({
      timestamp: log.timestamp,
      ip: log.ip,
      reason: log.type === 'RATE_LIMIT' ? 'API Rate limit exceeded' : 
              log.type === 'IP_RATE_LIMIT' ? 'IP Rate limit exceeded' : 
              'Bot behavior detected',
      endpoint: log.path || '/api/unknown',
      action: 'BLOCKED',
      requestCount: log.requestCount || null
    }));
    
    res.json({
      success: true,
      data: {
        attacks: attacks,
        count: attacks.length
      }
    });
  } catch (error) {
    logger.error('Failed to get recent attacks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent attacks'
    });
  }
});

/**
 * POST /api/admin/security/clear-blacklist
 * Xóa toàn bộ blacklist (unblock tất cả IPs)
 */
router.post('/clear-blacklist', authenticateToken, checkAdmin, async (req, res) => {
  try {
    // Gọi hàm reset stats từ logger
    logger.resetStats();
    
    logger.securityEvent('Admin cleared IP blacklist', {
      admin: req.user.email || req.user.username,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Blacklist cleared successfully'
    });
  } catch (error) {
    logger.error('Failed to clear blacklist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear blacklist'
    });
  }
});

module.exports = router;
