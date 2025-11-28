import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Alert } from 'react-bootstrap';
import axios from 'axios';
import '../../styles/components/SecurityMonitor.css';

// Determine API URL based on environment
const getApiBaseUrl = () => {
    // Check if running on Render (production)
    if (window.location.hostname.includes('onrender.com')) {
        return 'https://clickjacking-backend.onrender.com';
    }
    // Use environment variable or fallback to localhost
    return process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
};

const API_BASE_URL = getApiBaseUrl();

const SecurityMonitor = () => {
  const [stats, setStats] = useState({
    totalBotAttacks: 0,
    blockedIPs: [],
    blockedCount: 0,
    timestamp: null
  });
  
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Fetch security stats
  const fetchStats = async () => {
    try {
      // Không cần token nữa - trang công khai
      const response = await axios.get(`${API_BASE_URL}/api/security/stats`);
      
      if (response.data.success) {
        setStats(response.data.data);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
      setError('Không thể tải thống kê bảo mật');
    }
  };

  // Fetch recent logs
  const fetchLogs = async () => {
    try {
      // Không cần token nữa - trang công khai
      const response = await axios.get(`${API_BASE_URL}/api/security/recent-attacks?limit=20`);
      
      if (response.data.success) {
        setRecentLogs(response.data.data.attacks || []);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchLogs()]);
      setLoading(false);
    };
    
    loadData();
  }, []);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      fetchLogs();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <h4>Đang tải Security Monitor...</h4>
      </Container>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* Simple Header */}
      <div style={{ 
        background: 'rgba(255,255,255,0.95)', 
        padding: '15px 0', 
        borderBottom: '2px solid #667eea',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <Container>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#667eea' }}>
              🛡️ Security Monitor - Theo dõi Tấn công Real-time
            </h3>
            <a href="/" style={{ 
              padding: '8px 20px', 
              background: '#667eea', 
              color: 'white', 
              textDecoration: 'none', 
              borderRadius: '5px',
              fontWeight: 'bold'
            }}>
              ← Về trang chủ
            </a>
          </div>
        </Container>
      </div>

      <Container fluid className="security-monitor mt-4" style={{ paddingBottom: '50px' }}>
      <Row className="mb-4">
        <Col>
          <h2>🛡️ Security Dashboard - Real-time Bot Detection</h2>
          <p className="text-muted">
            Cập nhật lần cuối: {lastUpdate.toLocaleTimeString('vi-VN')}
          </p>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Row className="mb-4">
        <Col md={4}>
          <Card className="stat-card attack-card">
            <Card.Body>
              <div className="stat-icon">🚨</div>
              <h3>{stats.totalBotAttacks}</h3>
              <p>Tổng Bot Attacks</p>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={4}>
          <Card className="stat-card blocked-card">
            <Card.Body>
              <div className="stat-icon">🛡️</div>
              <h3>{stats.blockedCount}</h3>
              <p>IPs bị chặn</p>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={4}>
          <Card className="stat-card status-card">
            <Card.Body>
              <div className="stat-icon">✅</div>
              <h3>ACTIVE</h3>
              <p>Hệ thống phòng thủ</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Blocked IPs Table */}
      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Header>
              <h5>🔒 Danh sách IPs bị chặn</h5>
            </Card.Header>
            <Card.Body>
              {stats.blockedIPs.length === 0 ? (
                <Alert variant="success">
                  ✅ Không có IP nào bị chặn. Hệ thống an toàn!
                </Alert>
              ) : (
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>IP Address</th>
                      <th>Trạng thái</th>
                      <th>Thời gian chặn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.blockedIPs.map((ip, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td><code>{ip}</code></td>
                        <td>
                          <Badge bg="danger">BLOCKED</Badge>
                        </td>
                        <td>-</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Attack Logs */}
      <Row>
        <Col>
          <Card>
            <Card.Header>
              <h5>📋 Logs tấn công gần đây (Real-time)</h5>
            </Card.Header>
            <Card.Body>
              {recentLogs.length === 0 ? (
                <Alert variant="info">
                  📌 Chưa có logs tấn công nào. Hệ thống đang hoạt động bình thường.
                </Alert>
              ) : (
                <div className="logs-container">
                  {recentLogs.map((log, index) => (
                    <div key={index} className={`log-entry ${log.action || 'warning'}`}>
                      <span className="log-timestamp">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : '-'}
                      </span>
                      <span className="log-level">
                        <Badge bg={log.action === 'BLOCKED' ? 'danger' : 'warning'}>
                          {log.action || log.type || 'ALERT'}
                        </Badge>
                      </span>
                      <span className="log-message">
                        🚨 {log.reason || 'Rate limit exceeded'} - IP: {log.ip || 'N/A'} on {log.endpoint || '/'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

    </Container>
    </div>
  );
};

export default SecurityMonitor;
