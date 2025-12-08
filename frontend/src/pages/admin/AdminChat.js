import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Form, InputGroup, Spinner, Alert, Tab, Tabs, Modal, Image, Pagination } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FaComments, FaUser, FaRobot, FaHeadset, FaPaperPlane, FaTimes, FaPlus, FaTrash, FaEdit, FaBoxOpen } from 'react-icons/fa';
import {
  getAdminChatConversationsAPI,
  getAdminChatConversationDetailAPI,
  adminSendChatMessageAPI,
  closeChatConversationAPI,
  reopenChatConversationAPI,
  getBannedKeywordsAPI,
  addBannedKeywordAPI,
  deleteBannedKeywordAPI,
  getAutoRepliesAPI,
  addAutoReplyAPI,
  updateAutoReplyAPI,
  deleteAutoReplyAPI,
  getProductsAPI
} from '../../api';

// Status badge colors
const statusColors = {
  open: 'primary',
  waiting: 'warning',
  replied: 'success',
  closed: 'secondary'
};

const statusLabels = {
  open: 'Mới',
  waiting: 'Chờ phản hồi',
  replied: 'Đã phản hồi',
  closed: 'Đã đóng'
};

export default function AdminChat() {
  const [activeTab, setActiveTab] = useState('conversations');
  
  // Conversations state
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Banned keywords state
  const [bannedKeywords, setBannedKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [keywordsLoading, setKeywordsLoading] = useState(false);
  const [keywordsPage, setKeywordsPage] = useState(1);
  const [keywordsTotalPages, setKeywordsTotalPages] = useState(1);
  
  // Auto replies state
  const [autoReplies, setAutoReplies] = useState([]);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [editingReply, setEditingReply] = useState(null);
  const [replyForm, setReplyForm] = useState({ triggerKeywords: '', response: '', priority: 0 });
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesPage, setRepliesPage] = useState(1);
  const [repliesTotalPages, setRepliesTotalPages] = useState(1);
  
  // Product search state
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [searchedProducts, setSearchedProducts] = useState([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productCategory, setProductCategory] = useState('');
  const [productTargetGroup, setProductTargetGroup] = useState('');
  const [productSort, setProductSort] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  
  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const { data } = await getAdminChatConversationsAPI(params);
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Load conversations error:', error);
      toast.error('Không thể tải danh sách hội thoại.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Load conversation detail
  const loadConversationDetail = async (conversation) => {
    setDetailLoading(true);
    setSelectedConversation(conversation);
    try {
      const { data } = await getAdminChatConversationDetailAPI(conversation.ConversationID);
      setSelectedConversation(data.conversation);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Load detail error:', error);
      toast.error('Không thể tải chi tiết hội thoại.');
    } finally {
      setDetailLoading(false);
    }
  };

  // Poll for new messages
  const pollMessages = useCallback(async () => {
    if (!selectedConversation?.ConversationID) return;
    try {
      const { data } = await getAdminChatConversationDetailAPI(selectedConversation.ConversationID);
      if (data.messages?.length > messages.length) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Poll error:', error);
    }
  }, [selectedConversation, messages.length]);

  // Start polling
  useEffect(() => {
    if (activeTab === 'conversations' && selectedConversation) {
      pollIntervalRef.current = setInterval(pollMessages, 5000);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeTab, selectedConversation, pollMessages]);

  // Load data on mount and tab change
  useEffect(() => {
    if (activeTab === 'conversations') {
      loadConversations();
    } else if (activeTab === 'keywords') {
      loadBannedKeywords();
    } else if (activeTab === 'autoreplies') {
      loadAutoReplies();
    }
  }, [activeTab, loadConversations]);

  // Reload keywords when page changes
  useEffect(() => {
    if (activeTab === 'keywords') {
      loadBannedKeywords();
    }
  }, [keywordsPage]);

  // Reload replies when page changes
  useEffect(() => {
    if (activeTab === 'autoreplies') {
      loadAutoReplies();
    }
  }, [repliesPage]);

  // Load products when modal opens or filters/page change
  useEffect(() => {
    if (showProductModal) {
      handleSearchProducts();
    }
  }, [showProductModal, productPage, productCategory, productTargetGroup, productSort]);

  // Send admin message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedConversation || sending) return;
    
    const messageText = inputMessage.trim();
    setInputMessage('');
    setSending(true);
    
    try {
      const { data } = await adminSendChatMessageAPI(selectedConversation.ConversationID, { message: messageText });
      setMessages(prev => [...prev, data]);
      // Refresh conversation list to update status
      loadConversations();
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Không thể gửi tin nhắn.');
      setInputMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  // Close conversation
  const handleCloseConversation = async () => {
    if (!selectedConversation || !window.confirm('Bạn có chắc muốn đóng cuộc hội thoại này?')) return;
    
    try {
      await closeChatConversationAPI(selectedConversation.ConversationID);
      toast.success('Đã đóng hội thoại.');
      loadConversations();
      // Reload chi tiết để hiển thị trạng thái mới
      loadConversationDetail(selectedConversation);
    } catch (error) {
      console.error('Close conversation error:', error);
      toast.error('Không thể đóng hội thoại.');
    }
  };

  // Reopen conversation - Admin có thể mở lại hội thoại đã đóng
  const handleReopenConversation = async () => {
    if (!selectedConversation) return;
    
    try {
      await reopenChatConversationAPI(selectedConversation.ConversationID);
      toast.success('Đã mở lại hội thoại. Bạn có thể tiếp tục tư vấn.');
      loadConversations();
      loadConversationDetail(selectedConversation);
    } catch (error) {
      console.error('Reopen conversation error:', error);
      toast.error('Không thể mở lại hội thoại.');
    }
  };

  // === Product Sharing ===
  const handleSearchProducts = async (resetPage = false) => {
    if (resetPage) setProductPage(1);
    const page = resetPage ? 1 : productPage;
    
    setProductSearchLoading(true);
    try {
      const params = { page, limit: 12 };
      if (productSearch.trim()) params.keyword = productSearch.trim();
      if (productCategory) params.category = productCategory;
      if (productTargetGroup) params.targetGroup = productTargetGroup;
      if (productSort) params.sort = productSort;
      
      const { data } = await getProductsAPI(params);
      setSearchedProducts(data.products || []);
      setProductTotalPages(data.totalPages || 1);
      setProductTotal(data.total || 0);
    } catch (error) {
      console.error('Search products error:', error);
      toast.error('Không thể tìm sản phẩm.');
    } finally {
      setProductSearchLoading(false);
    }
  };

  const handleSendProduct = async (product) => {
    if (!selectedConversation) return;
    
    const FRONTEND_URL = window.location.hostname === 'localhost' 
      ? 'http://localhost:3000' 
      : 'https://clickjacking-frontend.onrender.com';
    
    const productUrl = `${FRONTEND_URL}/product/${product.ProductID}`;
    
    // Format đặc biệt để frontend parse thành card
    const messageText = JSON.stringify({
      type: 'product',
      productId: product.ProductID,
      productName: product.Name,
      productPrice: product.Price,
      productImage: product.DefaultImage || '',
      productUrl: productUrl
    });
    
    setSending(true);
    try {
      const { data } = await adminSendChatMessageAPI(selectedConversation.ConversationID, { message: messageText });
      setMessages(prev => [...prev, data]);
      setShowProductModal(false);
      setProductSearch('');
      setSearchedProducts([]);
      toast.success('Đã gửi thông tin sản phẩm!');
    } catch (error) {
      console.error('Send product error:', error);
      toast.error('Không thể gửi sản phẩm.');
    } finally {
      setSending(false);
    }
  };

  // === Banned Keywords ===
  const loadBannedKeywords = async () => {
    setKeywordsLoading(true);
    try {
      const { data } = await getBannedKeywordsAPI(keywordsPage, 10);
      setBannedKeywords(data.keywords || []);
      setKeywordsTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Load keywords error:', error);
    } finally {
      setKeywordsLoading(false);
    }
  };

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    
    try {
      await addBannedKeywordAPI({ keyword: newKeyword.trim() });
      toast.success('Đã thêm từ khóa.');
      setNewKeyword('');
      loadBannedKeywords();
    } catch (error) {
      const msg = error.response?.data?.errors?.[0]?.msg || 'Không thể thêm từ khóa.';
      toast.error(msg);
    }
  };

  const handleDeleteKeyword = async (id) => {
    if (!window.confirm('Xóa từ khóa này?')) return;
    try {
      await deleteBannedKeywordAPI(id);
      toast.success('Đã xóa từ khóa.');
      loadBannedKeywords();
    } catch (error) {
      toast.error('Không thể xóa từ khóa.');
    }
  };

  // === Auto Replies ===
  const loadAutoReplies = async () => {
    setRepliesLoading(true);
    try {
      const { data } = await getAutoRepliesAPI(repliesPage, 10);
      setAutoReplies(data.replies || []);
      setRepliesTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Load auto replies error:', error);
    } finally {
      setRepliesLoading(false);
    }
  };

  const handleOpenReplyModal = (reply = null) => {
    if (reply) {
      setEditingReply(reply);
      setReplyForm({
        triggerKeywords: reply.TriggerKeywords,
        response: reply.Response,
        priority: reply.Priority
      });
    } else {
      setEditingReply(null);
      setReplyForm({ triggerKeywords: '', response: '', priority: 0 });
    }
    setShowReplyModal(true);
  };

  const handleSaveReply = async (e) => {
    e.preventDefault();
    if (!replyForm.triggerKeywords.trim() || !replyForm.response.trim()) {
      toast.warn('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    
    try {
      if (editingReply) {
        await updateAutoReplyAPI(editingReply.ReplyID, replyForm);
        toast.success('Đã cập nhật phản hồi tự động.');
      } else {
        await addAutoReplyAPI(replyForm);
        toast.success('Đã thêm phản hồi tự động.');
      }
      setShowReplyModal(false);
      loadAutoReplies();
    } catch (error) {
      toast.error('Không thể lưu phản hồi tự động.');
    }
  };

  const handleDeleteReply = async (id) => {
    if (!window.confirm('Xóa phản hồi tự động này?')) return;
    try {
      await deleteAutoReplyAPI(id);
      toast.success('Đã xóa.');
      loadAutoReplies();
    } catch (error) {
      toast.error('Không thể xóa.');
    }
  };

  // Format time
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN');
  };

  // Get sender icon
  const getSenderIcon = (senderType) => {
    switch (senderType) {
      case 'admin': return <FaHeadset className="text-success" />;
      case 'bot': return <FaRobot className="text-primary" />;
      default: return <FaUser className="text-secondary" />;
    }
  };

  // Get customer info
  const getCustomerInfo = (conv) => {
    if (conv.user) {
      return conv.user.FullName || conv.user.Username || conv.user.Email;
    }
    return conv.GuestName || 'Khách vãng lai';
  };

  // Render message content (parse product card)
  const renderMessageContent = (msg) => {
    try {
      const parsed = JSON.parse(msg.Message);
      if (parsed.type === 'product') {
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
        const imageUrl = parsed.productImage?.startsWith('http') 
          ? parsed.productImage 
          : `${API_BASE_URL}${parsed.productImage}`;
        
        return (
          <Card className="mb-0" style={{ maxWidth: '300px' }}>
            <Card.Img 
              variant="top" 
              src={imageUrl || 'https://via.placeholder.com/200'} 
              style={{ height: '150px', objectFit: 'cover' }}
            />
            <Card.Body className="p-2">
              <Card.Title style={{ fontSize: '14px', marginBottom: '0.5rem' }}>
                🛍️ {parsed.productName}
              </Card.Title>
              <Card.Text style={{ fontSize: '13px', marginBottom: '0.5rem', color: '#dc3545', fontWeight: 'bold' }}>
                💰 {Number(parsed.productPrice).toLocaleString('vi-VN')}₫
              </Card.Text>
              <Button 
                size="sm" 
                variant="primary" 
                href={parsed.productUrl} 
                target="_blank"
                style={{ fontSize: '12px' }}
              >
                Xem chi tiết
              </Button>
            </Card.Body>
          </Card>
        );
      }
    } catch (e) {
      // Not JSON or not product type, render as text
    }
    return msg.Message;
  };

  // Check if message contains product card (deprecated, use renderMessageContent)
  const isProductMessage = (message) => {
    return message && (message.includes('[PRODUCT_CARD]') || message.includes('[SẢN PHẨM]'));
  };

  // Parse and render product card
  const renderProductCard = (message) => {
    // New JSON format: [PRODUCT_CARD]{"name":"..","price":"..","image":"..","link":"..","id":..}[/PRODUCT_CARD]
    // Use more flexible regex to handle multiline and whitespace
    const jsonMatch = message.match(/\[PRODUCT_CARD\]\s*([\s\S]*?)\s*\[\/PRODUCT_CARD\]/);
    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[1].trim();
        const product = JSON.parse(jsonStr);
        return (
          <div className="admin-product-card">
            <div className="d-flex gap-2 p-2 bg-white rounded shadow-sm" style={{ maxWidth: 280 }}>
              {product.image && (
                <img 
                  src={product.image} 
                  alt={product.name} 
                  style={{ 
                    width: 60, 
                    height: 60, 
                    objectFit: 'cover', 
                    borderRadius: 8,
                    flexShrink: 0
                  }} 
                />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ 
                  fontWeight: 600, 
                  fontSize: 13, 
                  color: '#333',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {product.name}
                </div>
                <div style={{ color: '#dc3545', fontWeight: 600, fontSize: 14 }}>
                  {product.price}
                </div>
                <a 
                  href={product.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#007bff' }}
                >
                  Xem sản phẩm →
                </a>
              </div>
            </div>
          </div>
        );
      } catch (e) {
        console.error('Parse product card error:', e, jsonMatch[1]);
        // If JSON parse fails, show raw text
        return <span style={{ whiteSpace: 'pre-wrap' }}>{message}</span>;
      }
    }

    // Old text format (fallback)
    const nameMatch = message.match(/\[SẢN PHẨM\]\s*📦\s*(.+?)(?:\n|💰)/s);
    const priceMatch = message.match(/💰\s*Giá:\s*(.+?)(?:\n|🔗)/s);
    const linkMatch = message.match(/🔗\s*Xem:\s*(https?:\/\/[^\s\]]+)/);
    
    if (nameMatch) {
      return (
        <div className="admin-product-card">
          <div className="p-2 bg-white rounded shadow-sm" style={{ maxWidth: 250 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>📦 {nameMatch[1].trim()}</div>
            {priceMatch && <div style={{ color: '#dc3545', fontWeight: 600 }}>💰 {priceMatch[1].trim()}</div>}
            {linkMatch && (
              <a href={linkMatch[1]} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                🔗 Xem sản phẩm
              </a>
            )}
          </div>
        </div>
      );
    }

    return <span>{message}</span>;
  };

  return (
    <Container fluid className="py-3">
      <h2 className="mb-3"><FaComments className="me-2" />Quản lý Chat</h2>
      
      <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-3">
        <Tab eventKey="conversations" title="Hội thoại">
          <Row>
            {/* Conversation List */}
            <Col md={4}>
              <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <strong>Danh sách hội thoại</strong>
                  <Form.Select 
                    size="sm" 
                    style={{ width: 'auto' }}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Tất cả</option>
                    <option value="waiting">Chờ phản hồi</option>
                    <option value="open">Mới</option>
                    <option value="replied">Đã phản hồi</option>
                    <option value="closed">Đã đóng</option>
                  </Form.Select>
                </Card.Header>
                <Card.Body style={{ maxHeight: '60vh', overflowY: 'auto', padding: 0 }}>
                  {loading ? (
                    <div className="text-center py-4"><Spinner /></div>
                  ) : conversations.length === 0 ? (
                    <Alert variant="info" className="m-3">Không có hội thoại nào.</Alert>
                  ) : (
                    <div className="list-group list-group-flush">
                      {conversations.map(conv => (
                        <div
                          key={conv.ConversationID}
                          className={`list-group-item list-group-item-action ${selectedConversation?.ConversationID === conv.ConversationID ? 'active' : ''}`}
                          onClick={() => loadConversationDetail(conv)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <strong>{getCustomerInfo(conv)}</strong>
                              <br />
                              <small className="text-muted">{conv.Subject || 'Hỗ trợ chung'}</small>
                            </div>
                            <Badge bg={statusColors[conv.Status]}>{statusLabels[conv.Status]}</Badge>
                          </div>
                          <small className="text-muted d-block mt-1">
                            {formatTime(conv.LastMessageAt || conv.CreatedAt)}
                          </small>
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* Chat Detail */}
            <Col md={8}>
              <Card style={{ height: 'calc(70vh)' }}>
                {!selectedConversation ? (
                  <Card.Body className="d-flex align-items-center justify-content-center text-muted">
                    <div className="text-center">
                      <FaComments size={50} className="mb-3" />
                      <p>Chọn một hội thoại để xem chi tiết</p>
                    </div>
                  </Card.Body>
                ) : (
                  <>
                    <Card.Header className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{getCustomerInfo(selectedConversation)}</strong>
                        {selectedConversation.user?.Email && (
                          <small className="text-muted d-block">{selectedConversation.user.Email}</small>
                        )}
                        {selectedConversation.product && (
                          <small className="d-block">📦 {selectedConversation.product.Name}</small>
                        )}
                        {selectedConversation.order && (
                          <small className="d-block">🧾 Đơn #{selectedConversation.order.OrderID}</small>
                        )}
                      </div>
                      <div>
                        <Badge bg={statusColors[selectedConversation.Status]} className="me-2">
                          {statusLabels[selectedConversation.Status]}
                        </Badge>
                        {selectedConversation.Status !== 'closed' ? (
                          <Button variant="outline-danger" size="sm" onClick={handleCloseConversation}>
                            <FaTimes /> Đóng
                          </Button>
                        ) : (
                          <Button variant="outline-success" size="sm" onClick={handleReopenConversation}>
                            <FaComments /> Mở lại
                          </Button>
                        )}
                      </div>
                    </Card.Header>
                    
                    <Card.Body style={{ overflowY: 'auto', flex: 1 }}>
                      {detailLoading ? (
                        <div className="text-center py-4"><Spinner /></div>
                      ) : (
                        <div className="d-flex flex-column gap-2">
                          {messages.map((msg, idx) => (
                            <div
                              key={msg.MessageID || idx}
                              className={`p-2 rounded ${
                                msg.SenderType === 'admin' 
                                  ? 'bg-success text-white ms-auto' 
                                  : msg.SenderType === 'bot'
                                  ? 'bg-info text-white'
                                  : 'bg-light'
                              }`}
                              style={{ maxWidth: '80%', alignSelf: msg.SenderType === 'admin' ? 'flex-end' : 'flex-start' }}
                            >
                              <div className="d-flex align-items-center gap-1 mb-1" style={{ fontSize: '11px', opacity: 0.8 }}>
                                {getSenderIcon(msg.SenderType)}
                                <span>{msg.sender?.FullName || (msg.SenderType === 'bot' ? 'Bot' : 'Khách')}</span>
                                <span className="ms-auto">{formatTime(msg.CreatedAt)}</span>
                              </div>
                              <div style={{ whiteSpace: 'pre-wrap' }}>
                                {renderMessageContent(msg)}
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </Card.Body>

                    {selectedConversation.Status !== 'closed' && (
                      <Card.Footer>
                        <Form onSubmit={handleSendMessage} className="d-flex gap-2">
                          <Button 
                            variant="outline-info" 
                            onClick={() => setShowProductModal(true)}
                            title="Gửi sản phẩm"
                            type="button"
                          >
                            <FaBoxOpen />
                          </Button>
                          <Form.Control
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="Nhập tin nhắn..."
                            disabled={sending}
                          />
                          <Button type="submit" disabled={sending || !inputMessage.trim()}>
                            {sending ? <Spinner size="sm" /> : <FaPaperPlane />}
                          </Button>
                        </Form>
                      </Card.Footer>
                    )}
                  </>
                )}
              </Card>
            </Col>
          </Row>
        </Tab>

        <Tab eventKey="keywords" title="Từ khóa bị cấm">
          <Card>
            <Card.Header>
              <Form onSubmit={handleAddKeyword} className="d-flex gap-2">
                <Form.Control
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Nhập từ khóa cần chặn..."
                />
                <Button type="submit" variant="danger"><FaPlus /> Thêm</Button>
              </Form>
            </Card.Header>
            <Card.Body>
              {keywordsLoading ? (
                <div className="text-center"><Spinner /></div>
              ) : bannedKeywords.length === 0 ? (
                <Alert variant="info">Chưa có từ khóa nào bị cấm.</Alert>
              ) : (
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Từ khóa</th>
                      <th>Người tạo</th>
                      <th>Ngày tạo</th>
                      <th style={{ width: 100 }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bannedKeywords.map(kw => (
                      <tr key={kw.KeywordID}>
                        <td><code>{kw.Keyword}</code></td>
                        <td>{kw.creator?.Username || 'N/A'}</td>
                        <td>{formatTime(kw.CreatedAt)}</td>
                        <td>
                          <Button variant="outline-danger" size="sm" onClick={() => handleDeleteKeyword(kw.KeywordID)}>
                            <FaTrash />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              {keywordsTotalPages > 1 && (
                <div className="d-flex justify-content-center mt-3">
                  <Pagination>
                    <Pagination.Prev disabled={keywordsPage === 1} onClick={() => setKeywordsPage(p => Math.max(1, p - 1))} />
                    {[...Array(keywordsTotalPages)].map((_, i) => (
                      <Pagination.Item key={i + 1} active={i + 1 === keywordsPage} onClick={() => setKeywordsPage(i + 1)}>
                        {i + 1}
                      </Pagination.Item>
                    ))}
                    <Pagination.Next disabled={keywordsPage === keywordsTotalPages} onClick={() => setKeywordsPage(p => Math.min(keywordsTotalPages, p + 1))} />
                  </Pagination>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="autoreplies" title="Phản hồi tự động">
          <Card>
            <Card.Header className="d-flex justify-content-between">
              <strong>Cấu hình phản hồi tự động (Chatbot)</strong>
              <Button variant="primary" onClick={() => handleOpenReplyModal()}>
                <FaPlus /> Thêm mới
              </Button>
            </Card.Header>
            <Card.Body>
              {repliesLoading ? (
                <div className="text-center"><Spinner /></div>
              ) : autoReplies.length === 0 ? (
                <Alert variant="info">Chưa có phản hồi tự động nào.</Alert>
              ) : (
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Từ khóa kích hoạt</th>
                      <th>Phản hồi</th>
                      <th>Ưu tiên</th>
                      <th>Trạng thái</th>
                      <th style={{ width: 120 }}>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoReplies.map(reply => (
                      <tr key={reply.ReplyID}>
                        <td><code>{reply.TriggerKeywords}</code></td>
                        <td style={{ maxWidth: 300, whiteSpace: 'pre-wrap' }}>{reply.Response.substring(0, 100)}...</td>
                        <td>{reply.Priority}</td>
                        <td>
                          <Badge bg={reply.IsActive ? 'success' : 'secondary'}>
                            {reply.IsActive ? 'Hoạt động' : 'Tắt'}
                          </Badge>
                        </td>
                        <td>
                          <Button variant="outline-primary" size="sm" className="me-1" onClick={() => handleOpenReplyModal(reply)}>
                            <FaEdit />
                          </Button>
                          <Button variant="outline-danger" size="sm" onClick={() => handleDeleteReply(reply.ReplyID)}>
                            <FaTrash />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              {repliesTotalPages > 1 && (
                <div className="d-flex justify-content-center mt-3">
                  <Pagination>
                    <Pagination.Prev disabled={repliesPage === 1} onClick={() => setRepliesPage(p => Math.max(1, p - 1))} />
                    {[...Array(repliesTotalPages)].map((_, i) => (
                      <Pagination.Item key={i + 1} active={i + 1 === repliesPage} onClick={() => setRepliesPage(i + 1)}>
                        {i + 1}
                      </Pagination.Item>
                    ))}
                    <Pagination.Next disabled={repliesPage === repliesTotalPages} onClick={() => setRepliesPage(p => Math.min(repliesTotalPages, p + 1))} />
                  </Pagination>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Auto Reply Modal */}
      <Modal show={showReplyModal} onHide={() => setShowReplyModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingReply ? 'Sửa phản hồi tự động' : 'Thêm phản hồi tự động'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveReply}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Từ khóa kích hoạt (phân cách bằng dấu phẩy)</Form.Label>
              <Form.Control
                type="text"
                value={replyForm.triggerKeywords}
                onChange={(e) => setReplyForm({ ...replyForm, triggerKeywords: e.target.value })}
                placeholder="VD: xin chào, hello, hi"
                required
              />
              <Form.Text className="text-muted">
                Bot sẽ trả lời khi tin nhắn chứa một trong các từ khóa này.
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Nội dung phản hồi</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={replyForm.response}
                onChange={(e) => setReplyForm({ ...replyForm, response: e.target.value })}
                placeholder="Nội dung bot sẽ trả lời..."
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Độ ưu tiên (số lớn = ưu tiên cao)</Form.Label>
              <Form.Control
                type="number"
                value={replyForm.priority}
                onChange={(e) => setReplyForm({ ...replyForm, priority: parseInt(e.target.value) || 0 })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowReplyModal(false)}>Hủy</Button>
            <Button variant="primary" type="submit">Lưu</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Product Search Modal */}
      <Modal show={showProductModal} onHide={() => { 
        setShowProductModal(false); 
        setProductSearch(''); 
        setSearchedProducts([]); 
        setProductCategory('');
        setProductTargetGroup('');
        setProductSort('');
        setProductPage(1);
      }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Chọn sản phẩm để gửi {productTotal > 0 && `(${productTotal} kết quả)`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {/* Search & Filters */}
          <Row className="mb-3">
            <Col md={12}>
              <InputGroup className="mb-2">
                <Form.Control
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Tìm theo tên sản phẩm..."
                  onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchProducts(true); } }}
                />
                <Button onClick={() => handleSearchProducts(true)} disabled={productSearchLoading}>
                  {productSearchLoading ? <Spinner size="sm" /> : 'Tìm'}
                </Button>
              </InputGroup>
            </Col>
          </Row>
          
          <Row className="mb-3">
            <Col md={4}>
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
            </Col>
            <Col md={4}>
              <Form.Select 
                size="sm" 
                value={productTargetGroup} 
                onChange={(e) => { setProductTargetGroup(e.target.value); setProductPage(1); }}
              >
                <option value="">Tất cả đối tượng</option>
                <option value="Men">Nam</option>
                <option value="Women">Nữ</option>
                <option value="Unisex">Unisex</option>
              </Form.Select>
            </Col>
            <Col md={4}>
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
            </Col>
          </Row>

          {productSearchLoading ? (
            <div className="text-center py-4"><Spinner /></div>
          ) : searchedProducts.length > 0 ? (
            <>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {searchedProducts.map(product => (
                  <Card key={product.ProductID} className="mb-2">
                    <Card.Body className="d-flex align-items-center gap-3">
                      <Image 
                        src={product.DefaultImage || 'https://via.placeholder.com/80'} 
                        style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
                      />
                      <div className="flex-grow-1">
                        <h6 className="mb-1">{product.Name}</h6>
                        <p className="mb-0 text-muted">{Number(product.Price).toLocaleString('vi-VN')}₫</p>
                      </div>
                      <Button variant="primary" size="sm" onClick={() => handleSendProduct(product)}>
                        Gửi
                      </Button>
                    </Card.Body>
                  </Card>
                ))}
              </div>
              
              {productTotalPages > 1 && (
                <div className="d-flex justify-content-center mt-3">
                  <Pagination size="sm">
                    <Pagination.Prev disabled={productPage === 1} onClick={() => setProductPage(p => Math.max(1, p - 1))} />
                    {[...Array(Math.min(5, productTotalPages))].map((_, i) => {
                      const pageNum = productPage <= 3 ? i + 1 : productPage - 2 + i;
                      if (pageNum > productTotalPages) return null;
                      return (
                        <Pagination.Item key={pageNum} active={pageNum === productPage} onClick={() => setProductPage(pageNum)}>
                          {pageNum}
                        </Pagination.Item>
                      );
                    })}
                    <Pagination.Next disabled={productPage === productTotalPages} onClick={() => setProductPage(p => Math.min(productTotalPages, p + 1))} />
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <Alert variant="info">Không tìm thấy sản phẩm nào.</Alert>
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
}
