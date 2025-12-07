import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import "../../../styles/components/Sidebar.css"; // Giữ nguyên file CSS của bạn

// Import selector đã tạo để lấy user
import { selectUser } from "../../../redux/userSlice";

const Sidebar = () => {
  // Lấy đúng object user từ Redux state
  const user = useSelector(selectUser); 
  const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  // Sử dụng avatar từ user.avatar, fallback về default nếu không có
  const avatarUrl = user?.avatar || defaultAvatar;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <img
          src={avatarUrl}
          alt="avatar"
          onError={(e) => { e.target.src = defaultAvatar; }}
        />
        {/* Lấy username từ user.username */}
        <h4>{user?.username || "Admin"}</h4> 
      </div>
      <div className="sidebar-menu">
        <ul>
          <li><NavLink to="/admin/dashboard">Tổng quan</NavLink></li>
          <li><NavLink to="/admin/users">Quản lý người dùng</NavLink></li>
          <li><NavLink to="/admin/products">Quản lý sản phẩm</NavLink></li>
          <li><NavLink to="/admin/categories">Quản lý danh mục</NavLink></li>
          <li><NavLink to="/admin/orders">Quản lý đơn hàng</NavLink></li>
          <li><NavLink to="/admin/payment-methods">Quản lý PTTT</NavLink></li>
          <li><NavLink to="/admin/blogs">Quản lý tin tức</NavLink></li>
          <li><NavLink to="/admin/reviews">Quản lý đánh giá</NavLink></li>
          <li><NavLink to="/admin/coupons">Quản lý khuyến mãi</NavLink></li>
          <li><NavLink to="/admin/chat">💬 Quản lý Chat</NavLink></li>
          <li><NavLink to="/admin/security">🛡️ Bảo mật</NavLink></li>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;