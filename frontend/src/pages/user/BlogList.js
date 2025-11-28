// frontend/src/pages/Blog/BlogList.jsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Row, Col, Card, Form, Button, Breadcrumb,
  InputGroup, Spinner, FloatingLabel, Alert
} from 'react-bootstrap';
import ReactPaginate from 'react-paginate';
import { FaSearch, FaChevronLeft, FaChevronRight, FaClock } from 'react-icons/fa';

import {
  fetchBlogs,
  selectAllBlogs,
  selectBlogPagination,
  selectBlogStatus,
  selectBlogError,
} from '../../redux/blogSlice';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const PLACEHOLDER = '/blog-placeholder.jpg';
const LIMIT = 6;

export default function BlogList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const posts = useSelector(selectAllBlogs);
  const { total, page, totalPages } = useSelector(selectBlogPagination);
  const status = useSelector(selectBlogStatus);
  const error = useSelector(selectBlogError);

  const [kwInput, setKwInput] = useState(searchParams.get('keyword') || '');

  // Gọi API khi có thay đổi query string
  useEffect(() => {
    const params = Object.fromEntries(searchParams.entries());
    dispatch(fetchBlogs({ limit: LIMIT, ...params }));
  }, [searchParams, dispatch]);

  // Hàm cập nhật query string
  const setQS = (patch) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (!v) next.delete(k);
      else next.set(k, String(v));
    });
    if (!('page' in patch)) next.set('page', '1');
    setSearchParams(next);
  };

  // Submit tìm kiếm
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setQS({ keyword: kwInput.trim() });
  };

  // Bấm breadcrumb về trang chủ
  const handleGoHome = () => navigate('/');

  return (
    <div className="container py-4">
      <style>{`
        :root {
          --ink: #111;
          --muted: #6c757d;
          --line: #e9ecef;
          --card: #ffffff;
          --shadow: 0 8px 30px rgba(0,0,0,.08);
        }
        body { background:#f6f7f9; }

        .hero {
          background: radial-gradient(1000px 200px at 10% -20%, rgba(0,0,0,.06), transparent),
                      radial-gradient(800px 160px at 90% -10%, rgba(0,0,0,.05), transparent),
                      #fff;
          border: 1px solid var(--line);
          box-shadow: var(--shadow);
          border-radius: 18px;
          padding: 28px;
          margin-bottom: 24px;
        }
        .hero h1 { font-weight: 800; letter-spacing:-.3px; }
        .hero p  { color: var(--muted); margin: 0; }

        .post-card { border:1px solid var(--line); border-radius:14px; overflow:hidden; background:#fff; height:100%;
          transition: transform .2s ease, box-shadow .2s ease; }
        .post-card:hover { transform: translateY(-3px); box-shadow: 0 14px 38px rgba(0,0,0,.10); }
        .cover-wrap { position:relative; padding-bottom:56.5%; background:#fafafa; }
        .cover-wrap img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }

        .meta { color: var(--muted); font-size:.9rem; display:flex; gap:.75rem; align-items:center; flex-wrap:wrap; }
        .meta svg { opacity:.8; }

        .post-title a {
          color: #000;
          text-decoration: none;
          transition: color .2s ease;
        }
        .post-title a:hover {
          color: #444;
          text-decoration: underline;
        }

        .paginate { gap:.5rem; justify-content:center; }
        .paginate .page-item .page-link { border-radius:10px; min-width:42px; text-align:center; color:#000; border:1px solid var(--line); }
        .paginate .page-item.active .page-link { background:#000; border-color:#000; color:#fff; }
      `}</style>

      <Breadcrumb className="mb-3">
        <Breadcrumb.Item onClick={handleGoHome} style={{ cursor: 'pointer' }}>
          Trang chủ
        </Breadcrumb.Item>
        <Breadcrumb.Item active>Blog</Breadcrumb.Item>
      </Breadcrumb>

      <div className="hero">
        <h1>Blog & Cảm hứng</h1>
        <p>Xu hướng, mẹo phối đồ và các bài viết mới nhất từ chúng tôi.</p>
      </div>

      {/* Thanh công cụ tìm kiếm + sắp xếp */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-3 gap-3">
        <Form onSubmit={handleSearchSubmit} style={{ maxWidth: 420, width: '100%' }}>
          <InputGroup>
            <Form.Control
              placeholder="Tìm bài viết..."
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
            />
            <Button type="submit" variant="dark">
              <FaSearch />
            </Button>
          </InputGroup>
        </Form>

        <div className="d-flex flex-column flex-md-row align-items-md-center gap-2">
          <span className="fw-semibold">Tổng cộng {total} bài viết</span>
          <div style={{ minWidth: 220 }}>
            <FloatingLabel label="Sắp xếp">
              <Form.Select
                value={searchParams.get('sort') || ''}
                onChange={(e) => setQS({ sort: e.target.value })}
              >
                <option value="">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
              </Form.Select>
            </FloatingLabel>
          </div>
        </div>
      </div>

      {/* Nội dung chính */}
      {status === 'failed' && <Alert variant="danger">{error}</Alert>}

      {status === 'loading' ? (
        <div className="text-center py-5"><Spinner /></div>
      ) : posts.length === 0 ? (
        <div className="text-center text-muted py-5">
          <p>Không tìm thấy bài viết nào.</p>
        </div>
      ) : (
        <>
          <Row xs={1} sm={2} md={3} className="g-4">
            {posts.map((p) => (
              <Col key={p.BlogID}>
                <Card className="post-card">
                  <div className="cover-wrap">
                    <img
                      src={p.ImageURL ? `${API_BASE_URL}${p.ImageURL}` : PLACEHOLDER}
                      alt={p.Title}
                      onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                    />
                  </div>
                  <Card.Body>
                    <div className="meta mb-2">
                      <span>
                        <FaClock className="me-1" />
                        {new Date(p.CreatedAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    <Card.Title as="h6" className="post-title" style={{ minHeight: 48 }}>
                      <Link to={`/blog/${p.BlogID}`}>{p.Title}</Link>
                    </Card.Title>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>

          <div className="d-flex justify-content-center mt-4 pt-3 border-top">
            <ReactPaginate
              previousLabel={<FaChevronLeft />}
              nextLabel={<FaChevronRight />}
              breakLabel="..."
              forcePage={page - 1}
              pageCount={totalPages}
              marginPagesDisplayed={2}
              pageRangeDisplayed={3}
              onPageChange={(ev) => setQS({ page: ev.selected + 1 })}
              containerClassName="pagination paginate"
              pageClassName="page-item"
              pageLinkClassName="page-link"
              previousClassName="page-item"
              previousLinkClassName="page-link"
              nextClassName="page-item"
              nextLinkClassName="page-link"
              breakClassName="page-item"
              breakLinkClassName="page-link"
              activeClassName="active"
            />
          </div>
        </>
      )}
    </div>
  );
}
