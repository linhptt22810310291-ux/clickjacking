import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../redux/userSlice';
import axios from 'axios';
import './BotAttackMonitor.css';

/**
 * Component hiển thị cảnh báo khi có bot attack
 * ❌ DISABLED - Không hiển thị thông báo cho admin
 * Chỉ log trong F12 console để debug
 */
const BotAttackMonitor = () => {
  const [botStats, setBotStats] = useState(null);
  
  // Lấy thông tin user từ Redux
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  
  // Kiểm tra xem user có phải admin không
  const isAdmin = isAuthenticated && user?.role === 'admin';

  useEffect(() => {
    // ❌ Nếu không phải admin → Không chạy monitor
    if (!isAdmin) {
      return;
    }
    
    console.log('%c🛡️ BOT ATTACK MONITOR STARTED (ADMIN MODE)', 'background: #4CAF50; color: white; padding: 5px; font-weight: bold;');
    
    // Poll API mỗi 3 giây để cập nhật real-time
    const interval = setInterval(async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/bot-stats');
        if (response.data.success) {
          const stats = response.data.data;
          
          // 🎯 LOG CHI TIẾT - Xem trong F12 (chỉ admin thấy)
          if (stats.blockedCount > 0) {
            console.log('%c⚠️ BOT ATTACK DETECTED!', 'background: #ff0000; color: white; padding: 10px; font-size: 16px; font-weight: bold;');
            console.table({
              'Số IP đang theo dõi': stats.activeTracking,
              'Số bot bị chặn': stats.blockedCount,
              'Thời gian': new Date().toLocaleTimeString()
            });
            console.log('📋 Danh sách IPs bị chặn:', stats.blockedIPs);
            console.log('⚙️ Cấu hình bảo mật:', stats.config);
          } else {
            console.log('%c✅ Hệ thống an toàn', 'color: green; font-weight: bold;', {
              activeTracking: stats.activeTracking,
              time: new Date().toLocaleTimeString()
            });
          }
          
          setBotStats(stats);
        }
      } catch (error) {
        console.error('❌ Error fetching bot stats:', error);
      }
    }, 3000);

    return () => {
      console.log('%c🛡️ BOT ATTACK MONITOR STOPPED', 'background: #f44336; color: white; padding: 5px;');
      clearInterval(interval);
    };
  }, [isAdmin]); // Chạy lại nếu isAdmin thay đổi

  // ❌ KHÔNG HIỂN THỊ THÔNG BÁO - Chỉ log trong console
  return null;
};

export default BotAttackMonitor;
