import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Container,
    Card,
    CardHeader,
    CardContent,
    TextField,
    Button,
    LinearProgress,
    Typography,
    Box,
    Tabs,
    Tab,
    Alert,
    List,
    ListItem,
    ListItemAvatar,
    Avatar,
    ListItemText,
    Drawer,
    Toolbar,
    IconButton,
    Grid,
    Chip,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Stack,
    Skeleton
} from "@mui/material";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "react-toastify";
import CloseIcon from "@mui/icons-material/Close";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import moment from "moment";

import {
    lookupGuestOrders,
    fetchGuestOrderDetail,
    cancelGuestOrder,
    clearLookup
} from "../../redux/guestOrderSlice";

// 👇 API gọi thanh toán lại VNPAY cho guest
import { retryGuestVnpayPaymentAPI } from "../../api";

// --- Constants ---
const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
const PLACEHOLDER = `https://placehold.co/400x400/e2e8f0/64748b?text=No+Image`;

const STATUS_META = {
    PendingPayment: { label: "Chờ thanh toán" },
    Pending: { label: "Chờ xác nhận" },
    Confirmed: { label: "Đã xác nhận" },
    Shipped: { label: "Đang giao" },
    Delivered: { label: "Đã giao" },
    Cancelled: { label: "Đã hủy" }
};

const STATUS_ORDER = [
    "PendingPayment",
    "Pending",
    "Confirmed",
    "Shipped",
    "Delivered",
    "Cancelled"
];

const money = (n) =>
    Number(n ?? 0).toLocaleString("vi-VN", {
        style: "currency",
        currency: "VND"
    });

// ⭐ Helper chuẩn hoá URL ảnh
const buildImageUrl = (url) => {
    if (!url) return PLACEHOLDER;
    if (url.startsWith("http")) return url;
    return `${API_BASE}${url.startsWith("/") ? url : "/" + url}`;
};

