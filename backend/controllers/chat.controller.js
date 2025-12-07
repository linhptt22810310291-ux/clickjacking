'use strict';
const db = require('../models');
const { Op } = require('sequelize');

// Helper: Check for banned keywords
const checkBannedKeywords = async (message) => {
  const bannedKeywords = await db.ChatBannedKeyword.findAll({
    where: { IsActive: true },
    attributes: ['Keyword']
  });
  
  const messageLower = message.toLowerCase();
  for (const kw of bannedKeywords) {
    if (messageLower.includes(kw.Keyword.toLowerCase())) {
      return { blocked: true, keyword: kw.Keyword };
    }
  }
  return { blocked: false };
};

// Helper: Get chatbot auto-reply
const getChatbotReply = async (message) => {
  const autoReplies = await db.ChatAutoReply.findAll({
    where: { IsActive: true },
    order: [['Priority', 'DESC']]
  });
  
  const messageLower = message.toLowerCase();
  for (const reply of autoReplies) {
    const keywords = reply.TriggerKeywords.split(',').map(k => k.trim().toLowerCase());
    if (keywords.some(kw => messageLower.includes(kw))) {
      return reply.Response;
    }
  }
  return null; // No matching auto-reply
};

// Default welcome message
const DEFAULT_WELCOME = `Xin chào! Tôi là trợ lý ảo của LilyShoe. Tôi có thể giúp bạn:
- Tư vấn sản phẩm
- Kiểm tra tình trạng đơn hàng
- Hỗ trợ đổi/trả hàng
- Các vấn đề khác

Hãy cho tôi biết bạn cần hỗ trợ gì nhé!`;

// ========================================
// USER/GUEST ENDPOINTS
// ========================================

/**
 * @route   POST /api/chat/conversations
 * @desc    Start a new conversation or get existing open conversation
 * @access  Public (with optional auth)
 */
