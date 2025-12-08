import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Table, Button, Modal, Spinner, Alert, Container, Pagination, InputGroup, Form, Row, Col, Image, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { FaStar, FaCheckCircle, FaUserShield, FaCrown, FaUser } from 'react-icons/fa';

import { 
    fetchAdminReviews, 
    deleteReview,
    selectAdminReviews,
    selectAdminReviewsPagination,
    selectAdminReviewsStatus,
    selectAdminReviewsError
} from '../../redux/adminReviewsSlice';
import { getReviewByIdAdminAPI } from '../../api';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const resolveMediaUrl = (url) => {
    if (!url) return 'https://placehold.co/100x100/e2e8f0/64748b?text=User';
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url}`;
};

const renderStars = (rating) => (
    <div className="d-flex">{[...Array(5)].map((_, i) => <FaStar key={i} size={16} className={i < rating ? 'text-warning' : 'text-muted'} />)}</div>
);

// Hàm xác định loại user dựa trên số lượng đánh giá/đơn hàng
const getUserBadge = (user) => {
    const reviewCount = user?.reviewCount || 0;
    const orderCount = user?.orderCount || 0;
    const isVerified = user?.IsEmailVerified;
    
    if (user?.Role === 'admin') {
        return <Badge bg="danger" className="ms-1"><FaUserShield className="me-1" />Admin</Badge>;
    }
    
    // VIP: đã mua nhiều sản phẩm
    if (orderCount >= 10 || reviewCount >= 20) {
        return <Badge bg="warning" text="dark" className="ms-1"><FaCrown className="me-1" />VIP</Badge>;
    }
    
    // Đã xác thực email
    if (isVerified) {
        return <Badge bg="success" className="ms-1"><FaCheckCircle className="me-1" />Đã xác thực</Badge>;
    }
    
    // User thường
    return <Badge bg="secondary" className="ms-1"><FaUser className="me-1" />Thành viên</Badge>;
};

export default function AdminReviews() {
    const dispatch = useDispatch();
    const reviews = useSelector(selectAdminReviews);
    const pagination = useSelector(selectAdminReviewsPagination);
    const status = useSelector(selectAdminReviewsStatus);
    const error = useSelector(selectAdminReviewsError);
    
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ keyword: '', rating: 'all', startDate: null, endDate: null });
    const [showDetail, setShowDetail] = useState(false);
    const [currentReview, setCurrentReview] = useState(null);

    useEffect(() => {
        const params = { page, limit: 10, keyword: filters.keyword };
        
        if (filters.rating !== 'all') {
            params.rating = filters.rating;
        }
        if (filters.startDate) {
            params.startDate = filters.startDate.toISOString();
        }
        if (filters.endDate) {
            params.endDate = filters.endDate.toISOString();
        }
        
        dispatch(fetchAdminReviews(params));
    }, [page, filters, dispatch]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
        setPage(1); 
    };
    
    const handleClearFilters = () => {
        setFilters({ keyword: '', rating: 'all', startDate: null, endDate: null });
        setPage(1);
    };
    
    const handleViewDetail = async (id) => {
        try {
            const { data } = await getReviewByIdAdminAPI(id);
            setCurrentReview(data);
            setShowDetail(true);
        } catch (err) {
            toast.error("Không thể tải chi tiết đánh giá.");
        }
    };
    
    const handleDelete = (id) => {
        if (window.confirm('Bạn có chắc muốn xóa đánh giá này?')) {
            dispatch(deleteReview(id));
        }
    };

    return (
        <Container fluid>
            <h2 className="my-3">Quản lý Đánh giá</h2>
            {error && <Alert variant="danger">{error}</Alert>}
            
            <InputGroup className="mb-3">
                <Form.Control value={filters.keyword} onChange={e => setFilters(prev => ({...prev, keyword: e.target.value}))} placeholder="Tìm kiếm (user, sản phẩm, bình luận)..." />
                <Form.Select value={filters.rating} onChange={e => handleFilterChange('rating', e.target.value)} style={{maxWidth: '150px'}}>
                    <option value="all">Tất cả điểm</option>
                    {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} sao</option>)}
                </Form.Select>
                
                {/* SỬA: Thêm dateFormat="dd/MM/yyyy" */}
                <DatePicker 
                    selected={filters.startDate} 
                    onChange={date => handleFilterChange('startDate', date)} 
                    className="form-control" 
                    placeholderText="Từ ngày" 
                    dateFormat="dd/MM/yyyy"
                />
                <DatePicker 
                    selected={filters.endDate} 
                    onChange={date => handleFilterChange('endDate', date)} 
                    className="form-control" 
                    placeholderText="Đến ngày" 
                    dateFormat="dd/MM/yyyy"
                />
                
                <Button variant="outline-secondary" onClick={handleClearFilters}>Bỏ lọc</Button>
            </InputGroup>
            
            {status === 'loading' ? <div className="text-center p-5"><Spinner /></div> : (
                <Table striped bordered hover responsive>
                    <thead><tr><th>ID</th><th style={{width: '250px'}}>User</th><th>Sản phẩm</th><th>Điểm</th><th>Bình luận</th><th>Ngày tạo</th><th>Hành động</th></tr></thead>
                    <tbody>
                        {reviews.map(r => (
                            <tr key={r.ReviewID}>
                                <td>{r.ReviewID}</td>
                                <td>
                                    <div className="d-flex align-items-center gap-2">
                                        <Image 
                                            src={resolveMediaUrl(r.user?.AvatarURL)} 
                                            roundedCircle 
                                            width={40} 
                                            height={40} 
                                            style={{objectFit: 'cover'}}
                                        />
                                        <div>
                                            <div className="fw-semibold">{r.user?.FullName || 'N/A'}</div>
                                            <small className="text-muted">{r.user?.Email}</small>
                                            <div>{getUserBadge(r.user)}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>{r.product?.Name || 'N/A'}</td>
                                <td>{renderStars(r.Rating)}</td>
                                <td title={r.Comment} className="text-truncate" style={{maxWidth: '200px'}}>{r.Comment || '-'}</td>
                                <td>{new Date(r.CreatedAt).toLocaleDateString('vi-VN')}</td>
                                <td>
                                    <Button variant="outline-info" size="sm" onClick={() => handleViewDetail(r.ReviewID)} className="me-2">Xem</Button>
                                    <Button variant="outline-danger" size="sm" onClick={() => handleDelete(r.ReviewID)}>Xóa</Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            {pagination.totalPages > 1 && (
                <Pagination>
                    {[...Array(pagination.totalPages).keys()].map(num => <Pagination.Item key={num+1} active={num+1 === page} onClick={() => setPage(num+1)}>{num+1}</Pagination.Item>)}
                </Pagination>
            )}
            
            <Modal show={showDetail} onHide={() => setShowDetail(false)} size="lg">
                <Modal.Header closeButton><Modal.Title>Chi tiết Đánh giá #{currentReview?.ReviewID}</Modal.Title></Modal.Header>
                <Modal.Body>
                    {currentReview ? (
                        <>
                            <Row>
                                <Col md={2} className="text-center">
                                    <Image src={resolveMediaUrl(currentReview.user?.AvatarURL)} roundedCircle width={80} height={80} style={{objectFit: 'cover'}} />
                                </Col>
                                <Col md={10}>
                                    <p>
                                        <strong>User:</strong> {currentReview.user?.FullName} ({currentReview.user?.Email})
                                        {getUserBadge(currentReview.user)}
                                    </p>
                                    <p><strong>Sản phẩm:</strong> {currentReview.product?.Name}</p>
                                    <div><strong>Điểm:</strong> {renderStars(currentReview.Rating)}</div>
                                    <p><strong>Ngày tạo:</strong> {new Date(currentReview.CreatedAt).toLocaleString('vi-VN')}</p>
                                </Col>
                            </Row>
                            <hr />
                            <p><strong>Bình luận:</strong></p>
                            <div style={{ fontStyle: currentReview.Comment ? 'normal' : 'italic' }}>
                                {currentReview.Comment || 'Không có bình luận'}
                            </div>
                            
                            {currentReview.media && currentReview.media.length > 0 && (
                                <>
                                    <hr />
                                    <p><strong>Media đính kèm:</strong></p>
                                    <div className="d-flex flex-wrap gap-2">
                                        {currentReview.media.map(m => (
                                            m.IsVideo 
                                            ? <video key={m.MediaURL} src={resolveMediaUrl(m.MediaURL)} controls style={{width: '150px', height: '150px', objectFit: 'cover', borderRadius: '8px'}} />
                                            : <Image key={m.MediaURL} src={resolveMediaUrl(m.MediaURL)} style={{width: '150px', height: '150px', objectFit: 'cover', borderRadius: '8px'}} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    ) : <div className="text-center p-5"><Spinner /></div>}
                </Modal.Body>
            </Modal>
        </Container>
    );
}