// =======================================================
// ===          COMPONENT CON (ORDER DETAIL DRAWER)    ===
// =======================================================
function OrderDetailDrawer({ open, onClose, orderId }) {
    const dispatch = useDispatch();
    const { data: detail, status, error } = useSelector(
        (state) => state.guestOrder.detail
    );

    const [isPaying, setIsPaying] = useState(false);

    useEffect(() => {
        if (open && orderId) {
            dispatch(fetchGuestOrderDetail(orderId));
        }
    }, [open, orderId, dispatch]);

    const handleCancel = async () => {
        if (!window.confirm("Bạn có chắc muốn hủy đơn hàng này?")) return;
        const resultAction = await dispatch(cancelGuestOrder(orderId));
        if (cancelGuestOrder.fulfilled.match(resultAction)) {
            toast.success("Đã hủy đơn hàng thành công.");
        } else {
            toast.error(
                resultAction.payload?.message || "Hủy đơn thất bại."
            );
        }
    };

    const handleRetryPayment = async () => {
        try {
            setIsPaying(true);
            const { data } = await retryGuestVnpayPaymentAPI(orderId);
            if (data.success && data.paymentUrl) {
                window.location.href = data.paymentUrl;
            } else {
                toast.error(
                    data.message || "Không tạo được link thanh toán lại."
                );
            }
        } catch (err) {
            toast.error(
                err?.response?.data?.message ||
                    "Lỗi khi tạo link thanh toán lại."
            );
        } finally {
            setIsPaying(false);
        }
    };

    const renderActions = () => {
        if (!detail || !detail.Order) return null;
        const o = detail.Order;

        const canCancel =
            (o.Status === "Pending" || o.Status === "PendingPayment") &&
            o.PaymentStatus !== "Paid";

        const canRetryPay =
            o.PaymentMethod === "VNPAY" &&
            o.Status === "PendingPayment" &&
            o.PaymentStatus === "Pending";

        return (
            <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                {canCancel && (
                    <Button
                        onClick={handleCancel}
                        color="error"
                        variant="outlined"
                        size="small"
                    >
                        Hủy đơn
                    </Button>
                )}

                {canRetryPay && (
                    <Button
                        onClick={handleRetryPayment}
                        color="primary"
                        variant="contained"
                        size="small"
                        disabled={isPaying}
                    >
                        {isPaying ? "Đang tạo link..." : "Thanh toán lại"}
                    </Button>
                )}
            </Box>
        );
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{ sx: { width: { xs: "100%", sm: 600 } } }}
        >
            <Toolbar
                sx={{
                    justifyContent: "space-between",
                    borderBottom: 1,
                    borderColor: "divider"
                }}
            >
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Chi tiết đơn hàng #{orderId}
                </Typography>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </Toolbar>

            <Box sx={{ p: 2, overflow: "auto" }}>
                {status === "loading" && (
                    <Skeleton variant="rectangular" height={300} />
                )}
                {status === "failed" && (
                    <Alert severity="error">{error}</Alert>
                )}
                {status === "succeeded" && detail && (
                    <Stack spacing={2}>
                        <Card variant="outlined">
                            <CardHeader title="Thông tin đơn hàng" />
                            <CardContent>
                                <Grid container spacing={1}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Typography variant="body2">
                                            <strong>Ngày đặt:</strong>{" "}
                                            {moment(
                                                detail.Order.OrderDate
                                            ).format("DD/MM/YYYY HH:mm")}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>Người nhận:</strong>{" "}
                                            {detail.Order.FullName}
                                        </Typography>
                                        <Typography variant="body2">
                                            <strong>SĐT:</strong>{" "}
                                            {detail.Order.Phone}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Typography variant="body2">
                                            <strong>Tổng tiền:</strong>{" "}
                                            {money(
                                                detail.Order.TotalAmount
                                            )}
                                        </Typography>

                                        <Typography
                                            variant="body2"
                                            component="div"
                                        >
                                            <strong>Địa chỉ:</strong>{" "}
                                            {detail.Order.Address}
                                        </Typography>

                                        <Typography
                                            variant="body2"
                                            component="div"
                                        >
                                            <strong>Trạng thái:</strong>{" "}
                                            <Chip
                                                label={
                                                    STATUS_META[
                                                        detail.Order.Status
                                                    ]?.label ||
                                                    detail.Order.Status
                                                }
                                                size="small"
                                            />
                                        </Typography>

                                        <Typography
                                            variant="body2"
                                            sx={{ mt: 0.5 }}
                                        >
                                            <strong>Thanh toán:</strong>{" "}
                                            {detail.Order.PaymentMethod ||
                                                "—"}{" "}
                                            -{" "}
                                            {detail.Order.PaymentStatus ||
                                                "—"}
                                        </Typography>
                                    </Grid>
                                </Grid>

                                {renderActions()}
                            </CardContent>
                        </Card>

                        <Card variant="outlined">
                            <CardHeader title="Sản phẩm trong đơn" />
                            <CardContent sx={{ p: 0 }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Sản phẩm</TableCell>
                                            <TableCell>Phân loại</TableCell>
                                            <TableCell align="right">
                                                SL
                                            </TableCell>
                                            <TableCell align="right">
                                                Thành tiền
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {detail.Items.map((item) => (
                                            <TableRow
                                                key={item.GuestOrderItemID}
                                            >
                                                <TableCell>
                                                    <Stack
                                                        direction="row"
                                                        spacing={1}
                                                        alignItems="center"
                                                    >
                                                        <Avatar
                                                            variant="rounded"
                                                            src={buildImageUrl(
                                                                item.ImageURL
                                                            )}
                                                        />
                                                        <Typography variant="body2">
                                                            {item.ProductName ||
                                                                item.variant
                                                                    .product
                                                                    .Name}
                                                        </Typography>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>
                                                    {(item.Size ||
                                                        item.variant
                                                            .Size) +
                                                        " - " +
                                                        (item.Color ||
                                                            item.variant
                                                                .Color)}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {item.Quantity}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {money(
                                                        item.Price *
                                                            item.Quantity
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </Stack>
                )}
            </Box>
        </Drawer>
    );
}

// =======================================================
// ===             COMPONENT CHÍNH (LOOKUP)            ===
// =======================================================
export default function OrderLookup() {
    const dispatch = useDispatch();
    const { ordersByStatus, lookupStatus, lookupError } = useSelector(
        (state) => state.guestOrder
    );

    const [selectedStatus, setSelectedStatus] = useState("Pending");
    const [openDetail, setOpenDetail] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState(null);

    useEffect(() => {
        return () => {
            dispatch(clearLookup());
        };
    }, [dispatch]);

    const formik = useFormik({
        initialValues: { email: "", phone: "" },
        validationSchema: Yup.object({
            email: Yup.string()
                .email("Email không đúng định dạng.")
                .required("Vui lòng nhập email."),
            phone: Yup.string()
                .matches(
                    /^0\d{9}$/,
                    "Số điện thoại phải là 10 số, bắt đầu bằng 0."
                )
                .required("Vui lòng nhập số điện thoại.")
        }),
        onSubmit: (values) => {
            dispatch(lookupGuestOrders(values));
        }
    });

    useEffect(() => {
        if (lookupStatus === "succeeded" && ordersByStatus) {
            const firstNonEmpty = STATUS_ORDER.find(
                (st) => (ordersByStatus[st] || []).length > 0
            );
            setSelectedStatus(firstNonEmpty || "Pending");
        }
    }, [lookupStatus, ordersByStatus]);

    const handleOpenDetail = (orderId) => {
        setSelectedOrderId(orderId);
        setOpenDetail(true);
    };

    const renderOrderList = () => {
        if (!ordersByStatus) return null;

        const list = ordersByStatus[selectedStatus] || [];
        if (list.length === 0) {
            return (
                <Typography
                    sx={{ p: 2, textAlign: "center" }}
                    color="text.secondary"
                >
                    Không có đơn hàng nào trong mục này.
                </Typography>
            );
        }

        return list.map((order) => {
            const imgSrc = buildImageUrl(order.FirstItemImage); // ⭐ dùng helper

            return (
                <ListItem
                    key={order.GuestOrderID}
                    secondaryAction={
                        <Button
                            onClick={() =>
                                handleOpenDetail(order.GuestOrderID)
                            }
                        >
                            Xem chi tiết
                        </Button>
                    }
                >
                    <ListItemAvatar>
                        <Avatar variant="rounded" src={imgSrc} />
                    </ListItemAvatar>
                    <ListItemText
                        primary={`Đơn hàng #${order.GuestOrderID}`}
                        secondary={`Tổng: ${money(
                            order.TotalAmount
                        )} - Ngày: ${new Date(
                            order.OrderDate
                        ).toLocaleDateString("vi-VN")}`}
                    />
                </ListItem>
            );
        });
    };

    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Card elevation={4} sx={{ borderRadius: 3 }}>
                <CardHeader title="Kiểm tra đơn hàng của bạn" />
                <CardContent>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                    >
                        Nhập Email và Số điện thoại đã dùng khi đặt hàng để
                        tra cứu.
                    </Typography>
                    <Box
                        component="form"
                        noValidate
                        onSubmit={formik.handleSubmit}
                    >
                        <TextField
                            fullWidth
                            required
                            label="Email"
                            {...formik.getFieldProps("email")}
                            error={
                                formik.touched.email &&
                                Boolean(formik.errors.email)
                            }
                            helperText={
                                formik.touched.email && formik.errors.email
                            }
                            margin="normal"
                            InputProps={{
                                startAdornment: (
                                    <EmailIcon
                                        color="action"
                                        sx={{ mr: 1 }}
                                    />
                                )
                            }}
                        />
                        <TextField
                            fullWidth
                            required
                            label="Số điện thoại"
                            {...formik.getFieldProps("phone")}
                            error={
                                formik.touched.phone &&
                                Boolean(formik.errors.phone)
                            }
                            helperText={
                                formik.touched.phone && formik.errors.phone
                            }
                            margin="normal"
                            InputProps={{
                                startAdornment: (
                                    <PhoneIcon
                                        color="action"
                                        sx={{ mr: 1 }}
                                    />
                                )
                            }}
                        />

                        {lookupStatus === "loading" && (
                            <LinearProgress sx={{ my: 1 }} />
                        )}
                        {lookupStatus === "failed" && (
                            <Alert severity="error" sx={{ mt: 1 }}>
                                {lookupError}
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            size="large"
                            sx={{ mt: 2 }}
                            disabled={lookupStatus === "loading"}
                        >
                            Tra cứu
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {lookupStatus === "succeeded" && ordersByStatus && (
                <Box
                    sx={{
                        mt: 3,
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 2
                    }}
                >
                    <Tabs
                        value={STATUS_ORDER.indexOf(selectedStatus)}
                        onChange={(_, idx) =>
                            setSelectedStatus(STATUS_ORDER[idx])
                        }
                        variant="scrollable"
                        scrollButtons="auto"
                    >
                        {STATUS_ORDER.map((st) => (
                            <Tab
                                key={st}
                                label={`${STATUS_META[st].label} (${
                                    ordersByStatus[st]?.length || 0
                                })`}
                            />
                        ))}
                    </Tabs>
                    <List>{renderOrderList()}</List>
                </Box>
            )}

            <OrderDetailDrawer
                open={openDetail}
                onClose={() => setOpenDetail(false)}
                orderId={selectedOrderId}
            />
        </Container>
    );
}
