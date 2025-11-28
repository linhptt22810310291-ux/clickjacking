import api from "./api";

// Lấy danh sách đơn (tra cứu)
export const lookupGuestOrders = (values) =>
  api.post("/guest-history/lookup", values);   // ✅ Đúng route backend

// Lấy chi tiết đơn
export const fetchGuestOrderDetail = (id) =>
  api.get(`/guest-history/${id}`);             // ✅ Đúng route backend

// Hủy đơn
export const cancelGuestOrder = (id) =>
  api.post(`/guest-history/${id}/cancel`);     // vẫn đúng

// Thanh toán lại VNPAY
export const retryGuestVnpayPaymentAPI = (id) =>
  api.post(`/guest-orders/${id}/pay`);         // đúng với controller retryGuestVnpayPayment
