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
  const [productSent, setProductSent] = useState(false); // Track if product context was sent
  const [productCategory, setProductCategory] = useState('');
  const [productTargetGroup, setProductTargetGroup] = useState('');
  const [productSort, setProductSort] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  
  // Order inquiry states
  const [showOrderSelector, setShowOrderSelector] = useState(false);
  const [userOrders, setUserOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);
  
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
      const params = { page: productPage, limit: 12 };
      if (search) params.keyword = search; // Fix: backend expects 'keyword', not 'search'
      if (productCategory) params.category = productCategory;
      if (productTargetGroup) params.targetGroup = productTargetGroup;
      if (productSort) params.sort = productSort;
      
      const { data } = await api.get('/products', { params });
      setProducts(data.products || []);
      setProductTotalPages(data.totalPages || 1);
      setProductTotal(data.total || 0);
    } catch (error) {
      console.error('Fetch products error:', error);
    } finally {
      setLoadingProducts(false);
    }
  }, [productPage, productCategory, productTargetGroup, productSort]);

  // Search products with debounce
  useEffect(() => {
    if (showProductSelector) {
      const timer = setTimeout(() => {
        fetchProducts(productSearchTerm);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [productSearchTerm, showProductSelector, fetchProducts]);

  // Fetch user orders for order inquiry
  const fetchUserOrders = useCallback(async () => {
    if (!user || !isAuthenticated) return;
    setLoadingOrders(true);
    try {
      const { data } = await api.get('/profile/orders', { params: { limit: 10, page: 1 } });
      setUserOrders(data.orders || []);
    } catch (error) {
      console.error('Fetch orders error:', error);
    } finally {
      setLoadingOrders(false);
    }
  }, [user, isAuthenticated]);

  // Load orders when order selector opens
  useEffect(() => {
    if (showOrderSelector && user) {
      fetchUserOrders();
    }
  }, [showOrderSelector, user, fetchUserOrders]);

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
      
      // Auto send product message if productContext exists and hasn't been sent
      if (productContext?.productId && !productSent) {
        setProductSent(true);
        // Send product info after a short delay with image
        setTimeout(() => {
          const productImage = productContext.productImage || '';
          const productPrice = productContext.productPrice ? Number(productContext.productPrice).toLocaleString('vi-VN') + '₫' : '';
          const productMessage = `[PRODUCT_CARD]
{"name":"${productContext.productName || ''}","price":"${productPrice}","image":"${productImage}","link":"${window.location.href}","id":${productContext.productId}}
[/PRODUCT_CARD]`;
          sendChatMessageAPI(data.conversation.ConversationID, { 
            message: productMessage,
            guestSessionId: user ? undefined : getGuestSessionId()
          }).then(res => {
            setMessages(prev => [...prev, ...res.data.messages]);
          }).catch(err => console.error('Auto send product error:', err));
        }, 500);
      }
    } catch (error) {
      console.error('Init conversation error:', error);
      toast.error('Không thể kết nối chat. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [user, productContext, orderContext, productSent]);

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

  // Send product info to chat with image
  const handleSendProduct = (product) => {
    const productImage = resolveImageUrl(product.DefaultImage);
    const productUrl = `${window.location.origin}/product/${product.ProductID}`;
    
    // Use JSON format like admin (consistent format for parsing)
    const productMessage = JSON.stringify({
      type: 'product',
      productId: product.ProductID,
      productName: product.Name,
      productPrice: product.DiscountedPrice || product.Price,
      productImage: productImage,
      productUrl: productUrl
    });
    
    setShowProductSelector(false);
    setSelectedProduct(null);
    setShowQuickActions(false);
    handleSendMessage(null, productMessage);
  };

  // Send order inquiry to chat
  const handleSendOrderInquiry = (order, inquiryType = 'general') => {
    const statusMap = {
      'Pending': 'Chờ xác nhận',
      'Confirmed': 'Đã xác nhận', 
      'Shipped': 'Đang giao',
      'Delivered': 'Đã giao',
      'Cancelled': 'Đã hủy',
      'PendingPayment': 'Chờ thanh toán'
    };
    
    let message = '';
    switch(inquiryType) {
      case 'status':
        message = `Tôi muốn kiểm tra trạng thái đơn hàng #${order.OrderID}. Trạng thái hiện tại: ${statusMap[order.Status] || order.Status}. Vui lòng cập nhật cho tôi!`;
        break;
      case 'shipping':
        message = `Tôi muốn hỏi về vận chuyển đơn hàng #${order.OrderID}. ${order.TrackingCode ? `Mã vận đơn: ${order.TrackingCode}` : 'Chưa có mã vận đơn'}.`;
        break;
      case 'cancel':
        message = `Tôi muốn yêu cầu hủy đơn hàng #${order.OrderID}. Tổng giá trị: ${Number(order.TotalAmount).toLocaleString('vi-VN')}₫. Lý do: `;
        break;
      case 'return':
        message = `Tôi muốn yêu cầu đổi/trả hàng cho đơn #${order.OrderID}. Ngày đặt: ${new Date(order.OrderDate).toLocaleDateString('vi-VN')}. Lý do: `;
        break;
      default:
        message = `[ORDER_CARD]
{"orderId":${order.OrderID},"status":"${statusMap[order.Status] || order.Status}","total":"${Number(order.TotalAmount).toLocaleString('vi-VN')}₫","date":"${new Date(order.OrderDate).toLocaleDateString('vi-VN')}","tracking":"${order.TrackingCode || ''}"}
[/ORDER_CARD]
Tôi cần hỗ trợ về đơn hàng này.`;
    }
    
    setShowOrderSelector(false);
    setShowQuickActions(false);
    handleSendMessage(null, message);
  };

  // Quick action handlers
  const quickActions = [
    { id: 'order_status', label: '📦 Kiểm tra đơn hàng', action: () => setShowOrderSelector(true), requireAuth: true },
    { id: 'shipping', label: '🚚 Thông tin vận chuyển', action: () => handleSendMessage(null, 'Tôi muốn hỏi về chính sách vận chuyển và thời gian giao hàng.'), requireAuth: false },
    { id: 'return', label: '🔄 Đổi/Trả hàng', action: () => handleSendMessage(null, 'Tôi muốn hỏi về chính sách đổi trả hàng.'), requireAuth: false },
    { id: 'payment', label: '💳 Thanh toán', action: () => handleSendMessage(null, 'Tôi muốn hỏi về các phương thức thanh toán.'), requireAuth: false },
    { id: 'product', label: '👟 Hỏi về sản phẩm', action: () => setShowProductSelector(true), requireAuth: false },
    { id: 'other', label: '💬 Vấn đề khác', action: () => { setShowQuickActions(false); inputRef.current?.focus(); }, requireAuth: false },
  ];

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
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'product') return true;
    } catch (e) {
      // Not JSON
    }
    return message.includes('[PRODUCT_CARD]') || message.includes('📦 Tôi muốn hỏi về sản phẩm');
  };

  // Check if message is an order card
  const isOrderMessage = (message) => {
    return message.includes('[ORDER_CARD]');
  };

  // Parse and render order card in message
  const renderOrderCard = (message) => {
    try {
      const jsonMatch = message.match(/\[ORDER_CARD\]\s*([\s\S]*?)\s*\[\/ORDER_CARD\]/);
      if (jsonMatch) {
        const order = JSON.parse(jsonMatch[1]);
        const remainingText = message.replace(/\[ORDER_CARD\][\s\S]*?\[\/ORDER_CARD\]/, '').trim();
        return (
          <div>
            <div className="chat-order-card">
              <div className="chat-order-card-header">
                <FaBox className="me-2" />
                Đơn hàng #{order.orderId}
              </div>
              <div className="chat-order-card-body">
                <div className="chat-order-row">
                  <span>Trạng thái:</span>
                  <Badge bg={order.status === 'Đã giao' ? 'success' : order.status === 'Đã hủy' ? 'danger' : 'warning'}>
                    {order.status}
                  </Badge>
                </div>
                <div className="chat-order-row">
                  <span>Tổng tiền:</span>
                  <span className="text-danger fw-bold">{order.total}</span>
                </div>
                <div className="chat-order-row">
                  <span>Ngày đặt:</span>
                  <span>{order.date}</span>
                </div>
                {order.tracking && (
                  <div className="chat-order-row">
                    <span>Mã vận đơn:</span>
                    <span className="text-primary">{order.tracking}</span>
                  </div>
                )}
              </div>
            </div>
            {remainingText && <div className="mt-2">{remainingText}</div>}
          </div>
        );
      }
    } catch (e) {
      console.error('Parse order card error:', e);
    }
    return message;
  };

  // Parse and render product card in message
  const renderProductCard = (message) => {
    // Try new JSON format first (from both admin and user)
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'product') {
        return (
          <div className="chat-product-card-inline">
            <img 
              src={parsed.productImage || 'https://placehold.co/80x80/e2e8f0/64748b?text=No+Image'} 
              alt={parsed.productName}
              className="chat-product-card-image"
              onError={(e) => { e.target.src = 'https://placehold.co/80x80/e2e8f0/64748b?text=No+Image'; }}
            />
            <div className="chat-product-card-info">
              <div className="chat-product-card-name">{parsed.productName}</div>
              <div className="chat-product-card-price">
                {Number(parsed.productPrice).toLocaleString('vi-VN')}₫
              </div>
              <a href={parsed.productUrl} target="_blank" rel="noopener noreferrer" className="chat-product-card-link">
                Xem sản phẩm →
              </a>
            </div>
          </div>
        );
      }
    } catch (e) {
      // Not new JSON format, try old format
    }
    
    // Old [PRODUCT_CARD] format (backward compatibility)
    if (message.includes('[PRODUCT_CARD]')) {
      try {
        const jsonMatch = message.match(/\[PRODUCT_CARD\]\s*({.*?})\s*\[\/PRODUCT_CARD\]/s);
        if (jsonMatch) {
          const product = JSON.parse(jsonMatch[1]);
          return (
            <div className="chat-product-card-inline">
              <img 
                src={product.image || 'https://placehold.co/80x80/e2e8f0/64748b?text=No+Image'} 
                alt={product.name}
                className="chat-product-card-image"
                onError={(e) => { e.target.src = 'https://placehold.co/80x80/e2e8f0/64748b?text=No+Image'; }}
              />
              <div className="chat-product-card-info">
                <div className="chat-product-card-name">{product.name}</div>
                <div className="chat-product-card-price">{product.price}</div>
                <a href={product.link} target="_blank" rel="noopener noreferrer" className="chat-product-card-link">
                  Xem sản phẩm →
                </a>
              </div>
            </div>
          );
        }
      } catch (e) {
        console.error('Parse product card error:', e);
      }
    }
    
    // Fallback for plain text
    return <span>{message}</span>;
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
                          ) : isOrderMessage(msg.Message) ? (
                            renderOrderCard(msg.Message)
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

                {/* Quick Actions - Show when no messages or early in conversation */}
                {!showGuestForm && messages.length <= 2 && showQuickActions && (
                  <div className="chat-quick-actions">
                    <div className="chat-quick-actions-title">Bạn cần hỗ trợ gì?</div>
                    <div className="chat-quick-actions-grid">
                      {quickActions.map(action => {
                        if (action.requireAuth && !isAuthenticated) return null;
                        return (
                          <button
                            key={action.id}
                            type="button"
                            className="chat-quick-action-btn"
                            onClick={action.action}
                          >
                            {action.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Order Selector Modal */}
                {showOrderSelector && (
                  <div className="chat-selector-overlay">
                    <div className="chat-selector-container">
                      <div className="chat-selector-header">
                        <span>Chọn đơn hàng</span>
                        <Button variant="link" size="sm" onClick={() => setShowOrderSelector(false)}>
                          <FaTimes />
                        </Button>
                      </div>
                      <div className="chat-selector-body">
                        {loadingOrders ? (
                          <div className="text-center p-3"><Spinner size="sm" /></div>
                        ) : userOrders.length === 0 ? (
                          <p className="text-muted small text-center p-3">Bạn chưa có đơn hàng nào</p>
                        ) : (
                          <div className="chat-order-list">
                            {userOrders.map(order => (
                              <div key={order.OrderID} className="chat-order-item">
                                <div className="chat-order-item-info">
                                  <div className="fw-semibold">Đơn #{order.OrderID}</div>
                                  <div className="small text-muted">
                                    {new Date(order.OrderDate).toLocaleDateString('vi-VN')}
                                  </div>
                                  <Badge bg={
                                    order.Status === 'Delivered' ? 'success' :
                                    order.Status === 'Cancelled' ? 'danger' :
                                    order.Status === 'Shipped' ? 'info' : 'warning'
                                  } className="mt-1">
                                    {order.Status === 'Pending' ? 'Chờ xác nhận' :
                                     order.Status === 'Confirmed' ? 'Đã xác nhận' :
                                     order.Status === 'Shipped' ? 'Đang giao' :
                                     order.Status === 'Delivered' ? 'Đã giao' :
                                     order.Status === 'Cancelled' ? 'Đã hủy' :
                                     order.Status === 'PendingPayment' ? 'Chờ thanh toán' : order.Status}
                                  </Badge>
                                </div>
                                <div className="chat-order-item-actions">
                                  <Button 
                                    size="sm" 
                                    variant="outline-primary"
                                    onClick={() => handleSendOrderInquiry(order, 'status')}
                                    title="Kiểm tra trạng thái"
                                  >
                                    📦
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline-info"
                                    onClick={() => handleSendOrderInquiry(order, 'shipping')}
                                    title="Thông tin vận chuyển"
                                  >
                                    🚚
                                  </Button>
                                  {['Pending', 'Confirmed', 'PendingPayment'].includes(order.Status) && (
                                    <Button 
                                      size="sm" 
                                      variant="outline-danger"
                                      onClick={() => handleSendOrderInquiry(order, 'cancel')}
                                      title="Yêu cầu hủy"
                                    >
                                      ❌
                                    </Button>
                                  )}
                                  {order.Status === 'Delivered' && (
                                    <Button 
                                      size="sm" 
                                      variant="outline-warning"
                                      onClick={() => handleSendOrderInquiry(order, 'return')}
                                      title="Đổi/trả hàng"
                                    >
                                      🔄
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
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
        onHide={() => {
          setShowProductSelector(false);
          setProductSearchTerm('');
          setProductCategory('');
          setProductTargetGroup('');
          setProductSort('');
          setProductPage(1);
        }}
        size="lg"
        centered
        className="chat-product-selector-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Chọn sản phẩm {productTotal > 0 && `(${productTotal} kết quả)`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '65vh', overflowY: 'auto' }} className="chat-product-selector">
          {/* Search */}
          <InputGroup className="mb-2">
            <InputGroup.Text><FaSearch /></InputGroup.Text>
            <Form.Control
              placeholder="Tìm kiếm sản phẩm..."
              value={productSearchTerm}
              onChange={(e) => setProductSearchTerm(e.target.value)}
            />
          </InputGroup>
          
          {/* Filters */}
          <div className="row g-2 mb-3">
            <div className="col-4">
              <Form.Select 
                size="sm" 
                value={productCategory} 
                onChange={(e) => { setProductCategory(e.target.value); setProductPage(1); }}
              >
                <option value="">Tất cả danh mục</option>
                <option value="sport">Giày thể thao</option>
                <option value="office">Giày công sở</option>
                <option value="sandal">Sandal</option>
                <option value="sneaker">Sneaker</option>
              </Form.Select>
            </div>
            <div className="col-4">
              <Form.Select 
                size="sm" 
                value={productTargetGroup} 
                onChange={(e) => { setProductTargetGroup(e.target.value); setProductPage(1); }}
              >
                <option value="">Tất cả</option>
                <option value="Men">Nam</option>
                <option value="Women">Nữ</option>
                <option value="Unisex">Unisex</option>
              </Form.Select>
            </div>
            <div className="col-4">
              <Form.Select 
                size="sm" 
                value={productSort} 
                onChange={(e) => { setProductSort(e.target.value); setProductPage(1); }}
              >
                <option value="">Mặc định</option>
                <option value="name_asc">Tên A → Z</option>
                <option value="name_desc">Tên Z → A</option>
                <option value="price_asc">Giá tăng dần</option>
                <option value="price_desc">Giá giảm dần</option>
              </Form.Select>
            </div>
          </div>
          
          {loadingProducts ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : (
            <>
              <div className="row g-3">
                {products.map(product => (
                  <div key={product.ProductID} className="col-6 col-md-4 col-lg-3">
                    <div 
                      className={`card h-100 ${selectedProduct?.ProductID === product.ProductID ? 'selected border-primary' : ''}`}
                      onClick={() => setSelectedProduct(product)}
                    >
                      <img 
                        src={resolveImageUrl(product.DefaultImage)} 
                        alt={product.Name}
                        className="card-img-top"
                      />
                      <div className="card-body">
                        <h6 className="card-title">{product.Name}</h6>
                        <p className="card-text text-danger mb-0">
                          {Number(product.DiscountedPrice || product.Price).toLocaleString('vi-VN')}₫
                        </p>
                      </div>
                      {selectedProduct?.ProductID === product.ProductID && (
                        <div className="position-absolute top-0 end-0 m-2">
                          <Badge bg="primary" className="rounded-circle p-2"><FaCheck /></Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {products.length === 0 && (
                  <div className="col-12 text-center text-muted py-5">
                    <FaBox size={40} className="mb-2 opacity-50" />
                    <p>Không tìm thấy sản phẩm</p>
                  </div>
                )}
              </div>
              
              {/* Pagination */}
              {productTotalPages > 1 && (
                <div className="d-flex justify-content-center align-items-center mt-3 gap-1">
                  <Button 
                    size="sm" 
                    variant="outline-secondary" 
                    disabled={productPage === 1} 
                    onClick={() => setProductPage(1)}
                  >
                    ««
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline-secondary" 
                    disabled={productPage === 1} 
                    onClick={() => setProductPage(p => Math.max(1, p - 1))}
                  >
                    ‹
                  </Button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, productTotalPages) }, (_, i) => {
                    let pageNum;
                    if (productTotalPages <= 5) {
                      pageNum = i + 1;
                    } else if (productPage <= 3) {
                      pageNum = i + 1;
                    } else if (productPage >= productTotalPages - 2) {
                      pageNum = productTotalPages - 4 + i;
                    } else {
                      pageNum = productPage - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        size="sm"
                        variant={productPage === pageNum ? 'primary' : 'outline-secondary'}
                        onClick={() => setProductPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  
                  <Button 
                    size="sm" 
                    variant="outline-secondary" 
                    disabled={productPage === productTotalPages} 
                    onClick={() => setProductPage(p => Math.min(productTotalPages, p + 1))}
                  >
                    ›
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline-secondary" 
                    disabled={productPage === productTotalPages} 
                    onClick={() => setProductPage(productTotalPages)}
                  >
                    »»
                  </Button>
                </div>
              )}
            </>
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
