import React, { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Container, Card, Spinner, Alert, Breadcrumb } from 'react-bootstrap';
import { FaUser, FaCalendarAlt } from 'react-icons/fa';
import {
  fetchBlogById,
  selectCurrentBlog,
  selectBlogDetailStatus,
  selectBlogError,
  clearCurrentPost,
} from '../../redux/blogSlice';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const PLACEHOLDER = 'https://placehold.co/800x400/e2e8f0/64748b?text=Blog';

export default function BlogDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const blog = useSelector(selectCurrentBlog);
  const status = useSelector(selectBlogDetailStatus);
  const error = useSelector(selectBlogError);

  useEffect(() => {
    if (id) dispatch(fetchBlogById(id));
    return () => dispatch(clearCurrentPost());
  }, [id, dispatch]);

  if (status === 'loading') {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error || 'Không thể tải bài viết.'}</Alert>
      </Container>
    );
  }

  if (!blog) {
    return (
      <Container className="py-5">
        <Alert variant="warning">Không tìm thấy bài viết.</Alert>
      </Container>
    );
  }

  const imageUrl = blog.ImageURL ? `${API_BASE_URL}${blog.ImageURL}` : PLACEHOLDER;

  return (
    <div className="blog-detail-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;700&display=swap');

        .blog-detail-page {
          background: #fafafa;
          min-height: 100vh;
          padding: 32px 0 60px;
          font-family: 'Inter', system-ui, sans-serif;
          color: #1e293b;
        }

      .blog-shell {
        max-width: 1180px; /* hoặc 1100px tùy bạn muốn rộng bao nhiêu */
        }


        .blog-breadcrumb {
          font-size: 0.95rem;
          margin-bottom: 1.2rem;
        }

        .blog-breadcrumb a {
          color: #0f172a;
          text-decoration: none;
          font-weight: 500;
        }

        .blog-breadcrumb a:hover {
          color: #2563eb;
        }

        .blog-card {
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          background: #ffffff;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
        }

        .blog-hero-image {
          width: 100%;
          padding-bottom: 46%;
          background: #e5e7eb;
          position: relative;
          overflow: hidden;
        }

        .blog-hero-image img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .blog-body {
          padding: 2.2rem 2.6rem;
        }

        .blog-badge {
          display: inline-block;
          padding: 0.3rem 0.9rem;
          border-radius: 999px;
          background: #111827;
          color: #fff;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .blog-title {
          font-family: 'Merriweather', serif;
          font-size: 2.1rem;
          font-weight: 700;
          margin: 1rem 0 0.6rem;
          color: #0f172a;
          line-height: 1.35;
        }

        @media (max-width: 768px) {
          .blog-title {
            font-size: 1.7rem;
          }
        }

        .blog-subtitle {
          color: #475569;
          font-size: 1rem;
          margin-bottom: 1.4rem;
          line-height: 1.6;
        }

        .blog-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1.2rem;
          font-size: 0.9rem;
          color: #64748b;
          padding: 0.8rem 0;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 1.8rem;
        }

        .blog-meta span {
          display: flex;
          align-items: center;
        }

        .blog-meta svg {
          margin-right: 0.4rem;
        }

        .blog-content {
          font-size: 1.03rem;
          line-height: 1.85;
          color: #1f2933;
        }

        .blog-content p {
          margin-bottom: 1.2rem;
        }

        .blog-content h1,
        .blog-content h2,
        .blog-content h3 {
          font-size: 1.15rem;
          font-weight: 600;
          margin-top: 1.6rem;
          margin-bottom: 0.6rem;
          color: #111827;
        }

        .blog-content ul,
        .blog-content ol {
          margin: 1rem 0 1rem 1.5rem;
        }

        .blog-content li {
          margin-bottom: 0.3rem;
        }

        .blog-content a {
          color: #334155;
          text-decoration: underline;
        }

        .blog-footer-bottom {
          margin-top: 2.4rem;
          padding-top: 1.2rem;
          border-top: 1px solid #e2e8f0;
          font-size: 0.88rem;
          color: #94a3b8;
        }
      `}</style>

      <Container className="blog-shell">
        {/* Breadcrumb */}
    
    <Breadcrumb className="blog-breadcrumb">
    <Breadcrumb.Item onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        Trang chủ
    </Breadcrumb.Item>
    <Breadcrumb.Item onClick={() => navigate('/blogs')} style={{ cursor: 'pointer' }}>
        Blog
    </Breadcrumb.Item>
    <Breadcrumb.Item active>{blog.Title}</Breadcrumb.Item>
    </Breadcrumb>

        <Card className="blog-card">
          <div className="blog-hero-image">
            <img
              src={imageUrl}
              alt={blog.Title}
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER;
              }}
            />
          </div>

          <Card.Body className="blog-body">
            <span className="blog-badge">Bài viết</span>
            <h1 className="blog-title">{blog.Title}</h1>
            <p className="blog-subtitle">
              Những góc nhìn, cảm hứng và kinh nghiệm chọn giày được tuyển chọn dành cho bạn.
            </p>

            <div className="blog-meta">
              <span>
                <FaUser /> {blog.Author || 'Admin'}
              </span>
              <span>
                <FaCalendarAlt /> {new Date(blog.CreatedAt).toLocaleDateString('vi-VN')}
              </span>
            </div>

            <div
              className="blog-content"
              dangerouslySetInnerHTML={{ __html: blog.Content }}
            />

            <div className="blog-footer-bottom">
              Đăng tải bởi {blog.Author || 'Admin'} –{' '}
              {new Date(blog.CreatedAt).toLocaleDateString('vi-VN')}
            </div>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}
