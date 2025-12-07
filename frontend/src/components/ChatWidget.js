import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Card, Form, Badge, Spinner } from 'react-bootstrap';
import { FaComments, FaTimes, FaPaperPlane, FaUser, FaRobot, FaHeadset } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../redux/userSlice';
import {
  startChatConversationAPI,
  sendChatMessageAPI,
  getChatMessagesAPI,
  requestHumanSupportAPI
} from '../api';
import './ChatWidget.css';

// Generate or get session ID for guests
const getGuestSessionId = () => {
  let sessionId = localStorage.getItem('chatGuestSessionId');
  if (!sessionId) {
    sessionId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chatGuestSessionId', sessionId);
  }
  return sessionId;
};

function ChatWidget({ productContext, orderContext }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [guestInfo, setGuestInfo] = useState({ name: '', email: '' });
  const [showGuestForm, setShowGuestForm] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const pollIntervalRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Start or load conversation
  const initConversation = useCallback(async (guestName = null, guestEmail = null) => {
    setLoading(true);
    try {
      const payload = {};
      
      if (user) {
        // Logged in user
      } else {
        // Guest user
        payload.guestSessionId = getGuestSessionId();
        if (guestName) payload.guestName = guestName;
        if (guestEmail) payload.guestEmail = guestEmail;
      }
      
      // Add context if provided
      if (productContext?.productId) {
        payload.productId = productContext.productId;
        payload.subject = `Hỏi về sản phẩm: ${productContext.productName || ''}`;
      }
      if (orderContext?.orderId) {
        payload.orderId = orderContext.orderId;
        payload.subject = `Hỗ trợ đơn hàng #${orderContext.orderId}`;
      }
      
      const { data } = await startChatConversationAPI(payload);
      setConversation(data.conversation);
      setMessages(data.messages || []);
      setShowGuestForm(false);
    } catch (error) {
      console.error('Init conversation error:', error);
      toast.error('Không thể kết nối chat. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [user, productContext, orderContext]);

  // Poll for new messages
  const pollMessages = useCallback(async () => {
    if (!conversation?.ConversationID) return;
    
    try {
      const params = {};
      if (!user) {
        params.guestSessionId = getGuestSessionId();
      }
      
      const { data } = await getChatMessagesAPI(conversation.ConversationID, params);
      if (data.messages?.length > messages.length) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Poll messages error:', error);
    }
  }, [conversation, messages.length, user]);

  // Start polling when chat is open
  useEffect(() => {
    if (isOpen && conversation) {
      pollIntervalRef.current = setInterval(pollMessages, 5000);
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen, conversation, pollMessages]);

  // Handle open chat
  const handleOpenChat = () => {
    setIsOpen(true);
    if (!conversation) {
      if (user) {
        initConversation();
      } else {
        setShowGuestForm(true);
      }
    } else {
      inputRef.current?.focus();
    }
  };

  // Handle guest form submit
  const handleGuestSubmit = (e) => {
    e.preventDefault();
    if (!guestInfo.name.trim()) {
      toast.warn('Vui lòng nhập tên của bạn.');
      return;
    }
    initConversation(guestInfo.name, guestInfo.email);
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending) return;
    
    const messageText = inputMessage.trim();
    setInputMessage('');
    setSending(true);
    
    try {
      const payload = { message: messageText };
      if (!user) {
        payload.guestSessionId = getGuestSessionId();
      }
      
      const { data } = await sendChatMessageAPI(conversation.ConversationID, payload);
      
      if (data.blocked) {
        toast.warn(data.blockedReason || 'Tin nhắn chứa nội dung không phù hợp.');
      }
      
      // Add new messages to state
      setMessages(prev => [...prev, ...data.messages]);
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Không thể gửi tin nhắn. Vui lòng thử lại.');
      setInputMessage(messageText); // Restore message
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Request human support
  const handleRequestHuman = async () => {
    if (!conversation) return;
    
    try {
      const payload = {};
      if (!user) {
        payload.guestSessionId = getGuestSessionId();
      }
      
      await requestHumanSupportAPI(conversation.ConversationID, payload);
      toast.success('Đã gửi yêu cầu hỗ trợ. Nhân viên sẽ phản hồi sớm.');
      
      // Reload messages to get system message
      pollMessages();
    } catch (error) {
      console.error('Request human error:', error);
      toast.error('Không thể gửi yêu cầu. Vui lòng thử lại.');
    }
  };

  // Format time
  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Get sender icon
  const getSenderIcon = (senderType) => {
    switch (senderType) {
      case 'admin':
        return <FaHeadset className="text-success" />;
      case 'bot':
        return <FaRobot className="text-primary" />;
      default:
        return <FaUser className="text-secondary" />;
    }
  };

  // Get sender name
  const getSenderName = (msg) => {
    switch (msg.SenderType) {
      case 'admin':
        return msg.sender?.FullName || 'Nhân viên hỗ trợ';
      case 'bot':
        return 'Trợ lý ảo';
      case 'user':
        return msg.sender?.FullName || user?.fullName || 'Bạn';
      case 'guest':
        return guestInfo.name || 'Bạn';
      default:
        return 'Bạn';
    }
  };

  return (
    <>
      {/* Chat Button */}
      <Button
        className="chat-widget-button"
        onClick={() => isOpen ? setIsOpen(false) : handleOpenChat()}
        variant={isOpen ? 'secondary' : 'primary'}
      >
        {isOpen ? <FaTimes size={20} /> : <FaComments size={20} />}
        {!isOpen && messages.length === 0 && (
          <Badge bg="danger" className="chat-badge">!</Badge>
        )}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="chat-widget-window">
          {/* Header */}
          <Card.Header className="chat-widget-header d-flex justify-content-between align-items-center">
            <div>
              <FaComments className="me-2" />
              <strong>Chat hỗ trợ</strong>
              {conversation?.Status && (
                <Badge 
                  bg={conversation.Status === 'closed' ? 'secondary' : 'success'} 
                  className="ms-2"
                >
                  {conversation.Status === 'waiting' ? 'Chờ phản hồi' : 
                   conversation.Status === 'replied' ? 'Đã phản hồi' : 
                   conversation.Status === 'closed' ? 'Đã đóng' : 'Đang mở'}
                </Badge>
              )}
            </div>
            <Button variant="link" className="text-white p-0" onClick={() => setIsOpen(false)}>
              <FaTimes />
            </Button>
          </Card.Header>

          <Card.Body className="chat-widget-body">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2 text-muted">Đang kết nối...</p>
              </div>
            ) : showGuestForm ? (
              /* Guest Info Form */
              <Form onSubmit={handleGuestSubmit} className="p-3">
                <p className="text-muted mb-3">
                  Vui lòng cho chúng tôi biết thông tin của bạn để bắt đầu chat:
                </p>
                <Form.Group className="mb-3">
                  <Form.Label>Tên của bạn <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="text"
                    value={guestInfo.name}
                    onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                    placeholder="Nhập tên của bạn"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Email (không bắt buộc)</Form.Label>
                  <Form.Control
                    type="email"
                    value={guestInfo.email}
                    onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </Form.Group>
                <Button type="submit" variant="primary" className="w-100">
                  Bắt đầu chat
                </Button>
              </Form>
            ) : (
              /* Messages */
              <div className="chat-messages">
                {/* Context Info */}
                {(conversation?.product || conversation?.order) && (
                  <div className="chat-context-info mb-3">
                    {conversation.product && (
                      <small className="d-block text-muted">
                        📦 Sản phẩm: {conversation.product.Name}
                      </small>
                    )}
                    {conversation.order && (
                      <small className="d-block text-muted">
                        🧾 Đơn hàng: #{conversation.order.OrderID} - {conversation.order.Status}
                      </small>
                    )}
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div
                    key={msg.MessageID || idx}
                    className={`chat-message ${
                      msg.SenderType === 'user' || msg.SenderType === 'guest' 
                        ? 'chat-message-user' 
                        : 'chat-message-other'
                    } ${msg.IsBlocked ? 'chat-message-blocked' : ''}`}
                  >
                    <div className="chat-message-header">
                      {getSenderIcon(msg.SenderType)}
                      <span className="chat-sender-name ms-1">{getSenderName(msg)}</span>
                      <span className="chat-message-time">{formatTime(msg.CreatedAt)}</span>
                    </div>
                    <div className="chat-message-content">
                      {msg.IsBlocked ? (
                        <em className="text-muted">[Tin nhắn đã bị lọc]</em>
                      ) : (
                        msg.Message.split('\n').map((line, i) => (
                          <span key={i}>{line}<br /></span>
                        ))
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </Card.Body>

          {/* Footer - Input */}
          {!loading && !showGuestForm && conversation?.Status !== 'closed' && (
            <Card.Footer className="chat-widget-footer">
              {conversation?.IsBotHandling && (
                <Button 
                  variant="outline-warning" 
                  size="sm" 
                  className="mb-2 w-100"
                  onClick={handleRequestHuman}
                >
                  <FaHeadset className="me-1" /> Yêu cầu nhân viên hỗ trợ
                </Button>
              )}
              <Form onSubmit={handleSendMessage} className="d-flex gap-2">
                <Form.Control
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Nhập tin nhắn..."
                  disabled={sending}
                />
                <Button type="submit" variant="primary" disabled={sending || !inputMessage.trim()}>
                  {sending ? <Spinner size="sm" /> : <FaPaperPlane />}
                </Button>
              </Form>
            </Card.Footer>
          )}

          {conversation?.Status === 'closed' && (
            <Card.Footer className="text-center text-muted">
              Cuộc hội thoại đã kết thúc.
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => { setConversation(null); initConversation(); }}
              >
                Bắt đầu cuộc hội thoại mới
              </Button>
            </Card.Footer>
          )}
        </Card>
      )}
    </>
  );
}

export default ChatWidget;
