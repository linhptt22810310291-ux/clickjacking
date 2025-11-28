import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Container, Alert, Button, Spinner } from 'react-bootstrap';
import * as api from '../../api';
import { toast } from 'react-toastify';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Token xác thực không được cung cấp.');
        return;
      }

      try {
        const { data } = await api.verifyEmailAPI({ token });
        setStatus('success');
        setMessage(data.message || 'Email xác thực thành công!');
        toast.success('Email xác thực thành công!');
        
        // Tự động chuyển hướng sau 3 giây
        setTimeout(() => navigate('/login'), 3000);
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.errors?.[0]?.msg || 'Lỗi khi xác thực email.');
        toast.error(setMessage);
      }
    };

    verifyToken();
  }, [searchParams, navigate]);

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', maxWidth: '500px' }}>
        {status === 'loading' && (
          <>
            <Spinner animation="border" className="mb-3" />
            <p>Đang xác thực email...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <Alert variant="success">
              <h4>✓ Xác thực thành công!</h4>
              <p>{message}</p>
              <p>Đang chuyển hướng đến trang đăng nhập...</p>
            </Alert>
            <Button variant="primary" onClick={() => navigate('/login')}>
              Đi tới Đăng nhập
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <Alert variant="danger">
              <h4>✗ Xác thực thất bại</h4>
              <p>{message}</p>
            </Alert>
            <Button variant="primary" className="me-2" onClick={() => navigate('/login')}>
              Quay lại Đăng nhập
            </Button>
            <Link to="/register">
              <Button variant="secondary">Đăng ký lại</Button>
            </Link>
          </>
        )}
      </div>
    </Container>
  );
}
