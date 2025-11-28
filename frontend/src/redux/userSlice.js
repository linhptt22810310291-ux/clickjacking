// frontend/src/redux/userSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { jwtDecode } from "jwt-decode";
// SỬA Ở ĐÂY: Dùng namespace import để tạo đối tượng 'api'
import * as api from '../api';

// API Base URL for production
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// --- Async Thunks ---

// Thunk cho việc đăng nhập
export const loginUser = createAsyncThunk(
    'user/loginUser',
    async (credentials, { rejectWithValue }) => {
        try {
            console.log('📡 Calling loginAPI with:', { ...credentials, password: '***' });
            // SỬA Ở ĐÂY: Lấy response và trả về .data
            const response = await api.loginAPI(credentials);
            console.log('✅ Login response:', response.data);
            localStorage.setItem('token', response.data.token);
            if (credentials.remember) {
                localStorage.setItem('auth:rememberIdentifier', credentials.identifier);
            } else {
                localStorage.removeItem('auth:rememberIdentifier');
            }
            return response.data;
        } catch (error) {
            console.error('❌ Login error:', error.response?.data || error.message);
            console.error('📝 Error details:', JSON.stringify(error.response?.data, null, 2));
            if (error.response?.data?.errors) {
                error.response.data.errors.forEach((err, i) => {
                    console.error(`   Error ${i+1}: ${err.msg || err.message}`);
                });
            }
            return rejectWithValue(error.response.data);
        }
    }
);

// Thunk cho việc đăng ký
export const registerUser = createAsyncThunk(
    'user/registerUser',
    async (userData, { rejectWithValue }) => {
        try {
            const response = await api.registerAPI(userData);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

// Thunk để lấy thông tin profile của user
export const fetchUserProfile = createAsyncThunk(
    'user/fetchUserProfile', 
    async (_, { rejectWithValue }) => {
        try {
            const { data } = await api.getProfileAPI();
            return data;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

// Thunk để cập nhật thông tin profile (bao gồm cả avatar)
export const updateUserProfile = createAsyncThunk(
    'user/updateUserProfile', 
    async (formData, { rejectWithValue }) => {
        try {
            const { data } = await api.updateProfileAPI(formData);
            return data.profile; // Trả về profile đã cập nhật từ backend
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

// Thunk để đổi mật khẩu
export const changePassword = createAsyncThunk(
    'user/changePassword', 
    async (passwordData, { rejectWithValue }) => {
        try {
            const { data } = await api.changePasswordAPI(passwordData);
            return data;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

// Thunk cho quên mật khẩu
export const requestPasswordReset = createAsyncThunk(
    'user/requestPasswordReset',
    async (email, { rejectWithValue }) => {
        try {
            const { data } = await api.requestOtpAPI(email);
            return data;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);
export const resetPassword = createAsyncThunk(
    'user/resetPassword',
    async (payload, { rejectWithValue }) => {
        try {
            const { data } = await api.resetPasswordAPI(payload);
            return data;
        } catch (error) {
            return rejectWithValue(error.response.data);
        }
    }
);

const initialState = {
  isAuthenticated: false,
  token: null,
  user: null,
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    logout: (state) => {
      localStorage.removeItem('token');
      Object.assign(state, initialState);
    },
    loadUserFromToken: (state) => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                if (decoded.exp * 1000 > Date.now()) {
                    state.isAuthenticated = true;
                    state.token = token;
                    state.user = { 
                        id: decoded.id, 
                        role: decoded.role, 
                        username: decoded.username, 
                        email: decoded.email, 
                        avatar: decoded.avatar ? (decoded.avatar.startsWith("http") ? decoded.avatar : `${API_BASE_URL}${decoded.avatar}`) : null 
                    };
                    
                    // SỬA LỖI: Báo cho app biết đã tải xong
                    state.status = 'succeeded'; 

                } else {
                    localStorage.removeItem('token');
                    
                    // SỬA LỖI: Báo cho app biết đã thất bại
                    state.status = 'failed'; 
                }
            } catch (error) {
                 localStorage.removeItem('token');
                 
                 // SỬA LỖI: Báo cho app biết đã thất bại
                 state.status = 'failed'; 
            }
        } else {
            // SỬA LỖI: Không có token cũng là thất bại
            state.status = 'failed'; 
        }
    },
    clearStatus: (state) => {
        state.status = 'idle';
        state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Cases cho loginUser
      .addCase(loginUser.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.isAuthenticated = true;
        state.token = action.payload.token;
        // Dữ liệu user đầy đủ đã có trong action.payload.user từ backend
        state.user = {
            ...action.payload.user,
            role: action.payload.role, // Thêm role vào object user
        };
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.errors?.[0]?.msg || action.payload?.message || 'Đăng nhập thất bại';
      })
      // Cases cho registerUser
      .addCase(registerUser.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(registerUser.fulfilled, (state) => { state.status = 'succeeded'; })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload?.errors?.[0]?.msg || action.payload?.message || 'Đăng ký thất bại';
      })
      // Các cases còn lại giữ nguyên...
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
          const profileData = action.payload;
          //  Xử lý URL avatar trước khi cập nhật state
          if (profileData.avatar && !profileData.avatar.startsWith('http')) {
              profileData.avatar = `${API_BASE_URL}${profileData.avatar}`;
          }
          state.user = { ...state.user, ...profileData };
      })
      .addCase(updateUserProfile.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
          state.status = 'succeeded';
          state.user = { ...state.user, ...action.payload };
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
          state.status = 'failed';
          state.error = action.payload?.message || 'Cập nhật thất bại.';
      })
      .addCase(changePassword.pending, (state) => { state.status = 'loading'; state.error = null; })
      .addCase(changePassword.fulfilled, (state) => { state.status = 'succeeded'; })
      .addCase(changePassword.rejected, (state, action) => {
          state.status = 'failed';
          state.error = action.payload?.message || 'Đổi mật khẩu thất bại.';
      })
      .addCase(requestPasswordReset.pending, (state) => {
          state.status = 'loading';
          state.error = null;
      })
      .addCase(requestPasswordReset.fulfilled, (state) => {
          state.status = 'succeeded';
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
            state.status = 'failed';
            state.error = action.payload?.message || 'Yêu cầu thất bại.';
        })
      .addCase(resetPassword.pending, (state) => {
            state.status = 'loading';
            state.error = null;
        })
      .addCase(resetPassword.fulfilled, (state) => {
            state.status = 'succeeded';
        })
      .addCase(resetPassword.rejected, (state, action) => {
            state.status = 'failed';
            state.error = action.payload?.message || 'Đặt lại mật khẩu thất bại.';
        });
  },
});

export const { logout, loadUserFromToken, clearStatus } = userSlice.actions;

export const selectIsAuthenticated = (state) => state.user.isAuthenticated;
export const selectUser = (state) => state.user.user;
export const selectUserStatus = (state) => state.user.status;
export const selectUserError = (state) => state.user.error;

export default userSlice.reducer;