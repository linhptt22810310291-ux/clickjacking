/**
 * API endpoint để frontend theo dõi bot attacks real-time
 */
const express = require('express');
const router = express.Router();
const { getBotStats } = require('../middleware/botDetection');

/**
 * GET /api/bot-stats
 * Trả về thống kê bot attacks real-time
 */
router.get('/', (req, res) => {
  try {
    const stats = getBotStats();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: stats
    });
  } catch (error) {
    console.error('Error getting bot stats:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể lấy thống kê bot'
    });
  }
});

module.exports = router;
