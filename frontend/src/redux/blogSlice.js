// frontend/src/redux/blogSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '../api';

// --- Async Thunks ---

// Lấy danh sách blog
export const fetchBlogs = createAsyncThunk(
  'blogs/fetchBlogs',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await api.getBlogsAPI(params);
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || { message: 'Lỗi khi tải danh sách blog.' }
      );
    }
  }
);

// Lấy chi tiết 1 blog theo id
export const fetchBlogById = createAsyncThunk(
  'blogs/fetchBlogById',
  async (blogId, { rejectWithValue }) => {
    try {
      const { data } = await api.getBlogByIdAPI(blogId);
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || { message: 'Lỗi khi tải chi tiết blog.' }
      );
    }
  }
);

// Lấy bộ lọc blog (categories, tags)
// Hiện tại ../api CHƯA có getBlogCategoriesAPI, getBlogTagsAPI
// => Tạm thời trả về mảng rỗng để không bị lỗi import.
export const fetchBlogFilters = createAsyncThunk(
  'blogs/fetchFilters',
  async (_, { rejectWithValue }) => {
    try {
      // Sau này nếu bạn tạo API cho category/tag của blog,
      // chỉ cần sửa lại đoạn này:
      // const [categoriesRes, tagsRes] = await Promise.all([
      //   api.getBlogCategoriesAPI(),
      //   api.getBlogTagsAPI(),
      // ]);
      // return {
      //   categories: categoriesRes.data || [],
      //   tags: tagsRes.data || [],
      // };

      return {
        categories: [],
        tags: [],
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data || { message: 'Lỗi khi tải bộ lọc blog.' }
      );
    }
  }
);

// --- Initial State ---

const initialState = {
  posts: [],
  categories: [],
  tags: [],
  currentPost: null, // chi tiết bài viết đang xem
  pagination: {
    total: 0,
    page: 1,
    limit: 6, // nếu muốn 9 bài/trang thì đổi thành 9
    totalPages: 1,
  },
  status: 'idle',       // cho danh sách
  detailStatus: 'idle', // cho trang chi tiết
  error: null,
};

// --- Slice ---

const blogSlice = createSlice({
  name: 'blogs',
  initialState,
  reducers: {
    // Dọn dẹp state chi tiết khi rời trang
    clearCurrentPost: (state) => {
      state.currentPost = null;
      state.detailStatus = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ========= fetchBlogs (LIST) =========
      .addCase(fetchBlogs.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchBlogs.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.posts = action.payload.blogs;
        state.pagination = {
          total: action.payload.total,
          page: action.payload.page,
          limit: action.payload.limit,
          totalPages: Math.ceil(
            action.payload.total / action.payload.limit
          ),
        };
      })
      .addCase(fetchBlogs.rejected, (state, action) => {
        state.status = 'failed';
        state.error =
          action.payload?.message || 'Không thể tải bài viết.';
      })

      // ========= fetchBlogById (DETAIL) =========
      .addCase(fetchBlogById.pending, (state) => {
        state.detailStatus = 'loading';
      })
      .addCase(fetchBlogById.fulfilled, (state, action) => {
        state.detailStatus = 'succeeded';
        state.currentPost = action.payload;
      })
      .addCase(fetchBlogById.rejected, (state, action) => {
        state.detailStatus = 'failed';
        state.error =
          action.payload?.message || 'Không thể tải chi tiết bài viết.';
      })

      // ========= fetchBlogFilters =========
      .addCase(fetchBlogFilters.fulfilled, (state, action) => {
        state.categories = action.payload.categories;
        state.tags = action.payload.tags;
      });
  },
});

// --- Actions ---
export const { clearCurrentPost } = blogSlice.actions;

// --- Selectors ---
export const selectAllBlogs = (state) => state.blogs.posts;
export const selectBlogPagination = (state) => state.blogs.pagination;
export const selectBlogStatus = (state) => state.blogs.status;
export const selectBlogError = (state) => state.blogs.error;
export const selectBlogCategories = (state) => state.blogs.categories;
export const selectBlogTags = (state) => state.blogs.tags;
export const selectCurrentBlog = (state) => state.blogs.currentPost;
export const selectBlogDetailStatus = (state) => state.blogs.detailStatus;

export default blogSlice.reducer;
