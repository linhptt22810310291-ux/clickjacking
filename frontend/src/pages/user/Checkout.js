// frontend/src/components/checkout/Checkout.js

import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
  Spinner,
  Badge,
  InputGroup,
  Modal,
  Image,
} from "react-bootstrap";
import {
  FaMapMarkerAlt,
  FaPlus,
  FaTruck,
  FaMoneyBillWave,
  FaShieldAlt,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useFormik } from "formik";
import * as Yup from "yup";

import {
  fetchCheckoutData,
  validateCoupon,
  placeOrder,
  createNewAddress,
  clearCoupon,
} from "../../redux/checkoutSlice";
import { clearCartLocal } from "../../redux/cartSlice";
import { selectUser } from "../../redux/userSlice";
import { resetVoucherStatus } from "../../redux/profileSlice";
import AddressCard from "../../components/checkout/AddressCard";
import * as api from "../../api";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const normalizeImg = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE_URL}${url}`;
};

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const user = useSelector(selectUser);
  const {
    addresses,
    providers,
    coupons,
    userVouchers,       // ví voucher đã map từ backend
    userVouchersStatus, // nếu reducer có set, dùng để hiển thị loading ví
    paymentMethods,
    status,
    error,
    orderStatus,
    orderError,
    couponDiscount,
    couponNote,
    validatingCoupon,
  } = useSelector((state) => state.checkout);

  const cartItemsFromRedux = useSelector((state) => state.cart.items);
  const isUser = !!user;

  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [shippingProviderId, setShippingProviderId] = useState(null);
  const [shippingFee, setShippingFee] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [guestGHNAddress, setGuestGHNAddress] = useState(null);

  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  const items = useMemo(() => {
    const itemsFromState =
      location.state?.selectedItems || location.state?.buyNowItems;
    if (itemsFromState && itemsFromState.length > 0) return itemsFromState;
    return cartItemsFromRedux;
  }, [location.state, cartItemsFromRedux]);

  // --- Form cho khách (guest) ---
  const guestFormik = useFormik({
    initialValues: { fullName: "", phone: "", email: "", street: "", city: "" },
    validationSchema: Yup.object({
      fullName: Yup.string().trim().required("Họ tên là bắt buộc."),
      phone: Yup.string()
        .matches(
          /^(03|05|07|08|09)\d{8}$/,
          "Số điện thoại phải có 10 số và bắt đầu bằng 03, 05, 07, 08 hoặc 09."
        )
        .required("Số điện thoại là bắt buộc."),
      email: Yup.string()
        .email("Email không hợp lệ.")
        .required("Email là bắt buộc."),
      street: Yup.string().trim().required("Địa chỉ là bắt buộc."),
      city: Yup.string().trim().required("Thành phố là bắt buộc."),
    }),
    onSubmit: () => {},
  });

  // --- Form thêm/sửa địa chỉ ---
  const addressFormik = useFormik({
    initialValues: {
      fullName: "",
      phone: "",
      email: "",
      street: "",
      city: "",
      isDefault: false,
    },
    enableReinitialize: true,
    validationSchema: Yup.object({
      fullName: Yup.string().trim().required("Họ tên là bắt buộc."),
      phone: Yup.string()
        .matches(
          /^(03|05|07|08|09)\d{8}$/,
          "Số điện thoại phải có 10 số và bắt đầu bằng 03, 05, 07, 08 hoặc 09."
        )
        .required("Số điện thoại là bắt buộc."),
      email: Yup.string().email("Email không hợp lệ."),
      street: Yup.string().trim().required("Địa chỉ là bắt buộc."),
      city: Yup.string().trim().required("Thành phố là bắt buộc."),
    }),
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values) => {
      const payload = {
        FullName: values.fullName,
        Phone: values.phone,
        Email: values.email,
        Street: values.street,
        City: values.city,
        IsDefault: values.isDefault,
      };

      try {
        if (editingAddress) {
          await api.updateAddressAPI(editingAddress.AddressID, payload);
          toast.success("Cập nhật địa chỉ thành công!");
        } else {
          const resultAction = await dispatch(createNewAddress(payload));
          toast.success("Thêm địa chỉ mới thành công!");
          setSelectedAddressId(resultAction.payload.id);
          console.log("New address payload:", resultAction.payload);
        }
        setAddrModalOpen(false);
        dispatch(fetchCheckoutData(!!user));
      } catch (err) {
        console.error("Add address error:", err);
        toast.error(
          err.response?.data?.message || "Lưu địa chỉ thất bại."
        );
      }
    },
  });

  const handleDeleteAddress = async (addressId) => {
    if (window.confirm("Bạn có chắc muốn xóa địa chỉ này?")) {
      try {
        await api.deleteAddressAPI(addressId);
        toast.success("Đã xóa địa chỉ.");
        dispatch(fetchCheckoutData(isUser));
      } catch (err) {
        toast.error(
          err.response?.data?.message || "Xóa địa chỉ thất bại."
        );
      }
    }
  };

  // Đặt địa chỉ mặc định
  const handleMakeDefaultAddress = async (addr) => {
    if (!addr) return;
    try {
      const payload = {
        FullName: addr.FullName,
        Phone: addr.Phone,
        Email: addr.Email,
        Street: addr.Street,
        City: addr.City,
        State: addr.State,
        Country: addr.Country,
        IsDefault: true,
      };

      await api.updateAddressAPI(addr.AddressID, payload);
      toast.success("Đã đặt làm địa chỉ mặc định.");
      setSelectedAddressId(addr.AddressID);
      dispatch(fetchCheckoutData(isUser));
    } catch (err) {
      console.error("Set default address error:", err);
      toast.error(
        err.response?.data?.message ||
          "Không thể đặt làm địa chỉ mặc định."
      );
    }
  };

  // Lấy dữ liệu checkout (và kèm ví voucher nếu backend trả về)
  useEffect(() => {
    dispatch(fetchCheckoutData(isUser));
  }, [dispatch, isUser]);

  // Kiểm tra tồn kho khi load trang checkout
  useEffect(() => {
    if (items && items.length > 0) {
      const outOfStockItems = items.filter(item => 
        item.variant?.StockQuantity === 0 || item.Quantity > (item.variant?.StockQuantity || 0)
      );
      if (outOfStockItems.length > 0) {
        const itemNames = outOfStockItems.map(item => item.variant?.product?.Name || 'Sản phẩm').join(', ');
        toast.error(`Một số sản phẩm đã hết hàng hoặc không đủ số lượng: ${itemNames}. Vui lòng quay lại giỏ hàng.`);
        setTimeout(() => navigate('/cart'), 2000);
      }
    }
  }, [items, navigate]);

  useEffect(() => {
    if (status === "succeeded") {
      if (isUser && addresses.length > 0 && !selectedAddressId) {
        const defaultAddress =
          addresses.find((a) => a.IsDefault) || addresses[0];
        setSelectedAddressId(defaultAddress?.AddressID);
      }
      if (providers.length > 0 && !shippingProviderId) {
        setShippingProviderId(providers[0].ProviderID);
        setShippingFee(providers[0].Fee || 0);
      }
      if (paymentMethods.length > 0 && !paymentMethod) {
        setPaymentMethod(paymentMethods[0].Code);
      }
    }
  }, [
    status,
    isUser,
    addresses,
    providers,
    paymentMethods,
    selectedAddressId,
    shippingProviderId,
    paymentMethod,
  ]);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total +
        (item.price ?? item.Price ?? item.variant?.Price ?? 0) * (item.quantity ?? item.Quantity),
        0
      ),
    [items]
  );

  const grandTotal = useMemo(
    () => Math.max(0, subtotal - couponDiscount + shippingFee),
    [subtotal, couponDiscount, shippingFee]
  );

  /**
   * availableCoupons:
   *  - Guest: dùng danh sách coupon công khai
   *  - User: dùng ví voucher (userVouchers) với nhiều instance → lọc IsUsedInWallet = false, nhóm theo CouponID
   *  - Chỉ hiển thị voucher CÒN HẠN (không cho chọn voucher hết hạn)
   */
  const availableCoupons = useMemo(() => {
    const listToDisplay = isUser ? userVouchers || [] : coupons || [];
    const now = new Date();

    // Lọc các voucher CHƯA SỬ DỤNG trong ví VÀ CÒN HẠN (đối với user)
    const filtered = listToDisplay.filter((v) => {
      const isNotUsed = !v.IsUsedInWallet; // field này backend gán
      const isNotExpired = new Date(v.ExpiryDate) >= now; // Còn hạn
      return isNotUsed && isNotExpired;
    });

    // Nhóm theo CouponID để tính availableCount
    const grouped = filtered.reduce((acc, c) => {
      const id = c.CouponID;
      if (!acc[id]) {
        acc[id] = {
          ...c,
          DisplayDiscount:
            c.DiscountType === "Percent"
              ? `${c.DiscountValue}%`
              : `${Number(c.DiscountValue).toLocaleString("vi-VN")}₫`,
          availableCount: 0,
        };
      }
      acc[id].availableCount++;
      return acc;
    }, {});

    return Object.values(grouped);
  }, [isUser, coupons, userVouchers]);

  const handleValidateCoupon = async (inputCode) => {
    const code = String(inputCode || couponCode || "");

    // Nếu người dùng xóa mã → clear coupon đang áp dụng
    if (!code.trim()) {
      dispatch(clearCoupon());
      setCouponCode("");
      toast.info("Đã gỡ bỏ mã giảm giá.");
      return;
    }

    dispatch(clearCoupon());

    const itemsPayload = items.map((it) => ({
      variantId: it.variantId || it.VariantID || it.variant?.VariantID,
      quantity: it.quantity || it.Quantity,
      price: it.price ?? it.Price ?? it.variant?.Price ?? 0,
    }));

    try {
      const resultAction = await dispatch(
        validateCoupon({
          code,
          total: subtotal,
         // items: itemsPayload,
        })
      );

      if (validateCoupon.fulfilled.match(resultAction)) {
        if (resultAction.payload.valid) {
          setCouponCode(code); // lưu lại mã hợp lệ
          const type = resultAction.payload.type;
          const value = resultAction.payload.value;
          const display =
            type === "Percent"
              ? `${value}%`
              : `${Number(value).toLocaleString("vi-VN")}₫`;
          toast.success(`Áp dụng mã thành công! Giảm ${display}`);
        } else {
          setCouponCode("");
          toast.error(
            resultAction.payload.message || "Mã không hợp lệ."
          );
        }
      }
    } catch (err) {
      toast.error("Lỗi xác thực mã giảm giá.");
    }
  };

  const handleSelectCoupon = (coupon) => {
    setCouponCode(coupon.Code);
    setShowCouponModal(false);
    handleValidateCoupon(coupon.Code);
  };

  const handlePlaceOrder = async () => {
    // Kiểm tra cơ bản
    if (!items.length) return toast.error("Giỏ hàng trống.");
    if (isUser && !selectedAddressId)
      return toast.error("Vui lòng chọn địa chỉ.");
    
    // Validate guest form properly - touch all fields first
    if (!isUser) {
      const errors = await guestFormik.validateForm();
      if (Object.keys(errors).length > 0) {
        guestFormik.setTouched({
          fullName: true,
          phone: true,
          email: true,
          street: true,
          city: true
        });
        return toast.error("Vui lòng điền đầy đủ thông tin nhận hàng.");
      }
    }
    
    if (!shippingProviderId)
      return toast.error("Vui lòng chọn đơn vị vận chuyển.");
    if (!paymentMethod)
      return toast.error("Vui lòng chọn phương thức thanh toán.");

    // Payload chung
    let orderPayload = {
      items: items.map((it) => ({
        variantId:
          it.variantId || it.VariantID || it.variant?.VariantID,
        quantity: it.quantity || it.Quantity,
        price: it.price ?? it.Price ?? it.variant?.Price ?? 0,
      })),
      shippingProviderId,
      paymentMethod,
      couponCode: couponCode || null,
      shippingFee,
      // totalAmount: SUBTOTAL để backend tự tính giảm giá & tổng
      totalAmount: subtotal,
      source: location.state?.buyNowItems ? "buy-now" : "cart",
    };

    // User vs Guest
    if (isUser) {
      orderPayload.shippingAddressId = selectedAddressId;
    } else {
      const sessionId = localStorage.getItem("guest_session_id");
      Object.assign(orderPayload, guestFormik.values, { sessionId });
      // Thêm thông tin GHN nếu có
      if (guestGHNAddress) {
        orderPayload.wardCode = guestGHNAddress.wardCode;
        orderPayload.districtId = guestGHNAddress.districtId;
      }
    }

    console.log("FINAL PAYLOAD TO SEND:", orderPayload);

    try {
      const resultAction = await dispatch(
        placeOrder({ payload: orderPayload, isUser })
      );

      if (placeOrder.fulfilled.match(resultAction)) {
        const responseData = resultAction.payload;

        if (responseData.success) {
          if (isUser) {
            dispatch(resetVoucherStatus());
          }

          if (
            responseData.code === "01" &&
            responseData.paymentUrl
          ) {
            toast.info("Đang chuyển đến trang thanh toán an toàn...");
            window.location.href = responseData.paymentUrl;
          } else {
            toast.success("Đặt hàng thành công!");
            dispatch(clearCartLocal());
            const orderId =
              responseData.orderId || responseData.guestOrderId;
            navigate("/order-success", { state: { orderId } });
          }
        } else {
          toast.error(
            responseData.message || "Đặt hàng thất bại."
          );
        }
      } else {
        toast.error(
          resultAction.payload?.message ||
            "Có lỗi xảy ra, vui lòng thử lại."
        );
      }
    } catch (err) {
      console.error("Place order error:", err);
      toast.error("Một lỗi không mong muốn đã xảy ra.");
    }
  };

  const openAddrModal = (addr = null) => {
    setEditingAddress(addr);
    addressFormik.setValues({
      fullName: addr?.FullName || user?.fullName || "",
      phone: addr?.Phone || user?.phone || "",
      email: addr?.Email || user?.email || "",
      street: addr?.Street || "",
      city: addr?.City || "",
      isDefault: addr?.IsDefault || false,
    });
    setAddrModalOpen(true);
  };

  if (status === "loading")
    return (
      <div className="text-center p-5">
        <Spinner />
      </div>
    );
  if (status === "failed") return <Alert variant="danger">{error}</Alert>;

  return (
    <div className="container mt-4">
      <div className="d-flex align-items-center gap-2 mb-3">
        <h2 className="mb-0">Thanh toán</h2>
        <Badge
          bg="light"
          text="dark"
          className="d-inline-flex align-items-center gap-1"
        >
          <FaShieldAlt /> Bảo mật thông tin
        </Badge>
      </div>
      {orderStatus === "failed" && (
        <Alert variant="danger">{orderError}</Alert>
      )}

      <Row className="g-4">
        <Col lg={7}>
          {/* THÔNG TIN NHẬN HÀNG */}
          <Card className="mb-3 shadow-sm">
            <Card.Header
              as="h5"
              className="d-flex align-items-center gap-2"
            >
              <FaMapMarkerAlt /> Thông tin nhận hàng
            </Card.Header>
            <Card.Body>
              {isUser ? (
                <>
                  {addresses.map((addr) => (
                    <AddressCard
                      key={addr.AddressID}
                      data={addr}
                      selected={selectedAddressId === addr.AddressID}
                      onSelect={() =>
                        setSelectedAddressId(addr.AddressID)
                      }
                      onEdit={() => openAddrModal(addr)}
                      onDelete={() =>
                        handleDeleteAddress(addr.AddressID)
                      }
                      onMakeDefault={() =>
                        handleMakeDefaultAddress(addr)
                      }
                    />
                  ))}
                  <div className="mt-2">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => openAddrModal(null)}
                    >
                      <FaPlus className="me-1" /> Thêm địa chỉ mới
                    </Button>
                  </div>
                </>
              ) : (
                <Form noValidate onSubmit={guestFormik.handleSubmit}>
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Họ tên *</Form.Label>
                        <Form.Control
                          name="fullName"
                          {...guestFormik.getFieldProps("fullName")}
                          isInvalid={
                            guestFormik.touched.fullName &&
                            guestFormik.errors.fullName
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {guestFormik.errors.fullName}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Số điện thoại *</Form.Label>
                        <Form.Control
                          name="phone"
                          {...guestFormik.getFieldProps("phone")}
                          isInvalid={
                            guestFormik.touched.phone &&
                            guestFormik.errors.phone
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {guestFormik.errors.phone}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group className="mb-3">
                        <Form.Label>Email *</Form.Label>
                        <Form.Control
                          name="email"
                          type="email"
                          {...guestFormik.getFieldProps("email")}
                          isInvalid={
                            guestFormik.touched.email &&
                            guestFormik.errors.email
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {guestFormik.errors.email}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group className="mb-3">
                        <Form.Label>Địa chỉ *</Form.Label>
                        <Form.Control
                          name="street"
                          placeholder="Số nhà, tên đường, phường/xã"
                          {...guestFormik.getFieldProps("street")}
                          isInvalid={
                            guestFormik.touched.street &&
                            guestFormik.errors.street
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {guestFormik.errors.street}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group className="mb-3">
                        <Form.Label>Thành phố *</Form.Label>
                        <Form.Control
                          name="city"
                          placeholder="Quận/Huyện, Tỉnh/Thành phố"
                          {...guestFormik.getFieldProps("city")}
                          isInvalid={
                            guestFormik.touched.city &&
                            guestFormik.errors.city
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          {guestFormik.errors.city}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                  </Row>
                </Form>
              )}
            </Card.Body>
          </Card>

          {/* ĐƠN VỊ VẬN CHUYỂN */}
          <Card className="mb-3 shadow-sm">
            <Card.Header
              as="h5"
              className="d-flex align-items-center gap-2"
            >
              <FaTruck /> Đơn vị vận chuyển
            </Card.Header>
            <Card.Body>
              {isUser ? (
                providers.map((p) => (
                  <Form.Check
                    key={p.ProviderID}
                    type="radio"
                    name="provider"
                    id={`provider-${p.ProviderID}`}
                    label={`${p.Name} - ${(
                      p.Fee || 0
                    ).toLocaleString("vi-VN")}₫`}
                    checked={shippingProviderId === p.ProviderID}
                    onChange={() => {
                      setShippingProviderId(p.ProviderID);
                      setShippingFee(p.Fee || 0);
                    }}
                  />
                ))
              ) : (
                <div className="text-muted d-flex align-items-center">
                  <FaTruck className="me-2" />
                  Giao Hàng Nhanh (GHN) - {shippingFee.toLocaleString("vi-VN")}₫
                </div>
              )}
            </Card.Body>
          </Card>

          {/* PHƯƠNG THỨC THANH TOÁN */}
          <Card className="mb-3 shadow-sm">
            <Card.Header
              as="h5"
              className="d-flex align-items-center gap-2"
            >
              <FaMoneyBillWave /> Phương thức thanh toán
            </Card.Header>
            <Card.Body>
              {paymentMethods.map((pm) => (
                <Form.Check
                  key={pm.MethodID}
                  type="radio"
                  label={pm.Name}
                  name="paymentMethod"
                  checked={paymentMethod === pm.Code}
                  onChange={() => setPaymentMethod(pm.Code)}
                />
              ))}
            </Card.Body>
          </Card>
        </Col>

        {/* CỘT ĐƠN HÀNG / VOUCHER */}
        <Col lg={5}>
          <Card
            className="shadow-sm"
            style={{ position: "sticky", top: 16 }}
          >
            <Card.Header as="h5">
              Đơn hàng ({items.length} sản phẩm)
            </Card.Header>
            <Card.Body>
              {items.map((it) => {
                const itemData = {
                  key:
                    it.variantId ||
                    it.CartItemID ||
                    it.variant?.VariantID,
                  image: it.image || it.variant?.ProductImage,
                  name: it.name || it.variant?.product?.Name,
                  color: it.color || it.variant?.Color,
                  size: it.size || it.variant?.Size,
                  quantity: it.quantity || it.Quantity,
                  price: it.price || it.Price,
                };
                return (
                  <div
                    key={itemData.key}
                    className="d-flex gap-2 mb-3"
                  >
                    <Image
                      src={normalizeImg(itemData.image)}
                      style={{
                        width: 60,
                        height: 60,
                        objectFit: "cover",
                        borderRadius: 8,
                      }}
                    />
                    <div className="flex-grow-1">
                      <div className="fw-semibold">{itemData.name}</div>
                      <small className="text-muted">
                        Màu: {itemData.color} • Size: {itemData.size} • SL:{" "}
                        {itemData.quantity}
                      </small>
                    </div>
                    <div className="fw-medium">
                      {(
                        itemData.price * itemData.quantity
                      ).toLocaleString("vi-VN")}
                      ₫
                    </div>
                  </div>
                );
              })}
              <hr />
              <InputGroup className="mb-2">
                <Form.Control
                  placeholder="Nhập mã voucher…"
                  value={couponCode}
                  onChange={(e) =>
                    setCouponCode(e.target.value.toUpperCase())
                  }
                />
                <Button
                  onClick={() => handleValidateCoupon()}
                  disabled={validatingCoupon}
                >
                  {validatingCoupon ? (
                    <Spinner size="sm" />
                  ) : (
                    "Áp dụng"
                  )}
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => setShowCouponModal(true)}
                >
                  Chọn mã
                </Button>
              </InputGroup>
              {couponNote && (
                <div className="small text-muted mb-3">
                  {couponNote}
                </div>
              )}
              <div className="d-flex justify-content-between mb-1">
                <span>Tạm tính</span>
                <span>{subtotal.toLocaleString("vi-VN")}₫</span>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span>Giảm giá</span>
                <span className="text-success">
                  -{couponDiscount.toLocaleString("vi-VN")}₫
                </span>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span>Phí vận chuyển</span>
                <span>{shippingFee.toLocaleString("vi-VN")}₫</span>
              </div>
              <div className="d-flex justify-content-between fw-bold h5 mt-2">
                <span>Tổng thanh toán</span>
                <span className="text-primary">
                  {grandTotal.toLocaleString("vi-VN")}₫
                </span>
              </div>
            </Card.Body>
            <Card.Footer className="d-grid">
              <Button
                size="lg"
                variant="success"
                onClick={handlePlaceOrder}
                disabled={orderStatus === "loading" || !items.length}
              >
                {orderStatus === "loading" ? (
                  <Spinner size="sm" />
                ) : (
                  "Đặt hàng ngay"
                )}
              </Button>
            </Card.Footer>
          </Card>
        </Col>
      </Row>

      {/* MODAL CHỌN MÃ GIẢM GIÁ / VÍ VOUCHER */}
      <Modal
        show={showCouponModal}
        onHide={() => setShowCouponModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {isUser ? "Ví Voucher của bạn" : "Chọn mã giảm giá"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isUser && userVouchersStatus === "loading" && (
            <div className="text-center mb-2">
              <Spinner size="sm" /> Đang tải ví voucher...
            </div>
          )}

          {availableCoupons.length === 0 ? (
            <p>
              {isUser
                ? "Bạn không có voucher nào khả dụng trong ví."
                : "Không có mã giảm giá công khai nào."}
            </p>
          ) : (
            <div className="list-group">
              {availableCoupons.map((coupon) => (
                <div
                  key={coupon.CouponID}
                  className="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div>
                    <strong>{coupon.Code}</strong>
                    {coupon.availableCount > 1 && (
                      <Badge pill bg="info" className="ms-2">
                        x{coupon.availableCount}
                      </Badge>
                    )}
                    <small className="d-block text-muted">
                      Giảm {coupon.DisplayDiscount} - HSD:{" "}
                      {new Date(
                        coupon.ExpiryDate
                      ).toLocaleDateString("vi-VN")}
                    </small>
                    {isUser && !coupon.IsPublic && (
                      <small className="d-block text-success fw-semibold">
                        (Voucher riêng tư)
                      </small>
                    )}
                  </div>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => handleSelectCoupon(coupon)}
                  >
                    Chọn
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* MODAL THÊM / SỬA ĐỊA CHỈ */}
      <Modal
        show={addrModalOpen}
        onHide={() => setAddrModalOpen(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {editingAddress ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form noValidate onSubmit={addressFormik.handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Họ và tên *</Form.Label>
              <Form.Control
                name="fullName"
                {...addressFormik.getFieldProps("fullName")}
                isInvalid={
                  addressFormik.touched.fullName &&
                  addressFormik.errors.fullName
                }
              />
              <Form.Control.Feedback type="invalid">
                {addressFormik.errors.fullName}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Số điện thoại *</Form.Label>
              <Form.Control
                name="phone"
                {...addressFormik.getFieldProps("phone")}
                isInvalid={
                  addressFormik.touched.phone &&
                  addressFormik.errors.phone
                }
              />
              <Form.Control.Feedback type="invalid">
                {addressFormik.errors.phone}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                name="email"
                type="email"
                {...addressFormik.getFieldProps("email")}
                isInvalid={
                  addressFormik.touched.email &&
                  addressFormik.errors.email
                }
              />
              <Form.Control.Feedback type="invalid">
                {addressFormik.errors.email}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Địa chỉ *</Form.Label>
              <Form.Control
                name="street"
                {...addressFormik.getFieldProps("street")}
                isInvalid={
                  addressFormik.touched.street &&
                  addressFormik.errors.street
                }
              />
              <Form.Control.Feedback type="invalid">
                {addressFormik.errors.street}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Thành phố *</Form.Label>
              <Form.Control
                name="city"
                {...addressFormik.getFieldProps("city")}
                isInvalid={
                  addressFormik.touched.city &&
                  addressFormik.errors.city
                }
              />
              <Form.Control.Feedback type="invalid">
                {addressFormik.errors.city}
              </Form.Control.Feedback>
            </Form.Group>
            <Form.Check
              type="switch"
              label="Đặt làm địa chỉ mặc định"
              name="isDefault"
              checked={addressFormik.values.isDefault}
              onChange={addressFormik.handleChange}
            />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setAddrModalOpen(false)}
          >
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={() => addressFormik.handleSubmit()}
          >
            {addressFormik.isSubmitting ? (
              <Spinner size="sm" />
            ) : (
              "Lưu"
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
