// src/App.js
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ToastContainer } from "react-toastify";

// Import action và selectors từ userSlice
import {
  loadUserFromToken,
  selectIsAuthenticated,
  selectUser,
  selectUserStatus,
} from "./redux/userSlice";

// Layouts
import UserLayout from "./components/layout/user/UserLayout";
import AdminLayout from "./components/layout/admin/AdminLayout";

// User Pages
import Home from "./pages/user/Home";
import Login from "./pages/user/Login";
import Register from "./pages/user/Register";
import VerifyEmail from "./pages/user/VerifyEmail";
import ForgotPassword from "./pages/user/ForgotPassword";
import ResetPassword from "./pages/user/ResetPassword";
import ProductList from "./pages/user/ProductList";
import ProductDetail from "./pages/user/ProductDetail";
import Cart from "./pages/user/Cart";
import Checkout from "./pages/user/Checkout";
import Profile from "./pages/user/Profile";
import BlogList from "./pages/user/BlogList";
import BlogDetail from "./pages/user/BlogDetail";
import About from "./pages/user/About";
import Contact from "./pages/user/Contact";
import OrderLookup from "./pages/user/OrderLookup";
import PaymentResult from "./pages/user/PaymentResult";
import VoucherStore from "./pages/user/VoucherStore"; // ✅ THÊM LẠI
import BotAttackMonitor from "./components/BotAttackMonitor"; // 🛡️ MONITOR BOT ATTACKS

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminBlogs from "./pages/admin/AdminBlogs";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminCoupon from "./pages/admin/AdminCoupon";
import PaymentMethods from "./pages/admin/PaymentMethods";
import SecurityMonitor from "./pages/admin/SecurityMonitor"; // 🛡️ Security Dashboard

// Component bảo vệ route
const PrivateRoute = ({ children, isAdmin = false }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const userStatus = useSelector(selectUserStatus);
  const location = useLocation();

  // Chỉ chờ trong lúc ĐANG load user
  if (userStatus === "loading") {
    return <div style={{ padding: 16 }}>Đang tải...</div>;
  }

  // Nếu chưa đăng nhập → chuyển về login kèm redirect
  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // Nếu là route admin mà role không phải admin → về trang chủ
  if (isAdmin && user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  const dispatch = useDispatch();

  // Khi app khởi động, thử nạp user từ token trong localStorage
  useEffect(() => {
    dispatch(loadUserFromToken());
  }, [dispatch]);

  return (
    <>
      {/* 🛡️ Bot Attack Monitor - TEMPORARILY DISABLED for debugging */}
      {/* <BotAttackMonitor /> */}
      
      <Routes>
        {/* Auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* User routes với layout chung */}
        <Route path="/" element={<UserLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<ProductList />} />
          <Route path="product/:id" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="payment-result" element={<PaymentResult />} />
          <Route path="order-lookup" element={<OrderLookup />} />
          <Route path="blogs" element={<BlogList />} />
          <Route path="blog/:id" element={<BlogDetail />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />

          {/* Route cần đăng nhập */}
          <Route
            path="profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          {/* ✅ Thêm lại route Kho Voucher riêng */}
          <Route
            path="vouchers"
            element={
              <PrivateRoute>
                <VoucherStore />
              </PrivateRoute>
            }
          />
        </Route>

        {/* Admin routes (cần login + role admin) */}
        <Route
          path="/admin"
          element={
            <PrivateRoute isAdmin={true}>
              <AdminLayout />
            </PrivateRoute>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="blogs" element={<AdminBlogs />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="coupons" element={<AdminCoupon />} />
          <Route path="payment-methods" element={<PaymentMethods />} />
          <Route path="security" element={<SecurityMonitor />} />
          {/* Mặc định /admin → dashboard */}
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
        </Route>

        {/* Fallback: route không khớp → về trang chủ */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Toast dùng chung toàn app */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </>
  );
}

export default App;
