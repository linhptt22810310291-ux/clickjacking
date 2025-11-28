import React, { useEffect, useState } from 'react';
import { Container, Card, Button, Spinner, Alert, Row, Col, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { getCollectibleVouchersAPI, claimVoucherAPI } from '../../api'; // <<< File này import đã đúng
import { FaTicketAlt } from 'react-icons/fa';

export default function VoucherStore() {
    const [vouchers, setVouchers] = useState([]);
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState(null);
    const [collectingIds, setCollectingIds] = useState(new Set()); // Các ID đang bấm "Lưu"

    useEffect(() => {
        const fetchVouchers = async () => {
            try {
                setStatus('loading');
                const res = await getCollectibleVouchersAPI();
                setVouchers(res.data.vouchers || []);
                setStatus('succeeded');
            } catch (err) {
                setError(err.response?.data?.message || 'Không thể tải kho voucher.');
                setStatus('failed');
            }
        };
        fetchVouchers();
    }, []);

    const handleClaim = async (couponCode, couponId) => { // 'couponCode' là string, 'couponId' là number
        setCollectingIds(prev => new Set(prev).add(couponId));
        try {
            //  Gọi hàm 'claimVoucherAPI' với 'couponCode'
            const res = await claimVoucherAPI(couponCode); 
            toast.success(res.data.message || "Đã lưu voucher!");
            
            // Xóa voucher vừa lưu khỏi danh sách
            setVouchers(prev => prev.filter(v => v.CouponID !== couponId));

        } catch (err) {
            toast.error(err.response?.data?.message || "Lưu thất bại.");
        } finally {
            setCollectingIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(couponId);
                return newSet;
            });
        }
    };

    const renderContent = () => {
        if (status === 'loading') {
            return <div className="text-center p-5"><Spinner animation="border" /></div>;
        }
        if (status === 'failed') {
            return <Alert variant="danger">{error}</Alert>;
        }
        if (vouchers.length === 0) {
            return <Alert variant="info">Tuyệt vời! Bạn đã lưu tất cả voucher. <br/>Vui lòng quay lại sau để săn thêm nhé.</Alert>;
        }
        return (
            <Row xs={1} md={2} className="g-3">
                {vouchers.map(v => {
                    const discountText = v.DiscountType === 'Percent' 
                        ? `Giảm ${v.DiscountValue}%` 
                        : `Giảm ${Number(v.DiscountValue).toLocaleString('vi-VN')}₫`;
                    const isCollecting = collectingIds.has(v.CouponID);

                    return (
                        <Col key={v.CouponID}>
                            <Card className="h-100 shadow-sm border-success">
                                <Card.Body>
                                    <div className="d-flex justify-content-between">
                                        <div>
                                            <h5 className="mb-1 text-success fw-bold">{discountText}</h5>
                                            <Badge bg="light" text="dark" className="mb-2">Mã: {v.Code}</Badge>
                                            <p className="mb-1 small text-muted">ĐH tối thiểu: {Number(v.MinPurchaseAmount).toLocaleString('vi-VN')}₫</p>
                                        </div>
                                        <Button 
                                            variant="success" 
                                            // === SỬA LỖI TẠI ĐÂY ===
                                            // Gửi v.Code (string) làm tham số đầu tiên
                                            onClick={() => handleClaim(v.Code, v.CouponID)}
                                            // === KẾT THÚC SỬA ===
                                            disabled={isCollecting}
                                        >
                                            {isCollecting ? <Spinner size="sm" /> : "Lưu"}
                                        </Button>
                                    </div>
                                    <hr className="my-2" />
                                    <small className="text-muted">
                                        HSD: {new Date(v.ExpiryDate).toLocaleDateString('vi-VN')}
                                        {v.MaxUses > 0 && ` | Còn lại: ${v.MaxUses - v.UsedCount} lượt`}
                                    </small>
                                </Card.Body>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        );
    };

    return (
        <Container className="my-4">
            <h2 className="mb-3 d-flex align-items-center gap-2">
                <FaTicketAlt /> Kho Voucher
            </h2>
            <p className="text-muted">Hãy "Lưu" voucher về ví của bạn để sử dụng khi thanh toán.</p>
            {renderContent()}
        </Container>
    );
}