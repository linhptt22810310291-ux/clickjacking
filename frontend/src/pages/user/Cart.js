import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { Table, Button, Form, Alert, Stack, Modal, Spinner, Badge } from "react-bootstrap";
import { toast } from 'react-toastify';
import { Image } from 'react-bootstrap';  // SỬA: Import Image nếu dùng (giả sử từ bootstrap)

// Import các thunks và selectors mới
import {
    fetchCart,
    updateCartItemQuantity,
    removeCartItem,
    addToCart,  // SỬA: Import addToCart cho update variant
    selectCartItems,
    selectCartStatus,
    selectCartError,
    selectCartTotalPrice,
    clearCartLocal  // SỬA: Import để clear sau checkout nếu cần
} from "../../redux/cartSlice";
import { getProductVariantsAPI } from '../../api';
import VariantPickerModal from "../../components/VariantPickerModal"; // Tách Modal

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const PLACEHOLDER_IMG = `https://placehold.co/400x400/e2e8f0/64748b?text=No+Image`;

// Helper để xử lý URL ảnh (local hoặc Cloudinary)
const resolveImageUrl = (imagePath) => {
    if (!imagePath) return PLACEHOLDER_IMG;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    return `${API_BASE_URL}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
};

function Cart() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Lấy state từ Redux store
    const cartItems = useSelector(selectCartItems);
    const cartStatus = useSelector(selectCartStatus);
    const cartError = useSelector(selectCartError);
    const totalAll = useSelector(selectCartTotalPrice);

    // State cục bộ cho UI
    const [selectedIds, setSelectedIds] = useState([]);
    const [showPicker, setShowPicker] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [updating, setUpdating] = useState(false);  // SỬA: Loading state cho update variant

    // Fetch giỏ hàng khi component mount
    useEffect(() => {
        dispatch(fetchCart());
    }, [dispatch]);

    // --- Handlers ---
    const handleUpdateQuantity = async (cartItemId, newQuantity, stock) => {
        if (newQuantity <= 0) return toast.warn("Số lượng phải lớn hơn 0.");
        if (stock && newQuantity > stock) return toast.warn(`Số lượng vượt quá tồn kho (${stock}).`);
        dispatch(updateCartItemQuantity({ cartItemId, quantity: newQuantity }));
    };

    const handleRemoveItem = (cartItemId) => {
        if(window.confirm('Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?')) {
            dispatch(removeCartItem(cartItemId));
        }
    };

    const handleRemoveSelected = () => {
        if (!selectedIds.length) return toast.warn("Vui lòng chọn ít nhất 1 sản phẩm để xóa.");
        if(window.confirm(`Bạn có chắc muốn xóa ${selectedIds.length} sản phẩm đã chọn?`)) {
            // Dispatch nhiều action xóa
            Promise.all(selectedIds.map(id => dispatch(removeCartItem(id))))
                .then(() => setSelectedIds([]));
        }
    };

    const handleCheckout = () => {
        if (!cartItems.length) return toast.error("Giỏ hàng trống.");
        const itemsToPay = selectedIds.length ? cartItems.filter(i => selectedIds.includes(i.CartItemID)) : cartItems;
        if (!itemsToPay.length) return toast.warn("Vui lòng chọn ít nhất 1 sản phẩm để thanh toán.");
        
        // Kiểm tra xem có sản phẩm hết hàng trong danh sách thanh toán không
        const outOfStockItems = itemsToPay.filter(item => item.variant.StockQuantity <= 0);
        if (outOfStockItems.length > 0) {
            return toast.error(`Có ${outOfStockItems.length} sản phẩm đã hết hàng. Vui lòng bỏ chọn hoặc xóa sản phẩm hết hàng.`);
        }
        
        // Kiểm tra xem có sản phẩm vượt quá tồn kho không
        const overStockItems = itemsToPay.filter(item => item.Quantity > item.variant.StockQuantity);
        if (overStockItems.length > 0) {
            return toast.error(`Có ${overStockItems.length} sản phẩm vượt quá số lượng tồn kho. Vui lòng điều chỉnh số lượng.`);
        }
        
        navigate("/checkout", { state: { selectedItems: itemsToPay } });
        // SỬA: Clear cart sau checkout (dispatch ở đây hoặc ở checkout success)
        // dispatch(clearCartLocal());  // Uncomment nếu clear ngay (nhưng tốt hơn clear sau place order ở backend)
    };

    // SỬA: Wrap với loading và better error handling để tránh race
    const handleUpdateVariant = async (oldItem, newVariant, quantity) => {
        if (updating) return;  // Prevent multiple calls
        setUpdating(true);
        try {
            // Remove old
            await dispatch(removeCartItem(oldItem.CartItemID)).unwrap();
            // Add new với quantity cũ
            await dispatch(addToCart({ variantId: newVariant.VariantID, quantity })).unwrap();
            toast.success("Đã cập nhật lựa chọn sản phẩm.");
        } catch (err) {
            toast.error(err.message || "Lỗi khi cập nhật sản phẩm.");
            // Rollback: Refetch cart nếu fail
            dispatch(fetchCart());
        } finally {
            setUpdating(false);
            setShowPicker(false);
        }
    };

    // --- Logic chọn item ---
    // Chỉ cho phép chọn những item còn hàng
    const availableItems = cartItems.filter(item => item.variant.StockQuantity > 0);
    const toggleSelect = (cartItemId) => {
        const item = cartItems.find(i => i.CartItemID === cartItemId);
        if (item && item.variant.StockQuantity <= 0) {
            return toast.warn("Không thể chọn sản phẩm đã hết hàng.");
        }
        setSelectedIds(prev => prev.includes(cartItemId) ? prev.filter(id => id !== cartItemId) : [...prev, cartItemId]);
    };
    const allChecked = availableItems.length > 0 && availableItems.every(item => selectedIds.includes(item.CartItemID));
    const toggleSelectAll = () => {
        if (allChecked) {
            setSelectedIds([]);
        } else {
            // Chỉ chọn những item còn hàng
            setSelectedIds(availableItems.map(i => i.CartItemID));
        }
    };

    const totalToShow = useMemo(() => {
        if (!selectedIds.length) return totalAll;
        return cartItems.filter(it => selectedIds.includes(it.CartItemID))
                       .reduce((sum, it) => sum + (it.Price * it.Quantity), 0);
    }, [cartItems, selectedIds, totalAll]);

    // Tính số sản phẩm hết hàng và vượt tồn kho
    const outOfStockCount = useMemo(() => 
        cartItems.filter(item => item.variant.StockQuantity <= 0).length
    , [cartItems]);
    
    const overStockCount = useMemo(() => 
        cartItems.filter(item => item.variant.StockQuantity > 0 && item.Quantity > item.variant.StockQuantity).length
    , [cartItems]);

    if (cartStatus === 'loading' && cartItems.length === 0) {
        return <div className="text-center p-5"><Spinner animation="border" /></div>;
    }

    return (
        <div className="container mt-4">
            {cartStatus === 'failed' && cartError && <Alert variant="danger">{cartError}</Alert>}

            <Stack direction="horizontal" className="mb-3" gap={3} style={{ justifyContent: "space-between" }}>
                <h2 className="m-0">Giỏ hàng</h2>
                <Stack direction="horizontal" gap={2}>
                    <Form.Check type="checkbox" id="select-all" label="Chọn tất cả" checked={allChecked} onChange={toggleSelectAll} />
                    <Button variant="outline-danger" size="sm" onClick={handleRemoveSelected} disabled={!selectedIds.length}>Xóa đã chọn</Button>
                </Stack>
            </Stack>

            {!cartItems.length ? (
                <p>Giỏ hàng của bạn trống. <Link to="/products">Mua sắm ngay</Link></p>
            ) : (
                <>
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th style={{ width: 60, textAlign: "center" }}><Form.Check type="checkbox" checked={allChecked} onChange={toggleSelectAll} /></th>
                                <th>Sản phẩm</th>
                                <th>Thuộc tính</th>
                                <th className="text-end">Giá</th>
                                <th style={{ width: 160 }} className="text-center">Số lượng</th>
                                <th className="text-end">Tổng</th>
                                <th style={{ width: 120 }} className="text-center">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cartItems.map((item) => {
                                const isOutOfStock = item.variant.StockQuantity <= 0;
                                const isOverStock = item.Quantity > item.variant.StockQuantity;
                                
                                return (
                                <tr key={item.CartItemID} style={{ 
                                    opacity: isOutOfStock ? 0.6 : 1,
                                    backgroundColor: isOutOfStock ? '#f8d7da' : 'inherit'
                                }}>
                                    <td style={{ textAlign: "center", verticalAlign: 'middle' }}>
                                        <Form.Check 
                                            type="checkbox" 
                                            checked={selectedIds.includes(item.CartItemID)} 
                                            onChange={() => toggleSelect(item.CartItemID)}
                                            disabled={isOutOfStock}
                                        />
                                    </td>
                                    <td>
                                        <div className="d-flex align-items-center gap-2">
                                            <div style={{ position: 'relative' }}>
                                                <img src={resolveImageUrl(item.variant.ProductImage)} alt={item.variant.product.Name} style={{ width: 60, height: 60, objectFit: "cover", filter: isOutOfStock ? 'grayscale(50%)' : 'none' }} onError={(e) => e.target.src = PLACEHOLDER_IMG} />
                                                {isOutOfStock && (
                                                    <Badge bg="danger" style={{ 
                                                        position: 'absolute', 
                                                        top: '50%', 
                                                        left: '50%', 
                                                        transform: 'translate(-50%, -50%)',
                                                        fontSize: '9px',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        HẾT HÀNG
                                                    </Badge>
                                                )}
                                            </div>
                                            <div>
                                                <Link to={`/product/${item.variant.ProductID}`} className="fw-semibold text-decoration-none text-dark">{item.variant.product.Name}</Link>
                                                {isOutOfStock && <div><Badge bg="danger" className="mt-1">Sản phẩm đã hết hàng</Badge></div>}
                                                {!isOutOfStock && isOverStock && (
                                                    <div><Badge bg="warning" text="dark" className="mt-1">Vượt quá tồn kho (còn {item.variant.StockQuantity})</Badge></div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ verticalAlign: 'middle' }}>
                                        <div><small>Màu: <strong>{item.variant.Color}</strong></small></div>
                                        <div><small>Size: <strong>{item.variant.Size}</strong></small></div>
                                        <Button variant="link" size="sm" className="p-0" onClick={() => { setEditingItem(item); setShowPicker(true); }} disabled={updating || isOutOfStock}>
                                            {updating ? <Spinner size="sm" /> : 'Thay đổi'}
                                        </Button>  {/* SỬA: Disable + spinner khi updating hoặc hết hàng */}
                                    </td>
                                    <td className="text-end" style={{ verticalAlign: 'middle' }}>{item.Price.toLocaleString('vi-VN')}₫</td>
                                    <td style={{ verticalAlign: 'middle' }}>
                                        <Form.Control
                                            type="number"
                                            min="1"
                                            max={item.variant.StockQuantity || 1}
                                            value={item.Quantity}
                                            onChange={(e) => handleUpdateQuantity(item.CartItemID, parseInt(e.target.value) || 1, item.variant.StockQuantity)}
                                            style={{ textAlign: 'center' }}
                                            disabled={isOutOfStock}
                                            className={isOverStock ? 'border-warning' : ''}
                                        />
                                        {!isOutOfStock && (
                                            <small className="text-muted d-block text-center">Còn {item.variant.StockQuantity}</small>
                                        )}
                                    </td>
                                    <td className="text-end" style={{ verticalAlign: 'middle', textDecoration: isOutOfStock ? 'line-through' : 'none' }}>
                                        {(item.Price * item.Quantity).toLocaleString('vi-VN')}₫
                                    </td>
                                    <td className="text-center" style={{ verticalAlign: 'middle' }}>
                                        <Button variant="danger" size="sm" onClick={() => handleRemoveItem(item.CartItemID)}>Xóa</Button>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </Table>

                    <div className="d-flex justify-content-between align-items-center mt-3">
                        <Button variant="outline-secondary" onClick={() => navigate('/products')}>← Tiếp tục mua sắm</Button>
                        <div className="text-end">
                            {outOfStockCount > 0 && (
                                <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '13px' }}>
                                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                    {outOfStockCount} sản phẩm đã hết hàng
                                </Alert>
                            )}
                            {overStockCount > 0 && (
                                <Alert variant="warning" className="py-1 px-2 mb-2" style={{ fontSize: '13px' }}>
                                    <i className="bi bi-exclamation-triangle me-1"></i>
                                    {overStockCount} sản phẩm vượt quá tồn kho
                                </Alert>
                            )}
                            <h4 className="mb-2">Tổng cộng: {totalToShow.toLocaleString('vi-VN')}₫</h4>
                            <Button variant="success" onClick={handleCheckout} disabled={updating || availableItems.length === 0}>
                                Thanh toán {selectedIds.length > 0 ? `(${selectedIds.length} sản phẩm)` : ''}
                            </Button>
                        </div>
                    </div>
                </>
            )}
            
            {editingItem && (
                <VariantPickerModal
                    show={showPicker}
                    onHide={() => setShowPicker(false)}
                    product={{ ProductID: editingItem.variant.ProductID, Name: editingItem.variant.product.Name }}
                    action="update"
                    editingItem={editingItem}
                    onUpdateVariant={handleUpdateVariant}  // SỬA: Pass quantity từ editingItem
                    fetchVariantsApi={() => getProductVariantsAPI(editingItem.variant.ProductID)}
                />
            )}
        </div>
    );
}
export default Cart;