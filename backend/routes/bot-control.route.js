const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');
const { clearBlacklist } = require('../middleware/botDetection'); // 🆕 Import clearBlacklist

// Lưu trữ các process đang chạy
const runningBots = new Map();

/**
 * @route POST /api/bot-control/clear-blacklist
 * @desc 🔥 Xóa tất cả IP khỏi blacklist (FIX lỗi 403)
 */
router.post('/clear-blacklist', (req, res) => {
  try {
    const result = clearBlacklist();
    logger.info('🧹 Blacklist cleared via API');
    
    res.json({
      success: true,
      message: `Đã xóa ${result.cleared} IP khỏi blacklist`,
      cleared: result.cleared
    });
  } catch (error) {
    logger.error('❌ Error clearing blacklist:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa blacklist',
      error: error.message
    });
  }
});

/**
 * @route POST /api/bot-control/dos-attack
 * @desc Chạy DoS attack với phương thức được chỉ định
 */
router.post('/dos-attack', async (req, res) => {
  try {
    const { method, variantId, quantity, numberOfRequests } = req.body;

    // Validate input
    if (!method || method < 1 || method > 4) {
      return res.status(400).json({
        success: false,
        message: 'Method phải từ 1-4 (Sequential/Parallel/Batch/SlowLoris)'
      });
    }

    // Tạo bot ID
    const botId = `dos-${Date.now()}`;
    
    // Đường dẫn đến script bot
    const scriptPath = path.join(__dirname, '../attacks/bot-dos-attack.js');
    
    // Spawn process với arguments
    const botProcess = spawn('node', [scriptPath, method.toString()], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        VARIANT_ID: variantId || '2',
        QUANTITY: quantity || '2',
        NUMBER_OF_REQUESTS: numberOfRequests || '100'
      }
    });

    // Lưu process info
    runningBots.set(botId, {
      process: botProcess,
      type: 'dos-attack',
      method,
      startTime: new Date(),
      status: 'running'
    });

    // Log output
    let output = '';
    botProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[Bot ${botId}] ${data.toString()}`);
    });

    botProcess.stderr.on('data', (data) => {
      console.error(`[Bot ${botId} ERROR] ${data.toString()}`);
    });

    // Xử lý khi bot kết thúc
    botProcess.on('close', (code) => {
      const botInfo = runningBots.get(botId);
      if (botInfo) {
        botInfo.status = code === 0 ? 'completed' : 'failed';
        botInfo.exitCode = code;
        botInfo.endTime = new Date();
        botInfo.output = output;
      }
      
      logger.info(`🤖 Bot DoS Attack ${botId} kết thúc với exit code ${code}`);
    });

    res.json({
      success: true,
      message: 'Bot DoS Attack đã được khởi động',
      botId,
      config: {
        method: ['Sequential', 'Parallel', 'Batch', 'Slow Loris'][method - 1],
        variantId,
        quantity,
        numberOfRequests
      }
    });

  } catch (error) {
    logger.error('Lỗi khi khởi động DoS bot:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route POST /api/bot-control/voucher-attack
 * @desc Chạy Voucher Hunter với phương thức được chỉ định
 */
router.post('/voucher-attack', async (req, res) => {
  try {
    const { method } = req.body;

    // Validate input
    if (!method || method < 1 || method > 3) {
      return res.status(400).json({
        success: false,
        message: 'Method phải từ 1-3 (Puppeteer/DirectAPI/Parallel)'
      });
    }

    // Tạo bot ID
    const botId = `voucher-${Date.now()}`;
    
    // Đường dẫn đến script bot
    const scriptPath = path.join(__dirname, '../attacks/bot-voucher-hunter-NEW.js');
    
    // Spawn process
    const botProcess = spawn('node', [scriptPath, method.toString()], {
      cwd: path.join(__dirname, '..')
    });

    // Lưu process info
    runningBots.set(botId, {
      process: botProcess,
      type: 'voucher-attack',
      method,
      startTime: new Date(),
      status: 'running'
    });

    // Log output
    let output = '';
    botProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[Bot ${botId}] ${data.toString()}`);
    });

    botProcess.stderr.on('data', (data) => {
      console.error(`[Bot ${botId} ERROR] ${data.toString()}`);
    });

    // Xử lý khi bot kết thúc
    botProcess.on('close', (code) => {
      const botInfo = runningBots.get(botId);
      if (botInfo) {
        botInfo.status = code === 0 ? 'completed' : 'failed';
        botInfo.exitCode = code;
        botInfo.endTime = new Date();
        botInfo.output = output;
      }
      
      logger.info(`🤖 Bot Voucher Hunter ${botId} kết thúc với exit code ${code}`);
    });

    res.json({
      success: true,
      message: 'Bot Voucher Hunter đã được khởi động',
      botId,
      config: {
        method: ['Puppeteer UI', 'Direct API', 'Parallel'][method - 1]
      }
    });

  } catch (error) {
    logger.error('Lỗi khi khởi động Voucher bot:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/bot-control/status/:botId
 * @desc Kiểm tra trạng thái bot
 */
router.get('/status/:botId', (req, res) => {
  const { botId } = req.params;
  const botInfo = runningBots.get(botId);

  if (!botInfo) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy bot với ID này'
    });
  }

  res.json({
    success: true,
    bot: {
      id: botId,
      type: botInfo.type,
      method: botInfo.method,
      status: botInfo.status,
      startTime: botInfo.startTime,
      endTime: botInfo.endTime,
      exitCode: botInfo.exitCode,
      output: botInfo.output
    }
  });
});

/**
 * @route GET /api/bot-control/list
 * @desc Liệt kê tất cả bots đang chạy và đã chạy
 */
router.get('/list', (req, res) => {
  const bots = [];
  
  runningBots.forEach((info, id) => {
    bots.push({
      id,
      type: info.type,
      method: info.method,
      status: info.status,
      startTime: info.startTime,
      endTime: info.endTime,
      exitCode: info.exitCode
    });
  });

  res.json({
    success: true,
    total: bots.length,
    bots
  });
});

/**
 * @route POST /api/bot-control/stop/:botId
 * @desc Dừng bot đang chạy
 */
router.post('/stop/:botId', (req, res) => {
  const { botId } = req.params;
  const botInfo = runningBots.get(botId);

  if (!botInfo) {
    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy bot với ID này'
    });
  }

  if (botInfo.status !== 'running') {
    return res.status(400).json({
      success: false,
      message: `Bot đã ${botInfo.status}, không thể dừng`
    });
  }

  try {
    botInfo.process.kill('SIGTERM');
    botInfo.status = 'stopped';
    botInfo.endTime = new Date();

    logger.info(`🛑 Bot ${botId} đã được dừng bởi admin`);

    res.json({
      success: true,
      message: 'Bot đã được dừng thành công',
      botId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/bot-control/clear
 * @desc Xóa lịch sử các bots đã hoàn thành
 */
router.delete('/clear', (req, res) => {
  let clearedCount = 0;

  runningBots.forEach((info, id) => {
    if (info.status !== 'running') {
      runningBots.delete(id);
      clearedCount++;
    }
  });

  res.json({
    success: true,
    message: `Đã xóa ${clearedCount} bot history`,
    clearedCount
  });
});

module.exports = router;
