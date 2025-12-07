'use strict';
const express = require('express');
const router = express.Router();
const chatController = require('../../controllers/chat.controller');
const checkAdmin = require('../../middleware/checkAdmin');

// Apply admin middleware to all routes
router.use(checkAdmin);

// Conversations
router.get('/conversations', chatController.getConversationsAdmin);
router.get('/conversations/:id', chatController.getConversationDetailAdmin);
router.post('/conversations/:id/messages', chatController.adminSendMessage);
router.put('/conversations/:id/close', chatController.closeConversation);
router.put('/conversations/:id/reopen', chatController.reopenConversation);

// Banned keywords
router.get('/banned-keywords', chatController.getBannedKeywords);
router.post('/banned-keywords', chatController.addBannedKeyword);
router.delete('/banned-keywords/:id', chatController.deleteBannedKeyword);

// Auto-replies
router.get('/auto-replies', chatController.getAutoReplies);
router.post('/auto-replies', chatController.addAutoReply);
router.put('/auto-replies/:id', chatController.updateAutoReply);
router.delete('/auto-replies/:id', chatController.deleteAutoReply);

module.exports = router;
