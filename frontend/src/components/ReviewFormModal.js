// src/components/ReviewFormModal.js
import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, Spinner, Image } from 'react-bootstrap';
import { FaStar } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { createReviewAPI } from '../api'; // POST /api/products/:productId/reviews (multipart/form-data)

function ReviewFormModal({ show, onHide, item, onReviewSubmitted }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // ---- IDs & tên sản phẩm
  const productId = item?.variant?.product?.ProductID || item?.ProductID;
  const productName = item?.ProductName || '';

  // OrderID và OrderItemID được truyền kèm từ Profile.jsx (đánh giá theo đơn)
  const orderId = item?.orderId;
  const orderItemId = item?.OrderItemID || item?.orderItemId; // ✅ NEW: Get OrderItemID for Size/Color tracking

  // ---- Chuẩn hóa ảnh + chọn đúng ảnh theo biến thể
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
  const PLACEHOLDER = 'https://placehold.co/400x400/e2e8f0/64748b?text=No+Image';
  const norm = (u) => (!u ? '' : (u.startsWith('http') ? u : `${API_BASE_URL}${u}`));

  // Ưu tiên ảnh của biến thể; sau đó đến ảnh mặc định của item/product
  const previewImage = (() => {
    const v = item?.variant || {};
    if (v.ImageURL) return norm(v.ImageURL);
    if (v.VariantImageURL) return norm(v.VariantImageURL);
    if (item?.ImageURL) return norm(item.ImageURL);
    if (v.ProductImage) return norm(v.ProductImage);
    if (v.product?.DefaultImage) return norm(v.product.DefaultImage);
    return PLACEHOLDER;
  })();

  useEffect(() => {
    if (show) {
      setRating(5);
      setComment('');
      setMediaFiles([]);
      setIsLoading(false);
    }
  }, [show, item]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 5) {
      toast.error('Chỉ được tải lên tối đa 5 file.');
      return;
    }
    setMediaFiles(files);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!productId) {
      toast.error('Lỗi: Không tìm thấy ProductID.');
      return;
    }
    if (!orderId) {
      toast.error('Lỗi: Không tìm thấy OrderID của đơn hàng.');
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append('orderId', orderId);
    if (orderItemId) formData.append('orderItemId', orderItemId); // ✅ NEW: Send OrderItemID
    formData.append('rating', rating);
    formData.append('comment', comment || '');
    // BE đọc field 'files'
    mediaFiles.forEach((file) => formData.append('files', file));

    try {
      await createReviewAPI(productId, formData); // multipart/form-data
      toast.success('Đánh giá của bạn đã được gửi thành công!');
      if (onReviewSubmitted) onReviewSubmitted(productId, orderId);
      onHide();
    } catch (error) {
      const msg = error?.response?.data?.errors?.[0]?.msg || 'Gửi đánh giá thất bại.';
      toast.error(msg);
      setIsLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <span className="fw-normal fs-6">Đánh giá sản phẩm:</span>
          <br /> {productName}
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {/* Ảnh + phân loại */}
          <div className="d-flex align-items-center mb-3">
            <Image
              src={previewImage}
              style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, marginRight: 12 }}
              alt="product"
              onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
            />
            <div>
              <div>
                <strong>Phân loại:</strong>{' '}
                {item?.Size ? `Size ${item.Size}` : '—'}
                {item?.Color ? (item?.Size ? ' - ' : '') + `Màu ${item.Color}` : ''}
              </div>
            </div>
          </div>

          {/* Rating */}
          <Form.Group className="mb-3 text-center">
            <Form.Label className="fw-semibold">Bạn chấm mấy sao?</Form.Label>
            <div>
              {[...Array(5)].map((_, i) => (
                <FaStar
                  key={i}
                  size={30}
                  color={i < rating ? '#FFD700' : '#ddd'}
                  onClick={() => setRating(i + 1)}
                  style={{ cursor: 'pointer', margin: '0 5px' }}
                />
              ))}
            </div>
          </Form.Group>

          {/* Comment */}
          <Form.Group className="mb-3">
            <Form.Label>Bình luận</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Hãy chia sẻ cảm nhận của bạn về sản phẩm..."
            />
          </Form.Group>

          {/* Media */}
          <Form.Group>
            <Form.Label>Thêm ảnh/video (Tối đa 5)</Form.Label>
            <Form.Control
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileChange}
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={isLoading}>
            Hủy
          </Button>
          <Button variant="primary" type="submit" disabled={isLoading}>
            {isLoading ? <Spinner size="sm" /> : 'Gửi đánh giá'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default ReviewFormModal;