exports.startConversation = async (req, res) => {
  try {
    const { guestSessionId, guestName, guestEmail, subject, productId, orderId } = req.body;
    const userId = req.user?.id || null;
    
    // Check for existing open conversation
    let whereClause = { Status: { [Op.ne]: 'closed' } };
    if (userId) {
      whereClause.UserID = userId;
    } else if (guestSessionId) {
      whereClause.GuestSessionID = guestSessionId;
    } else {
      return res.status(400).json({ errors: [{ msg: 'Cần đăng nhập hoặc cung cấp session ID.' }] });
    }
    
    let conversation = await db.ChatConversation.findOne({
      where: whereClause,
      include: [
        { model: db.Product, as: 'product', attributes: ['ProductID', 'Name'] },
        { model: db.Order, as: 'order', attributes: ['OrderID', 'Status', 'TotalAmount'] }
      ]
    });
    
    // If no existing conversation, create new one
    if (!conversation) {
      conversation = await db.ChatConversation.create({
        UserID: userId,
        GuestSessionID: !userId ? guestSessionId : null,
        GuestName: guestName || null,
        GuestEmail: guestEmail || null,
        Subject: subject || null,
        ProductID: productId || null,
        OrderID: orderId || null,
        Status: 'open',
        IsBotHandling: true,
        LastMessageAt: new Date()
      });
      
      // Send welcome message from bot
      await db.ChatMessage.create({
        ConversationID: conversation.ConversationID,
        SenderType: 'bot',
        SenderID: null,
        Message: DEFAULT_WELCOME
      });
      
      // Reload with associations
      conversation = await db.ChatConversation.findByPk(conversation.ConversationID, {
        include: [
          { model: db.Product, as: 'product', attributes: ['ProductID', 'Name'] },
          { model: db.Order, as: 'order', attributes: ['OrderID', 'Status', 'TotalAmount'] }
        ]
      });
    }
    
    // Get messages
    const messages = await db.ChatMessage.findAll({
      where: { ConversationID: conversation.ConversationID },
      order: [['CreatedAt', 'ASC']],
      include: [{ model: db.User, as: 'sender', attributes: ['FullName', 'AvatarURL'] }]
    });
    
    res.json({ conversation, messages });
  } catch (error) {
    console.error('START CONVERSATION ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   POST /api/chat/conversations/:id/messages
 * @desc    Send a message in a conversation
 * @access  Public (validated by session/user)
 */
exports.sendMessage = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const { message, guestSessionId } = req.body;
    const userId = req.user?.id || null;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ errors: [{ msg: 'Tin nhắn không được để trống.' }] });
    }
    
    // Verify conversation ownership
    const conversation = await db.ChatConversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({ errors: [{ msg: 'Không tìm thấy cuộc hội thoại.' }] });
    }
    
    // Check ownership
    if (userId && conversation.UserID !== userId) {
      return res.status(403).json({ errors: [{ msg: 'Không có quyền truy cập.' }] });
    }
    if (!userId && conversation.GuestSessionID !== guestSessionId) {
      return res.status(403).json({ errors: [{ msg: 'Không có quyền truy cập.' }] });
    }
    
    // Check for banned keywords
    const banned = await checkBannedKeywords(message);
    
    // Create user/guest message
    const senderType = userId ? 'user' : 'guest';
    const newMessage = await db.ChatMessage.create({
      ConversationID: conversationId,
      SenderType: senderType,
      SenderID: userId,
      Message: message.trim(),
      IsBlocked: banned.blocked,
      BlockedReason: banned.blocked ? `Chứa từ khóa bị cấm: ${banned.keyword}` : null
    });
    
    // Update conversation status and timestamp
    await conversation.update({
      Status: 'waiting',
      LastMessageAt: new Date()
    });
    
    const responseMessages = [newMessage];
    
    // If not blocked and bot is handling, try to auto-reply
    if (!banned.blocked && conversation.IsBotHandling) {
      const botReply = await getChatbotReply(message);
      
      // If no matching auto-reply, send a default message suggesting human support
      const finalReply = botReply || 'Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Bạn có thể nhấn nút "Yêu cầu nhân viên hỗ trợ" bên dưới để được hỗ trợ tốt hơn nhé!';
      
      const botMessage = await db.ChatMessage.create({
        ConversationID: conversationId,
        SenderType: 'bot',
        SenderID: null,
        Message: finalReply
      });
      responseMessages.push(botMessage);
      
      // Update status to replied
      await conversation.update({ Status: 'replied' });
    }
    
    res.status(201).json({ 
      messages: responseMessages,
      blocked: banned.blocked,
      blockedReason: banned.blocked ? 'Tin nhắn chứa nội dung không phù hợp và đã bị lọc.' : null
    });
  } catch (error) {
    console.error('SEND MESSAGE ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   GET /api/chat/conversations/:id/messages
 * @desc    Get messages in a conversation
 * @access  Public (validated by session/user)
 */
exports.getMessages = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const { guestSessionId } = req.query;
    const userId = req.user?.id || null;
    
    const conversation = await db.ChatConversation.findByPk(conversationId, {
      include: [
        { model: db.Product, as: 'product', attributes: ['ProductID', 'Name'] },
        { model: db.Order, as: 'order', attributes: ['OrderID', 'Status', 'TotalAmount'] }
      ]
    });
    
    if (!conversation) {
      return res.status(404).json({ errors: [{ msg: 'Không tìm thấy cuộc hội thoại.' }] });
    }
    
    // Check ownership
    if (userId && conversation.UserID !== userId) {
      return res.status(403).json({ errors: [{ msg: 'Không có quyền truy cập.' }] });
    }
    if (!userId && conversation.GuestSessionID !== guestSessionId) {
      return res.status(403).json({ errors: [{ msg: 'Không có quyền truy cập.' }] });
    }
    
    const messages = await db.ChatMessage.findAll({
      where: { ConversationID: conversationId },
      order: [['CreatedAt', 'ASC']],
      include: [{ model: db.User, as: 'sender', attributes: ['FullName', 'AvatarURL'] }]
    });
    
    res.json({ conversation, messages });
  } catch (error) {
    console.error('GET MESSAGES ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   POST /api/chat/conversations/:id/request-human
 * @desc    Request human support (disable bot)
 * @access  Public
 */
exports.requestHumanSupport = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const { guestSessionId } = req.body;
    const userId = req.user?.id || null;
    
    const conversation = await db.ChatConversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({ errors: [{ msg: 'Không tìm thấy cuộc hội thoại.' }] });
    }
    
    // Check ownership
    if (userId && conversation.UserID !== userId) {
      return res.status(403).json({ errors: [{ msg: 'Không có quyền truy cập.' }] });
    }
    if (!userId && conversation.GuestSessionID !== guestSessionId) {
      return res.status(403).json({ errors: [{ msg: 'Không có quyền truy cập.' }] });
    }
    
    // Disable bot and update status
    await conversation.update({
      IsBotHandling: false,
      Status: 'waiting'
    });
    
    // Add system message
    await db.ChatMessage.create({
      ConversationID: conversationId,
      SenderType: 'bot',
      Message: 'Yêu cầu hỗ trợ từ nhân viên đã được gửi. Vui lòng chờ trong giây lát, nhân viên sẽ phản hồi sớm nhất có thể.'
    });
    
    res.json({ message: 'Đã chuyển sang hỗ trợ nhân viên.' });
  } catch (error) {
    console.error('REQUEST HUMAN ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

// ========================================
// ADMIN ENDPOINTS
// ========================================

/**
 * @route   GET /api/admin/chat/conversations
 * @desc    Get all conversations (for admin)
 * @access  Admin
 */
exports.getConversationsAdmin = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;
    const { status, keyword } = req.query;
    
    const whereClause = {};
    if (status && status !== 'all') {
      whereClause.Status = status;
    }
    
    const { count, rows } = await db.ChatConversation.findAndCountAll({
      where: whereClause,
      include: [
        { model: db.User, as: 'user', attributes: ['UserID', 'Username', 'Email', 'FullName'] },
        { model: db.User, as: 'assignedAdmin', attributes: ['UserID', 'Username', 'FullName'] },
        { model: db.Product, as: 'product', attributes: ['ProductID', 'Name'] },
        { model: db.Order, as: 'order', attributes: ['OrderID', 'Status', 'TotalAmount'] }
      ],
      order: [['LastMessageAt', 'DESC']],
      limit,
      offset
    });
    
    res.json({
      conversations: rows,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('ADMIN GET CONVERSATIONS ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   GET /api/admin/chat/conversations/:id
 * @desc    Get conversation detail with messages (admin)
 * @access  Admin
 */
exports.getConversationDetailAdmin = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    
    const conversation = await db.ChatConversation.findByPk(conversationId, {
      include: [
        { model: db.User, as: 'user', attributes: ['UserID', 'Username', 'Email', 'FullName', 'Phone'] },
        { model: db.User, as: 'assignedAdmin', attributes: ['UserID', 'Username', 'FullName'] },
        { model: db.Product, as: 'product', attributes: ['ProductID', 'Name', 'Price'] },
        { model: db.Order, as: 'order', attributes: ['OrderID', 'Status', 'TotalAmount', 'OrderDate'] }
      ]
    });
    
    if (!conversation) {
      return res.status(404).json({ errors: [{ msg: 'Không tìm thấy cuộc hội thoại.' }] });
    }
    
    const messages = await db.ChatMessage.findAll({
      where: { ConversationID: conversationId },
      order: [['CreatedAt', 'ASC']],
      include: [{ model: db.User, as: 'sender', attributes: ['FullName', 'AvatarURL'] }]
    });
    
    res.json({ conversation, messages });
  } catch (error) {
    console.error('ADMIN GET CONVERSATION DETAIL ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   POST /api/admin/chat/conversations/:id/messages
 * @desc    Admin sends a message
 * @access  Admin
 */
exports.adminSendMessage = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const { message } = req.body;
    const adminId = req.user.id;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ errors: [{ msg: 'Tin nhắn không được để trống.' }] });
    }
    
    const conversation = await db.ChatConversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({ errors: [{ msg: 'Không tìm thấy cuộc hội thoại.' }] });
    }
    
    // Create admin message
    const newMessage = await db.ChatMessage.create({
      ConversationID: conversationId,
      SenderType: 'admin',
      SenderID: adminId,
      Message: message.trim()
    });
    
    // Update conversation
    await conversation.update({
      Status: 'replied',
      IsBotHandling: false,
      AssignedAdminID: adminId,
      LastMessageAt: new Date()
    });
    
    // Reload with sender info
    const reloadedMessage = await db.ChatMessage.findByPk(newMessage.MessageID, {
      include: [{ model: db.User, as: 'sender', attributes: ['FullName', 'AvatarURL'] }]
    });
    
    res.status(201).json(reloadedMessage);
  } catch (error) {
    console.error('ADMIN SEND MESSAGE ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   PUT /api/admin/chat/conversations/:id/close
 * @desc    Close a conversation
 * @access  Admin
 */
exports.closeConversation = async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    
    const conversation = await db.ChatConversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({ errors: [{ msg: 'Không tìm thấy cuộc hội thoại.' }] });
    }
    
    await conversation.update({ Status: 'closed' });
    
    // Add system message
    await db.ChatMessage.create({
      ConversationID: conversationId,
      SenderType: 'bot',
      Message: 'Cuộc hội thoại đã được đóng. Cảm ơn bạn đã liên hệ với LilyShoe!'
    });
    
    res.json({ message: 'Đã đóng cuộc hội thoại.' });
  } catch (error) {
    console.error('CLOSE CONVERSATION ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

// ========================================
// BANNED KEYWORDS MANAGEMENT
// ========================================

/**
 * @route   GET /api/admin/chat/banned-keywords
 * @desc    Get all banned keywords
 * @access  Admin
 */
exports.getBannedKeywords = async (req, res) => {
  try {
    const keywords = await db.ChatBannedKeyword.findAll({
      order: [['CreatedAt', 'DESC']],
      include: [{ model: db.User, as: 'creator', attributes: ['Username'] }]
    });
    res.json(keywords);
  } catch (error) {
    console.error('GET BANNED KEYWORDS ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   POST /api/admin/chat/banned-keywords
 * @desc    Add a banned keyword
 * @access  Admin
 */
exports.addBannedKeyword = async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ errors: [{ msg: 'Từ khóa không được để trống.' }] });
    }
    
    const existing = await db.ChatBannedKeyword.findOne({
      where: { Keyword: keyword.trim().toLowerCase() }
    });
    if (existing) {
      return res.status(409).json({ errors: [{ msg: 'Từ khóa đã tồn tại.' }] });
    }
    
    const newKeyword = await db.ChatBannedKeyword.create({
      Keyword: keyword.trim().toLowerCase(),
      IsActive: true,
      CreatedBy: req.user.id
    });
    
    res.status(201).json(newKeyword);
  } catch (error) {
    console.error('ADD BANNED KEYWORD ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   DELETE /api/admin/chat/banned-keywords/:id
 * @desc    Delete a banned keyword
 * @access  Admin
 */
exports.deleteBannedKeyword = async (req, res) => {
  try {
    const keywordId = parseInt(req.params.id, 10);
    await db.ChatBannedKeyword.destroy({ where: { KeywordID: keywordId } });
    res.json({ message: 'Đã xóa từ khóa.' });
  } catch (error) {
    console.error('DELETE BANNED KEYWORD ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

// ========================================
// AUTO-REPLIES MANAGEMENT
// ========================================

/**
 * @route   GET /api/admin/chat/auto-replies
 * @desc    Get all auto-replies
 * @access  Admin
 */
exports.getAutoReplies = async (req, res) => {
  try {
    const replies = await db.ChatAutoReply.findAll({
      order: [['Priority', 'DESC'], ['CreatedAt', 'DESC']]
    });
    res.json(replies);
  } catch (error) {
    console.error('GET AUTO REPLIES ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   POST /api/admin/chat/auto-replies
 * @desc    Add an auto-reply
 * @access  Admin
 */
exports.addAutoReply = async (req, res) => {
  try {
    const { triggerKeywords, response, priority } = req.body;
    if (!triggerKeywords || !response) {
      return res.status(400).json({ errors: [{ msg: 'Từ khóa và phản hồi không được để trống.' }] });
    }
    
    const newReply = await db.ChatAutoReply.create({
      TriggerKeywords: triggerKeywords,
      Response: response,
      Priority: priority || 0,
      IsActive: true
    });
    
    res.status(201).json(newReply);
  } catch (error) {
    console.error('ADD AUTO REPLY ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   PUT /api/admin/chat/auto-replies/:id
 * @desc    Update an auto-reply
 * @access  Admin
 */
exports.updateAutoReply = async (req, res) => {
  try {
    const replyId = parseInt(req.params.id, 10);
    const { triggerKeywords, response, priority, isActive } = req.body;
    
    const reply = await db.ChatAutoReply.findByPk(replyId);
    if (!reply) {
      return res.status(404).json({ errors: [{ msg: 'Không tìm thấy phản hồi tự động.' }] });
    }
    
    await reply.update({
      TriggerKeywords: triggerKeywords ?? reply.TriggerKeywords,
      Response: response ?? reply.Response,
      Priority: priority ?? reply.Priority,
      IsActive: isActive ?? reply.IsActive,
      UpdatedAt: new Date()
    });
    
    res.json(reply);
  } catch (error) {
    console.error('UPDATE AUTO REPLY ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};

/**
 * @route   DELETE /api/admin/chat/auto-replies/:id
 * @desc    Delete an auto-reply
 * @access  Admin
 */
exports.deleteAutoReply = async (req, res) => {
  try {
    const replyId = parseInt(req.params.id, 10);
    await db.ChatAutoReply.destroy({ where: { ReplyID: replyId } });
    res.json({ message: 'Đã xóa phản hồi tự động.' });
  } catch (error) {
    console.error('DELETE AUTO REPLY ERROR:', error);
    res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
  }
};
