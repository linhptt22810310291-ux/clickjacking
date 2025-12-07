'use strict';
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const authenticateToken = require('../middleware/auth.middleware');
const authenticateTokenOptional = require('../middleware/authenticateTokenOptional');

// User/Guest routes (optional auth - can be guest or logged in user)
router.post('/conversations', authenticateTokenOptional, chatController.startConversation);
router.post('/conversations/:id/messages', authenticateTokenOptional, chatController.sendMessage);
router.get('/conversations/:id/messages', authenticateTokenOptional, chatController.getMessages);
router.post('/conversations/:id/request-human', authenticateTokenOptional, chatController.requestHumanSupport);

module.exports = router;
