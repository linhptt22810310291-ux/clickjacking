import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Card, Form, Badge, Spinner, Modal, InputGroup } from 'react-bootstrap';
import { FaComments, FaTimes, FaPaperPlane, FaUser, FaRobot, FaHeadset, FaPlus, FaImage, FaBox, FaSearch, FaCheck } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../redux/userSlice';
import {
  startChatConversationAPI,
  sendChatMessageAPI,
  getChatMessagesAPI,
  requestHumanSupportAPI
} from '../api';
import api from '../api/api';
import './ChatWidget.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// Helper to resolve image URL
const resolveImageUrl = (url) => {
  if (!url) return 'https://placehold.co/100x100/e2e8f0/64748b?text=No+Image';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE_URL}${url}`;
};

// Generate or get session ID for guests
const getGuestSessionId = () => {
  let sessionId = localStorage.getItem('chatGuestSessionId');
  if (!sessionId) {
    sessionId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chatGuestSessionId', sessionId);
  }
  return sessionId;
};

function ChatWidget({ productContext, orderContext, autoOpen = false }) {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [guestInfo, setGuestInfo] = useState({ name: '', email: '' });
  const [showGuestForm, setShowGuestForm] = useState(false);
  
  // Product selector states
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [products, setProducts] = useState([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  
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

  // Auto open if productContext is provided
  useEffect(() => {
    if (autoOpen && productContext) {
      handleOpenChat();
    }
  }, [autoOpen, productContext]);

  // Fetch products for selector
  const fetchProducts = useCallback(async (search = '') => {
    setLoadingProducts(true);
    try {
      const params = { page: 1, limit: 20 };
      if (search) params.search = search;
      const { data } = await api.get('/products', { params });
      setProducts(data.products || []);
    } catch (error) {
      console.error('Fetch products error:', error);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // Search products with debounce
  useEffect(() => {
    if (showProductSelector) {
      const timer = setTimeout(() => {
        fetchProducts(productSearchTerm);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [productSearchTerm, showProductSelector, fetchProducts]);

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
  const handleSendMessage = async (e, customMessage = null) => {
    if (e) e.preventDefault();
    const messageText = customMessage || inputMessage.trim();
    if (!messageText || sending) return;
    
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

  // Send product info to chat
  const handleSendProduct = (product) => {
    const productMessage = `📦 Tôi muốn hỏi về sản phẩm:\n🏷️ ${product.Name}\n💰 Giá: ${Number(product.DiscountedPrice || product.Price).toLocaleString('vi-VN')}₫\n🔗 Link: ${window.location.origin}/product/${product.ProductID}`;
    
    setShowProductSelector(false);
    setSelectedProduct(null);
    handleSendMessage(null, productMessage);
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

  // Check if message is a product card
  const isProductMessage = (message) => {
    return message.includes('📦 Tôi muốn hỏi về sản phẩm:');
  };

  // Render product card in message
  const renderProductCard = (message) => {
    const lines = message.split('\n').filter(l => l.trim());
    const name = lines.find(l => l.includes('🏷️'))?.replace('🏷️ ', '') || '';
    const price = lines.find(l => l.includes('💰'))?.replace('💰 Giá: ', '') || '';
    
    return (
      <div className="chat-product-card-msg">
        <div className="fw-semibold">{name}</div>
        <div className="text-danger small">{price}</div>
      </div>
    );
  };

  // Check if bot response suggests human support
  const shouldShowHumanSuggestion = () => {
    if (messages.length < 2) return false;
    const lastBotMsg = [...messages].reverse().find(m => m.SenderType === 'bot');
    if (!lastBotMsg) return false;
    // Show suggestion if bot gives generic response
    const genericResponses = ['Xin lỗi', 'không hiểu', 'chưa có thông tin', 'vui lòng'];
    return genericResponses.some(phrase => lastBotMsg.Message.includes(phrase));
  };

  return (
    <>
      {/* Chat Button - Fixed position */}
      <div className="chat-widget-container">
        <Button
          className="chat-widget-button"
          onClick={() => isOpen ? setIsOpen(false) : handleOpenChat()}
          variant="primary"
        >
          {isOpen ? <FaTimes size={22} /> : (
            <>
              <FaComments size={22} />
              <span className="chat-button-text">Chat</span>
            </>
          )}
        </Button>

        {/* Chat Window */}
        {isOpen && (
          <Card className="chat-widget-window">
            {/* Header */}
            <Card.Header className="chat-widget-header">
              <div className="d-flex align-items-center">
                <div className="chat-avatar me-2">
                  <FaHeadset size={18} />
                  <span className="chat-online-dot"></span>
                </div>
                <div>
                  <div className="fw-bold">Hỗ trợ Lily Shoes</div>
                  <small className="chat-status-text">
                    {conversation?.IsBotHandling !== false ? 'Trợ lý ảo' : 'Nhân viên hỗ trợ'}
                  </small>
                </div>
              </div>
              <Button variant="link" className="text-white p-0" onClick={() => setIsOpen(false)}>
                <FaTimes size={16} />
              </Button>
            </Card.Header>

            <Card.Body className="chat-widget-body">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" size="sm" />
                  <p className="mt-2 text-muted small">Đang kết nối...</p>
                </div>
              ) : showGuestForm ? (
                /* Guest Info Form */
                <Form onSubmit={handleGuestSubmit} className="p-2">
                  <div className="text-center mb-3">
                    <FaComments size={32} className="text-primary mb-2" />
                    <h6 className="mb-1">Xin chào! 👋</h6>
                    <small className="text-muted">
                      Nhập thông tin để bắt đầu chat
                    </small>
                  </div>
                  <Form.Group className="mb-2">
                    <Form.Control
                      size="sm"
                      type="text"
                      value={guestInfo.name}
                      onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                      placeholder="Tên của bạn *"
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Control
                      size="sm"
                      type="email"
                      value={guestInfo.email}
                      onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                      placeholder="Email (không bắt buộc)"
                    />
                  </Form.Group>
                  <Button type="submit" variant="primary" size="sm" className="w-100">
                    Bắt đầu chat
                  </Button>
                </Form>
              ) : (
                /* Messages */
                <div className="chat-messages">
                  {/* Context Info */}
                  {(conversation?.product || conversation?.order) && (
                    <div className="chat-context-info">
                      {conversation.product && (
                        <div className="d-flex align-items-center">
                          <img 
                            src={resolveImageUrl(conversation.product.DefaultImage)} 
                            alt="" 
                            className="chat-context-image"
                          />
                          <div className="ms-2">
                            <div className="fw-semibold small">{conversation.product.Name}</div>
                            <div className="text-danger small">
                              {Number(conversation.product.DiscountedPrice || conversation.product.Price).toLocaleString('vi-VN')}₫
                            </div>
                          </div>
                        </div>
                      )}
                      {conversation.order && (
                        <small className="text-muted">
                          🧾 Đơn hàng #{conversation.order.OrderID}
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
                      }`}
                    >
                      {(msg.SenderType !== 'user' && msg.SenderType !== 'guest') && (
                        <div className="chat-message-avatar">
                          {getSenderIcon(msg.SenderType)}
                        </div>
                      )}
                      <div className="chat-message-bubble">
                        <div className="chat-message-content">
                          {msg.IsBlocked ? (
                            <em className="text-muted">[Tin nhắn đã bị lọc]</em>
                          ) : isProductMessage(msg.Message) ? (
                            renderProductCard(msg.Message)
                          ) : (
                            msg.Message
                          )}
                        </div>
                        <div className="chat-message-time">{formatTime(msg.CreatedAt)}</div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Show suggestion when bot gives generic response */}
                  {shouldShowHumanSuggestion() && conversation?.IsBotHandling && (
                    <div className="chat-human-suggestion">
                      <small>Cần hỗ trợ thêm?</small>
                      <Button 
                        variant="outline-success" 
                        size="sm"
                        onClick={handleRequestHuman}
                      >
                        <FaHeadset className="me-1" /> Chat với nhân viên
                      </Button>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              )}
            </Card.Body>

            {/* Footer - Input */}
            {!loading && !showGuestForm && conversation?.Status !== 'closed' && (
              <Card.Footer className="chat-widget-footer">
                {conversation?.IsBotHandling && (
                  <div className="chat-request-human">
                    <Button 
                      variant="link" 
                      size="sm"
                      className="text-success p-0"
                      onClick={handleRequestHuman}
                    >
                      <FaHeadset className="me-1" /> Yêu cầu nhân viên hỗ trợ
                    </Button>
                  </div>
                )}
                <Form onSubmit={handleSendMessage} className="chat-input-form">
                  <Button 
                    variant="light" 
                    size="sm"
                    className="chat-attach-btn"
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                  >
                    <FaPlus />
                  </Button>
                  
                  {/* Attach Menu */}
                  {showAttachMenu && (
                    <div className="chat-attach-menu">
                      <button 
                        type="button" 
                        className="chat-attach-item"
                        onClick={() => {
                          setShowProductSelector(true);
                          setShowAttachMenu(false);
                          fetchProducts();
                        }}
                      >
                        <FaBox className="text-primary" />
                        <span>Sản phẩm</span>
                      </button>
                      <button type="button" className="chat-attach-item" disabled>
                        <FaImage className="text-success" />
                        <span>Ảnh</span>
                      </button>
                    </div>
                  )}
                  
                  <Form.Control
                    ref={inputRef}
                    type="text"
                    size="sm"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Nhập tin nhắn..."
                    disabled={sending}
                    className="chat-input"
                  />
                  <Button 
                    type="submit" 
                    variant="primary"
                    size="sm"
                    className="chat-send-btn"
                    disabled={sending || !inputMessage.trim()}
                  >
                    {sending ? <Spinner size="sm" /> : <FaPaperPlane />}
                  </Button>
                </Form>
              </Card.Footer>
            )}

            {conversation?.Status === 'closed' && (
              <Card.Footer className="text-center py-2">
                <small className="text-muted d-block mb-1">Cuộc hội thoại đã kết thúc</small>
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => { setConversation(null); initConversation(); }}
                >
                  Chat mới
                </Button>
              </Card.Footer>
            )}
          </Card>
        )}
      </div>

      {/* Product Selector Modal */}
      <Modal 
        show={showProductSelector} 
        onHide={() => setShowProductSelector(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Chọn sản phẩm</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <InputGroup className="mb-3">
            <InputGroup.Text><FaSearch /></InputGroup.Text>
            <Form.Control
              placeholder="Tìm kiếm sản phẩm..."
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
            />
          </InputGroup>
          
          {loadingProducts ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : (
            <div className="row g-2">
              {products.map(product => (
                <div key={product.ProductID} className="col-6 col-md-4">
                  <div 
                    className={`card h-100 cursor-pointer ${selectedProduct?.ProductID === product.ProductID ? 'border-primary' : ''}`}
                    onClick={() => setSelectedProduct(product)}
                    style={{ cursor: 'pointer' }}
                  >
                    <img 
                      src={resolveImageUrl(product.DefaultImage)} 
                      alt={product.Name}
                      className="card-img-top"
                      style={{ height: 120, objectFit: 'cover' }}
                    />
                    <div className="card-body p-2">
                      <h6 className="card-title small text-truncate mb-1">{product.Name}</h6>
                      <p className="card-text text-danger small mb-0">
                        {Number(product.DiscountedPrice || product.Price).toLocaleString('vi-VN')}₫
                      </p>
                    </div>
                    {selectedProduct?.ProductID === product.ProductID && (
                      <div className="position-absolute top-0 end-0 m-1">
                        <Badge bg="primary"><FaCheck /></Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {products.length === 0 && (
                <div className="col-12 text-center text-muted py-4">
                  Không tìm thấy sản phẩm
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProductSelector(false)}>
            Hủy
          </Button>
          <Button 
            variant="primary" 
            disabled={!selectedProduct}
            onClick={() => handleSendProduct(selectedProduct)}
          >
            <FaPaperPlane className="me-1" /> Gửi
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default ChatWidget;
