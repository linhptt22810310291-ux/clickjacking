import api from './api'; // Import instance axios đã cấu hình

// --- Helper ---
const getSessionId = () => localStorage.getItem('guest_session_id');
const getHeaders = () => {
    const sessionId = getSessionId();
    if (!localStorage.getItem('token') && sessionId) {
        return { 'X-Session-ID': sessionId };
    }
    return {};
};

// =============================================
// ===          API CHO USER & PUBLIC         ===
// =============================================

// --- Auth ---
export const loginAPI = (credentials) => {
    console.log('📡 loginAPI called with:', { ...credentials, password: credentials.password ? `***${credentials.password.length}chars` : 'MISSING' });
    // withCredentials: true để gửi session cookie cho CAPTCHA verification
    return api.post('/auth/login', credentials, { withCredentials: true });
};
export const registerAPI = (userData) => api.post('/auth/register', userData);
export const verifyEmailAPI = (payload) => api.post('/auth/verify-email', payload);
export const resendVerificationEmailAPI = (payload) => api.post('/auth/resend-verification-email', payload);

// --- Security ---
export const getCaptchaAPI = () => api.get('/captcha', { responseType: 'text', withCredentials: true });

// toggleUser2FAAPI (Admin toggle 2FA cho user)
export const toggleUser2FAAPI = (userId, enabled) =>
    api.post(`/admin/users/${userId}/toggle-2fa`, { enabled });

// --- Password ---
export const requestOtpAPI = (email) => api.post('/password/forgot', { email });
export const resetPasswordAPI = (payload) => api.post('/password/reset', payload);
export const changePasswordAPI = (passwordData) => api.put('/password', passwordData);

// --- Home ---
export const getHomeDataAPI = () => api.get('/home');

// --- Products (User) ---
export const getProductsAPI = (params) => api.get('/products', { params });
export const getProductDetailAPI = (productId) => api.get(`/products/${productId}`);
export const getProductVariantsAPI = (productId) =>
    api.get(`/products/${productId}/variants`);

// === Đánh giá sản phẩm (Reviews – User) ===
export const getProductReviewsAPI = (productId, params) =>
    api.get(`/products/${productId}/reviews`, { params });

export const checkReviewEligibilityAPI = (productId, orderId) =>
  api.get(`/products/${productId}/check-review`, { params: { orderId } });


