/**
 * 🚨 ALERT SYSTEM (Cloudflare-style)
 * 
 * Gửi cảnh báo khi:
 * - Phát hiện bot attack
 * - IP bị block
 * - Rate limit vượt ngưỡng
 * 
 * Hỗ trợ:
 * - Email (Nodemailer)
 * - Desktop Notification (node-notifier)
 * - Webhook (Slack/Discord) - optional
 */

const nodemailer = require('nodemailer');
const notifier = require('node-notifier');
const logger = require('./logger');
const path = require('path');

// Base URLs for production
const BACKEND_URL = process.env.BASE_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Cấu hình
const CONFIG = {
  // Ngưỡng kích hoạt alert
  ALERT_THRESHOLD: {
    ATTACKS_PER_MINUTE: 10,    // 10 bot attacks/phút → alert
    BLOCKED_IPS: 5,            // 5 IPs bị chặn → alert
    RATE_LIMIT_HITS: 50        // 50 requests vượt rate limit → alert
  },
  
  // Cooldown để tránh spam alerts
  ALERT_COOLDOWN: 5 * 60 * 1000, // 5 phút
  
  // Email config (sử dụng .env)
  EMAIL_ENABLED: process.env.ALERT_EMAIL_ENABLED === 'true',
  EMAIL_FROM: process.env.GMAIL_USER,
  EMAIL_TO: process.env.ALERT_EMAIL_TO || process.env.GMAIL_USER,
  
  // Desktop notification
  DESKTOP_NOTIFICATION: true
};

// Transporter email - Kích hoạt với error handling
let emailTransporter = null;
if (CONFIG.EMAIL_ENABLED && process.env.GMAIL_USER && process.env.GMAIL_PASS) {
  try {
    emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
      }
    });
    // Verify connection
    emailTransporter.verify((error, success) => {
      if (error) {
        console.error('⚠️ AlertSystem Email transporter verification failed:', error.message);
        emailTransporter = null;
      } else {
        console.log('✅ AlertSystem Email transporter ready');
      }
    });
  } catch (error) {
    console.error('⚠️ AlertSystem Email transporter creation failed:', error.message);
    emailTransporter = null;
  }
}

// Tracking alerts (tránh spam)
const alertHistory = new Map();

/**
 * Kiểm tra xem có nên gửi alert không (cooldown)
 */
function shouldSendAlert(alertType) {
  const lastAlert = alertHistory.get(alertType);
  if (!lastAlert) return true;
  
  const timeSince = Date.now() - lastAlert;
  return timeSince > CONFIG.ALERT_COOLDOWN;
}

/**
 * Đánh dấu đã gửi alert
 */
function markAlertSent(alertType) {
  alertHistory.set(alertType, Date.now());
}

/**
 * Gửi Desktop Notification
 */
function sendDesktopNotification(title, message, severity = 'normal') {
  if (!CONFIG.DESKTOP_NOTIFICATION) return;
  
  try {
    notifier.notify({
      title: `🛡️ ${title}`,
      message: message,
      icon: path.join(__dirname, '../assets/alert-icon.png'), // optional
      sound: severity === 'critical' ? 'Funk' : 'Ping',
      timeout: 10,
      urgency: severity
    });
  } catch (error) {
    logger.error('Failed to send desktop notification:', error);
  }
}

/**
 * Gửi Email Alert
 */
async function sendEmailAlert(subject, htmlContent) {
  if (!CONFIG.EMAIL_ENABLED || !emailTransporter) {
    logger.debug('Email alerts disabled or not configured');
    return;
  }
  
  try {
    const mailOptions = {
      from: `"Security Alert 🛡️" <${CONFIG.EMAIL_FROM}>`,
      to: CONFIG.EMAIL_TO,
      subject: `[SECURITY ALERT] ${subject}`,
      html: htmlContent
    };
    
    await emailTransporter.sendMail(mailOptions);
    logger.info(`Email alert sent: ${subject}`);
  } catch (error) {
    logger.error('Failed to send email alert:', error);
  }
}

/**
 * Alert: Bot Attack Detected
 */
