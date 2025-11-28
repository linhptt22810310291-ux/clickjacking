import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../redux/reducers/authSlice';
import api from '../api/api';
import './SecurityDashboard.css';

const SecurityDashboard = () => {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isAdmin = isAuthenticated && user?.role === 'admin';

  const [stats, setStats] = useState(null);
  const [recentAttacks, setRecentAttacks] = useState([]);
  const [logFiles, setLogFiles] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [logContent, setLogContent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-refresh stats mỗi 5 giây
  useEffect(() => {
    if (!isAdmin) return;

    const fetchStats = async () => {
      try {
        const response = await api.get('/security/stats');
        setStats(response.data.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // Fetch recent attacks
  useEffect(() => {
    if (!isAdmin) return;

    const fetchRecentAttacks = async () => {
      try {
        const response = await api.get('/security/recent-attacks');
        setRecentAttacks(response.data.data.attacks || []);
      } catch (err) {
        console.error('Failed to fetch recent attacks:', err);
      }
    };

    fetchRecentAttacks();
    const interval = setInterval(fetchRecentAttacks, 10000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // Fetch log files
  useEffect(() => {
    if (!isAdmin) return;

    const fetchLogFiles = async () => {
      try {
        const response = await api.get('/security/logs');
        setLogFiles(response.data.data.files || []);
      } catch (err) {
        console.error('Failed to fetch log files:', err);
      }
    };

    fetchLogFiles();
  }, [isAdmin]);

  // View log file
  const viewLogFile = async (filename) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/security/logs/${filename}`, {
        params: { limit: 100 }
      });
      setSelectedLog(filename);
      setLogContent(response.data.data.logs || []);
    } catch (err) {
      setError('Failed to load log file');
      console.error('Failed to load log file:', err);
    } finally {
      setLoading(false);
    }
  };

  // Clear blacklist
  const clearBlacklist = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa toàn bộ IP blacklist?')) return;

    try {
      await api.post('/security/clear-blacklist', {});
      alert('Blacklist cleared successfully!');
      // Refresh stats
      window.location.reload();
    } catch (err) {
      alert('Failed to clear blacklist');
      console.error('Failed to clear blacklist:', err);
    }
  };

  if (!isAuthenticated) {
    return <div className="security-dashboard-access-denied">Please login to view this page.</div>;
  }

  if (!isAdmin) {
    return <div className="security-dashboard-access-denied">⛔ Admin access required</div>;
  }

  return (
    <div className="security-dashboard">
      <div className="security-header">
        <h1>🛡️ Security Dashboard</h1>
        <p className="security-subtitle">Cloudflare-style Bot Attack Monitoring</p>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-attacks">
          <div className="stat-icon">🚨</div>
          <div className="stat-content">
            <h3>Total Bot Attacks</h3>
            <p className="stat-value">{stats?.totalBotAttacks || 0}</p>
          </div>
        </div>

        <div className="stat-card stat-blocked">
          <div className="stat-icon">🚫</div>
          <div className="stat-content">
            <h3>Blocked IPs</h3>
            <p className="stat-value">{stats?.blockedCount || 0}</p>
          </div>
        </div>

        <div className="stat-card stat-recent">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <h3>Recent Attacks</h3>
            <p className="stat-value">{recentAttacks.length}</p>
          </div>
        </div>

        <div className="stat-card stat-logs">
          <div className="stat-icon">📄</div>
          <div className="stat-content">
            <h3>Log Files</h3>
            <p className="stat-value">{logFiles.length}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="dashboard-actions">
        <button className="btn-clear-blacklist" onClick={clearBlacklist}>
          🗑️ Clear Blacklist
        </button>
      </div>

      {/* Blocked IPs */}
      {stats && stats.blockedIPs.length > 0 && (
        <div className="section blocked-ips-section">
          <h2>🚫 Blocked IP Addresses</h2>
          <div className="blocked-ips-list">
            {stats.blockedIPs.map((ip, index) => (
              <div key={index} className="blocked-ip-item">
                <span className="ip-address">{ip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Attacks */}
      <div className="section recent-attacks-section">
        <h2>⚡ Recent Bot Attacks</h2>
        {recentAttacks.length === 0 ? (
          <p className="no-data">No attacks detected recently</p>
        ) : (
          <div className="attacks-table-container">
            <table className="attacks-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>IP Address</th>
                  <th>Reason</th>
                  <th>Endpoint</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentAttacks.slice(0, 20).map((attack, index) => (
                  <tr key={index}>
                    <td>{new Date(attack.timestamp).toLocaleString()}</td>
                    <td className="ip-cell">{attack.ip}</td>
                    <td>{attack.reason}</td>
                    <td className="endpoint-cell">{attack.endpoint}</td>
                    <td>
                      <span className={`action-badge action-${attack.action?.toLowerCase()}`}>
                        {attack.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Files */}
      <div className="section log-files-section">
        <h2>📄 Log Files</h2>
        {logFiles.length === 0 ? (
          <p className="no-data">No log files available</p>
        ) : (
          <div className="log-files-grid">
            {logFiles.map((file, index) => (
              <div
                key={index}
                className={`log-file-card ${selectedLog === file.filename ? 'active' : ''}`}
                onClick={() => viewLogFile(file.filename)}
              >
                <div className="log-file-name">{file.filename}</div>
                <div className="log-file-info">
                  <span>Size: {(file.size / 1024).toFixed(2)} KB</span>
                  <span>Modified: {new Date(file.modified).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Content Viewer */}
      {selectedLog && (
        <div className="section log-viewer-section">
          <h2>📖 Log Content: {selectedLog}</h2>
          {loading ? (
            <p className="loading">Loading log content...</p>
          ) : error ? (
            <p className="error">{error}</p>
          ) : (
            <div className="log-content-container">
              <table className="log-content-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Level</th>
                    <th>Message</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logContent.map((log, index) => (
                    <tr key={index} className={`log-level-${log.level || 'info'}`}>
                      <td className="log-time">{new Date(log.timestamp).toLocaleString()}</td>
                      <td>
                        <span className={`log-level-badge level-${log.level || 'info'}`}>
                          {(log.level || 'INFO').toUpperCase()}
                        </span>
                      </td>
                      <td className="log-message">{log.message}</td>
                      <td className="log-meta">
                        {log.ip && <span className="meta-item">IP: {log.ip}</span>}
                        {log.reason && <span className="meta-item">Reason: {log.reason}</span>}
                        {log.endpoint && <span className="meta-item">Endpoint: {log.endpoint}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SecurityDashboard;