export const createReviewAPI = (productId, formData) =>
    api.post(`/products/${productId}/reviews`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

// --- Blogs (User) ---
export const getBlogsAPI = (params) => api.get('/blogs', { params });
export const getBlogByIdAPI = (id) => api.get(`/blogs/${id}`);

// --- Cart ---
export const getCartAPI = () => api.get('/cart', { headers: getHeaders() });

export const addToCartAPI = ({ variantId, quantity }) =>
    api.post(
        '/cart/add',
        { variantId, quantity },
        { headers: getHeaders() }
    );

export const updateCartItemAPI = ({ cartItemId, quantity }) =>
    api.patch(
        `/cart/item/${cartItemId}`,
        { quantity },
        { headers: getHeaders() }
    );

export const removeCartItemAPI = (cartItemId) =>
    api.delete(`/cart/item/${cartItemId}`, { headers: getHeaders() });

// --- Wishlist ---
export const getWishlistIdsAPI = () => api.get('/wishlist');
export const toggleWishlistAPI = (productId) =>
    api.post('/wishlist/toggle', { productId });

// --- Shipping & Addresses (User) ---
export const getShippingProvidersAPI = () => api.get('/shipping/providers');
export const getAddressesAPI = () => api.get('/addresses');
export const createAddressAPI = (addressData) => api.post('/addresses', addressData);
export const updateAddressAPI = (id, addressData) =>
    api.patch(`/addresses/${id}`, addressData);
export const deleteAddressAPI = (id) => api.delete(`/addresses/${id}`);
export const setDefaultAddressAPI = (id) =>
    api.patch(`/addresses/${id}/default`);

// --- Profile & User Orders ---
export const getProfileAPI = () => api.get('/profile');
export const updateProfileAPI = (formData) =>
    api.put('/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

export const getUserOrdersAPI = (params) =>
    api.get('/profile/orders', { params });

export const getOrderDetailAPI = (orderId) =>
    api.get(`/profile/orders/${orderId}`);

export const cancelOrderAPI = (orderId) =>
    api.put(`/profile/orders/${orderId}/cancel`);

export const getPaginatedWishlistAPI = (params) =>
    api.get('/profile/wishlist', { params });

// --- Guest Orders ---
export const lookupGuestOrdersAPI = (credentials) =>
    api.post('/guest-history/lookup', credentials);

export const getGuestOrderDetailAPI = (orderId) =>
    api.get(`/guest-history/${orderId}`);

export const cancelGuestOrderAPI = (orderId) =>
    api.post(`/guest-history/${orderId}/cancel`);

export const placeUserOrderAPI = (orderData) =>
    api.post('/user/orders/place', orderData);

export const placeGuestOrderAPI = (orderData) =>
    api.post('/guest-orders/place', orderData, {
        headers: { 'X-Session-ID': getSessionId() },
    });

// Thanh toán lại VNPAY cho Guest
export const retryGuestVnpayPaymentAPI = (orderId) =>
    api.post(`/guest-orders/${orderId}/pay`);

// --- Coupons (User / Vouchers) ---
export const getAvailableCouponsAPI = () => api.get('/user/coupons');

export const validateCouponAPI = (payload) =>
    api.post('/user/coupons/validate', payload);

export const getUserVouchersAPI = () =>
    api.get('/user/coupons/vouchers');

// Kho voucher có thể sưu tầm
export const getCollectibleVouchersAPI = () =>
    api.get('/user/coupons/collectible');

// Claim voucher bằng code
export const claimVoucherAPI = (code) =>
    api.post('/user/coupons/claim', { code });

// --- Payment Methods (User) ---
export const getPaymentMethodsAPI = () => api.get('/payment-methods');

// =============================================
// ===            API CHO ADMIN             ===
// =============================================

// --- Dashboard ---
export const getDashboardStatsAPI = () => api.get('/admin/home');
export const getPaginatedTopProductsAPI = (params) =>
    api.get('/admin/home/top-products', { params });
export const getPaginatedLowStockAPI = (params) =>
    api.get('/admin/home/low-stock', { params });

// --- Users (Admin) ---
export const getUsersAdminAPI = (params) =>
    api.get('/admin/users', { params });

export const getUserByIdAdminAPI = (id) =>
    api.get(`/admin/users/${id}`);

export const createUserAPI = (formData) =>
    api.post('/admin/users', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

export const updateUserAPI = (id, formData) =>
    api.put(`/admin/users/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

export const deleteUserAPI = (id) =>
    api.delete(`/admin/users/${id}`);

export const resetPasswordByAdminAPI = (id, newPassword) =>
    api.post(`/admin/users/${id}/reset-password`, { newPassword });

// --- Categories (Admin) ---
export const getCategoriesAdminAPI = (params) =>
    api.get('/admin/categories', { params });

// Danh sách category đơn giản (ví dụ dùng cho select box)
export const getCategoryListAPI = () =>
    api.get('/admin/categories/list');

export const getCategoryByIdAPI = (id) =>
    api.get(`/admin/categories/${id}`);

export const createCategoryAPI = (categoryData) =>
    api.post('/admin/categories', categoryData);

export const updateCategoryAPI = (id, categoryData) =>
    api.put(`/admin/categories/${id}`, categoryData);

export const deleteCategoryAPI = (id) =>
    api.delete(`/admin/categories/${id}`);

export const toggleCategoryStatusAPI = (id) =>
    api.put(`/admin/categories/${id}/toggle`);

// --- Products (Admin) ---
export const getProductsAdminAPI = (params) =>
    api.get('/admin/products', { params });

export const getProductByIdAdminAPI = (id) =>
    api.get(`/admin/products/${id}`);

export const createProductAPI = (formData) =>
    api.post('/admin/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

export const updateProductAPI = (id, formData) =>
    api.put(`/admin/products/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

export const deleteProductAdminAPI = (id) =>
    api.delete(`/admin/products/${id}`);

// --- Orders (Admin) ---
export const getAdminOrdersAPI = (params) =>
    api.get('/admin/orders', { params });

export const getAdminOrderDetailAPI = (type, id) =>
    api.get(`/admin/orders/${type}/${id}`);

export const updateAdminOrderStatusAPI = (type, id, status) =>
    api.put(`/admin/orders/${type}/${id}/status`, { Status: status });

export const updateAdminTrackingAPI = (type, id, trackingData) =>
    api.put(`/admin/orders/${type}/${id}/tracking`, trackingData);

// --- Blogs (Admin) ---
export const getBlogsAdminAPI = (params) =>
    api.get('/admin/blogs', { params });

export const getBlogByIdAdminAPI = (id) =>
    api.get(`/admin/blogs/${id}`);

export const createBlogAPI = (formData) =>
    api.post('/admin/blogs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

export const updateBlogAPI = (id, formData) =>
    api.put(`/admin/blogs/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

export const deleteBlogAPI = (id) =>
    api.delete(`/admin/blogs/${id}`);

// --- Coupons (Admin) ---
export const getCouponsAdminAPI = (params) =>
    api.get('/admin/coupons', { params });

export const createCouponAPI = (couponData) =>
    api.post('/admin/coupons', couponData);

export const updateCouponAPI = (id, couponData) =>
    api.put(`/admin/coupons/${id}`, couponData);

export const deleteCouponAPI = (id) =>
    api.delete(`/admin/coupons/${id}`);

export const getCouponUsageAPI = (id) =>
    api.get(`/admin/coupons/${id}/usage`);

export const getCustomerEmailsAPI = () =>
    api.get('/admin/coupons/emails');

export const sendCouponEmailAPI = (payload) =>
    api.post('/admin/coupons/send-email', payload);

export const getCouponAssignmentsAPI = (id) =>
    api.get(`/admin/coupons/${id}/assignments`);

// --- Payment Methods (Admin) ---
export const getAdminPaymentMethodsAPI = (params) =>
    api.get('/admin/payment-methods', { params });

export const createPaymentMethodAPI = (data) =>
    api.post('/admin/payment-methods', data);

export const updatePaymentMethodAPI = (id, data) =>
    api.put(`/admin/payment-methods/${id}`, data);

export const deletePaymentMethodAPI = (id) =>
    api.delete(`/admin/payment-methods/${id}`);

// --- Reviews (Admin) ---
export const getReviewsAdminAPI = (params) =>
    api.get('/admin/reviews', { params });

export const getReviewByIdAdminAPI = (id) =>
    api.get(`/admin/reviews/${id}`);

export const deleteReviewAPI = (id) =>
    api.delete(`/admin/reviews/${id}`);

// =============================================
// ===            CHAT API                   ===
// =============================================

// --- Chat (User/Guest) ---
export const startChatConversationAPI = (data) =>
    api.post('/chat/conversations', data);

export const sendChatMessageAPI = (conversationId, data) =>
    api.post(`/chat/conversations/${conversationId}/messages`, data);

export const getChatMessagesAPI = (conversationId, params) =>
    api.get(`/chat/conversations/${conversationId}/messages`, { params });

export const requestHumanSupportAPI = (conversationId, data) =>
    api.post(`/chat/conversations/${conversationId}/request-human`, data);

// --- Chat (Admin) ---
export const getAdminChatConversationsAPI = (params) =>
    api.get('/admin/chat/conversations', { params });

export const getAdminChatConversationDetailAPI = (id) =>
    api.get(`/admin/chat/conversations/${id}`);

export const adminSendChatMessageAPI = (conversationId, data) =>
    api.post(`/admin/chat/conversations/${conversationId}/messages`, data);

export const closeChatConversationAPI = (conversationId) =>
    api.put(`/admin/chat/conversations/${conversationId}/close`);

// --- Chat Banned Keywords (Admin) ---
export const getBannedKeywordsAPI = () =>
    api.get('/admin/chat/banned-keywords');

export const addBannedKeywordAPI = (data) =>
    api.post('/admin/chat/banned-keywords', data);

export const deleteBannedKeywordAPI = (id) =>
    api.delete(`/admin/chat/banned-keywords/${id}`);

// --- Chat Auto Replies (Admin) ---
export const getAutoRepliesAPI = () =>
    api.get('/admin/chat/auto-replies');

export const addAutoReplyAPI = (data) =>
    api.post('/admin/chat/auto-replies', data);

export const updateAutoReplyAPI = (id, data) =>
    api.put(`/admin/chat/auto-replies/${id}`, data);

export const deleteAutoReplyAPI = (id) =>
    api.delete(`/admin/chat/auto-replies/${id}`);