async function alertBotAttack(attackData) {
  const alertType = 'BOT_ATTACK';
  
  if (!shouldSendAlert(alertType)) {
    logger.debug('Bot attack alert in cooldown, skipping...');
    return;
  }
  
  const { ip, reason, attackCount, blockedCount } = attackData;
  
  // Desktop notification
  sendDesktopNotification(
    'Bot Attack Detected!',
    `IP ${ip} đã bị chặn. Tổng ${blockedCount} IPs bị chặn.`,
    'critical'
  );
  
  // Email alert
  const emailHtml = `
    <h2 style="color: #f44336;">🚨 Bot Attack Detected!</h2>
    <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
    <p><strong>IP:</strong> ${ip}</p>
    <p><strong>Lý do:</strong> ${reason}</p>
    <p><strong>Số lần tấn công:</strong> ${attackCount}</p>
    <p><strong>Tổng IPs bị chặn:</strong> ${blockedCount}</p>
    <hr>
    <p style="color: #666;">Hệ thống đã tự động chặn IP này. Kiểm tra logs để biết thêm chi tiết.</p>
    <p><a href="${FRONTEND_URL}/admin/security">Xem Dashboard</a></p>
  `;
  
  await sendEmailAlert('Bot Attack Detected', emailHtml);
  
  markAlertSent(alertType);
  logger.info(`Alert sent for bot attack from IP: ${ip}`);
}

/**
 * Alert: Nhiều IPs bị chặn (Coordinated Attack)
 */
async function alertMassiveAttack(data) {
  const alertType = 'MASSIVE_ATTACK';
  
  if (!shouldSendAlert(alertType)) return;
  
  const { blockedIPs, attacksPerMinute } = data;
  
  sendDesktopNotification(
    'MASSIVE ATTACK DETECTED!',
    `${blockedIPs.length} IPs bị chặn! ${attacksPerMinute} attacks/phút`,
    'critical'
  );
  
  const emailHtml = `
    <h2 style="color: #d32f2f;">🚨🚨 MASSIVE BOT ATTACK 🚨🚨</h2>
    <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
    <p><strong>Số IPs bị chặn:</strong> ${blockedIPs.length}</p>
    <p><strong>Tốc độ tấn công:</strong> ${attacksPerMinute} attacks/phút</p>
    <hr>
    <h3>Danh sách IPs:</h3>
    <ul>
      ${blockedIPs.slice(0, 20).map(ip => `<li>${ip}</li>`).join('')}
      ${blockedIPs.length > 20 ? `<li>... và ${blockedIPs.length - 20} IPs khác</li>` : ''}
    </ul>
    <hr>
    <p style="color: #d32f2f; font-weight: bold;">
      ⚠️ Hệ thống có thể đang bị tấn công DDoS phối hợp!
    </p>
    <p><a href="${FRONTEND_URL}/admin/security">Xem Dashboard ngay</a></p>
  `;
  
  await sendEmailAlert('MASSIVE ATTACK - Immediate Action Required!', emailHtml);
  
  markAlertSent(alertType);
  logger.securityEvent('MASSIVE_ATTACK_ALERT_SENT', data);
}

/**
 * Alert: Rate Limit vượt ngưỡng
 */
async function alertRateLimitExceeded(data) {
  const alertType = 'RATE_LIMIT';
  
  if (!shouldSendAlert(alertType)) return;
  
  const { endpoint, hitCount } = data;
  
  sendDesktopNotification(
    'Rate Limit Exceeded',
    `Endpoint ${endpoint}: ${hitCount} requests vượt giới hạn`,
    'normal'
  );
  
  logger.securityEvent('RATE_LIMIT_ALERT', data);
}

/**
 * Kiểm tra định kỳ và gửi alert nếu cần
 */
function startAlertMonitoring(botDetectionMiddleware) {
  const MONITOR_INTERVAL = 60 * 1000; // Mỗi phút
  
  setInterval(() => {
    const stats = logger.getStats();
    
    // Kiểm tra massive attack
    if (stats.blockedIPs.length >= CONFIG.ALERT_THRESHOLD.BLOCKED_IPS) {
      alertMassiveAttack({
        blockedIPs: stats.blockedIPs,
        attacksPerMinute: stats.botAttacks
      });
    }
  }, MONITOR_INTERVAL);
  
  logger.info('Alert monitoring system started');
}

module.exports = {
  alertBotAttack,
  alertMassiveAttack,
  alertRateLimitExceeded,
  startAlertMonitoring,
  CONFIG
};
