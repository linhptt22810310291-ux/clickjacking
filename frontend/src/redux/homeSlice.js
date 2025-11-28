// frontend/src/redux/homeSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getHomeDataAPI } from '../api'; // Import trực tiếp named export

export const fetchHomeData = createAsyncThunk('home/fetchData', async (_, { rejectWithValue }) => {
    try {
        console.log('🚀 fetchHomeData: Starting API call...');
        console.log('📡 getHomeDataAPI function:', typeof getHomeDataAPI);
        
        // Call API trực tiếp
        const response = await getHomeDataAPI();
        
        console.log('✅ fetchHomeData: API response received', {
            status: response.status,
            dataKeys: Object.keys(response.data || {}),
            productsCount: response.data?.products?.length,
            blogsCount: response.data?.blogs?.length
        });
        
        return response.data; 
    } catch (error) {
        console.error('❌ fetchHomeData: API call failed', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        
        // Trả về lỗi một cách an toàn
        return rejectWithValue(error.response?.data || { message: error.message || 'Lỗi mạng hoặc server không phản hồi' });
    }
});

const initialState = {
    products: [],
    blogs: [],
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
};

const homeSlice = createSlice({
    name: 'home',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchHomeData.pending, (state) => {
                console.log('⏳ homeSlice: fetchHomeData.pending');
                state.status = 'loading';
                state.error = null; // Xóa lỗi cũ khi bắt đầu request mới
            })
            .addCase(fetchHomeData.fulfilled, (state, action) => {
                console.log('✅ homeSlice: fetchHomeData.fulfilled', {
                    productsCount: action.payload?.products?.length,
                    blogsCount: action.payload?.blogs?.length
                });
                state.status = 'succeeded';
                // SỬA Ở ĐÂY: Gán dữ liệu một cách an toàn để tránh lỗi 'undefined'
                state.products = action.payload?.products || [];
                state.blogs = action.payload?.blogs || [];
            })
            .addCase(fetchHomeData.rejected, (state, action) => {
                console.error('❌ homeSlice: fetchHomeData.rejected', action.payload);
                state.status = 'failed';
                state.error = action.payload?.message || 'Không thể tải dữ liệu trang chủ.';
            });
    },
});

export default homeSlice.reducer;