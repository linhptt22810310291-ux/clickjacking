import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Spinner, Button, Alert, Container } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

// Determine API URL based on environment
const getApiBaseUrl = () => {
    // Check if running on Render (production)
    if (window.location.hostname.includes('onrender.com')) {
        return 'https://clickjacking-backend.onrender.com';
    }
    // Use environment variable or fallback to localhost
    return process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
};

const API_BASE_URL = getApiBaseUrl();

export default function PaymentResult() {
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState(null); // { success, message }
    const navigate = useNavigate();

    useEffect(() => {
        const fetchResult = async () => {
            try {
                const search = window.location.search; // lấy toàn bộ ?vnp_...
                if (!search.includes('vnp_TxnRef')) {
                    setResult({
                        success: false,
                        message: 'Không có thông tin thanh toán.'
                    });
                    setLoading(false);
                    return;
                }

                const res = await axios.get(
                    `${API_BASE_URL}/api/payment/vnpay_return${search}`
                );

                setResult(res.data);
            } catch (err) {
                console.error(err);
                setResult({
                    success: false,
                    message: 'Không thể xác thực kết quả thanh toán.'
                });
            } finally {
                setLoading(false);
            }
        };

        fetchResult();
    }, []);

    if (loading) {
        return (
            <Container className="py-5 text-center">
                <Spinner />
                <p className="mt-3">Đang kiểm tra kết quả thanh toán...</p>
            </Container>
        );
    }

    return (
        <Container className="py-5 text-center">
            {result?.success ? (
                <>
                    <h3 className="text-success mb-3">Thanh toán thành công</h3>
                    <p>{result.message}</p>
                    <Button
                        onClick={() =>
                            navigate('/profile?section=orders&tab=Confirmed')
                        }
                    >
                        Xem đơn hàng
                    </Button>
                </>
            ) : (
                <>
                    <h3 className="text-danger mb-3">Thanh toán không thành công</h3>
                    <p>{result?.message || 'Giao dịch thất bại.'}</p>
                    <Button onClick={() => navigate('/cart')}>Quay lại giỏ hàng</Button>
                </>
            )}
        </Container>
    );
}
