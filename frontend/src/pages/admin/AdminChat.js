import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Form, InputGroup, Spinner, Alert, Tab, Tabs, Modal } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FaComments, FaUser, FaRobot, FaHeadset, FaPaperPlane, FaTimes, FaPlus, FaTrash, FaEdit } from 'react-icons/fa';
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
  deleteAutoReplyAPI
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
  
  // Auto replies state
  const [autoReplies, setAutoReplies] = useState([]);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [editingReply, setEditingReply] = useState(null);
  const [replyForm, setReplyForm] = useState({ triggerKeywords: '', response: '', priority: 0 });
  const [repliesLoading, setRepliesLoading] = useState(false);
  
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

  // === Banned Keywords ===
  const loadBannedKeywords = async () => {
    setKeywordsLoading(true);
    try {
      const { data } = await getBannedKeywordsAPI();
      setBannedKeywords(data || []);
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
      const { data } = await getAutoRepliesAPI();
      setAutoReplies(data || []);
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
                                {msg.IsBlocked ? <em>[Đã lọc]</em> : msg.Message}
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
    </Container>
  );
}
