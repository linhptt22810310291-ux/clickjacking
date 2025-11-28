'use strict';
const db = require('../models');
const { Op, Sequelize } = require('sequelize');
const { startOfDay, startOfWeek, startOfMonth, subDays } = require('date-fns');
const { isPostgres, getTopProductsQuery, getTopProductsTotalQuery, getRevenueChartQuery, getOrdersChartQuery } = require('../utils/dbHelper');

// --- Helper Functions to define date ranges ---
const successfulOrderStatus = ['Confirmed', 'Shipped', 'Delivered'];
const today = new Date();
const todayStart = startOfDay(today);
const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
const monthStart = startOfMonth(today);
const last30DaysStart = subDays(today, 30);

/**
 * @route   GET /api/admin/home
 * @desc    Lấy dữ liệu TỔNG QUAN (KHÔNG BAO GỒM BẢNG)
 * @access  Private (Admin)
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const [
            totals,
            revenueStats,
            orderStatus,
            misc,
            revenueChart,
            ordersChart
        ] = await Promise.all([
            // SỬA: Đếm TẤT CẢ user, product, VÀ TẤT CẢ order
            Promise.all([
                db.User.count(),
                db.Product.count(),
                db.Order.count(), // Đếm tất cả Order
                db.GuestOrder.count() // Đếm tất cả GuestOrder
            ]),
            // 2. Lấy thống kê doanh thu (Hàm này vẫn chỉ tính đơn thành công, LÀ ĐÚNG)
            getRevenueStats(),
            // 3. Lấy số đơn hàng theo trạng thái
            getOrderStatusCounts(),
            // 4. Lấy các thông số khác
            Promise.all([
                db.User.count({ where: { CreatedAt: { [Op.gte]: subDays(today, 7) } } }),
                db.Wishlist.count()
            ]),
            // 5. Lấy dữ liệu biểu đồ doanh thu 30 ngày
            getRevenueChartData(),
            // 6. Lấy dữ liệu biểu đồ đơn hàng 30 ngày
            getOrdersChartData()
        ]);

        // SỬA: Xử lý dữ liệu totals mới
        const [totalUsers, totalProducts, totalUserOrders, totalGuestOrders] = totals;
        const [newUsers, wishlistItems] = misc;
        
        res.json({
            status: 'success',
            data: {
                totals: {
                    totalUsers,
                    totalProducts,
                    // SỬA: Doanh thu lấy từ revenueStats (chỉ đơn thành công)
                    totalRevenue: revenueStats.totalRevenue,
                    // SỬA: Tổng đơn hàng là tổng của cả 2 loại (tất cả trạng thái)
                    totalOrders: (totalUserOrders || 0) + (totalGuestOrders || 0)
                },
                revenue: {
                    day: { revenue: revenueStats.revenueDay, orders: revenueStats.ordersDay },
                    week: { revenue: revenueStats.revenueWeek, orders: revenueStats.ordersWeek },
                    month: { revenue: revenueStats.revenueMonth, orders: revenueStats.ordersMonth },
                },
                orderStatus,
                misc: { newUsers, guestOrders: totalGuestOrders, wishlistItems }, // SỬA: dùng totalGuestOrders
                charts: {
                    revenue: revenueChart,
                    orders: ordersChart,
                    // SỬA: Xóa topProducts và lowStock khỏi fetch này
                },
            },
        });

    } catch (error) {
        console.error('ADMIN HOME ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

// ===============================================
// === CÁC HÀM PHÂN TRANG MỚI CHO BẢNG        ===
// ===============================================

/**
 * @route   GET /api/admin/home/top-products
 * @desc    Lấy Top sản phẩm bán chạy (theo BIẾN THỂ) có phân trang
 * @access  Private (Admin)
 */
exports.getPaginatedTopProducts = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.max(1, parseInt(req.query.limit || '5', 10));
        const offset = (page - 1) * limit;

        // Use DB-compatible query from helper
        const query = getTopProductsQuery();
        const totalQuery = getTopProductsTotalQuery();

        const [rows, totalResult] = await Promise.all([
            db.sequelize.query(query, {
                replacements: { statuses: successfulOrderStatus, offset, limit },
                type: Sequelize.QueryTypes.SELECT,
                raw: true
            }),
            db.sequelize.query(totalQuery, {
                replacements: { statuses: successfulOrderStatus },
                type: Sequelize.QueryTypes.SELECT,
                raw: true
            })
        ]);
        
        const total = totalResult[0]?.totalItems || totalResult[0]?.totalitems || 0;
        res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) || 1 });

    } catch (error) {
        console.error('ADMIN TOP PRODUCTS ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};

/**
 * @route   GET /api/admin/home/low-stock
 * @desc    Lấy sản phẩm sắp hết hàng (theo BIẾN THỂ) có phân trang
 * @access  Private (Admin)
 */
exports.getPaginatedLowStock = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.max(1, parseInt(req.query.limit || '5', 10));
        const offset = (page - 1) * limit;

        const { count, rows } = await db.ProductVariant.findAndCountAll({
            where: { StockQuantity: { [Op.lt]: 5 } },
            include: [{ model: db.Product, as: 'product', attributes: ['Name'] }],
            order: [['StockQuantity', 'ASC']],
            limit,
            offset
        });
        
        res.json({ data: rows, total: count, page, limit, totalPages: Math.ceil(count / limit) || 1 });
    } catch (error) {
        console.error('ADMIN LOW STOCK ERROR:', error);
        res.status(500).json({ errors: [{ msg: 'Lỗi máy chủ' }] });
    }
};


// --- Các hàm truy vấn con (Không đổi) ---

async function getRevenueStats() {
    // ... (Hàm này giữ nguyên như trong File 4 của bạn)
    const [revDayO, ordDayO, revWeekO, ordWeekO, revMonthO, ordMonthO, totalRevO, totalOrdO] = await Promise.all([
        db.Order.sum('TotalAmount', { where: { Status: successfulOrderStatus, OrderDate: { [Op.gte]: todayStart } } }),
        db.Order.count({ where: { Status: successfulOrderStatus, OrderDate: { [Op.gte]: todayStart } } }),
        db.Order.sum('TotalAmount', { where: { Status: successfulOrderStatus, OrderDate: { [Op.gte]: weekStart } } }),
        db.Order.count({ where: { Status: successfulOrderStatus, OrderDate: { [Op.gte]: weekStart } } }),
        db.Order.sum('TotalAmount', { where: { Status: successfulOrderStatus, OrderDate: { [Op.gte]: monthStart } } }),
        db.Order.count({ where: { Status: successfulOrderStatus, OrderDate: { [Op.gte]: monthStart } } }),
        db.Order.sum('TotalAmount', { where: { Status: successfulOrderStatus } }),
        db.Order.count({ where: { Status: successfulOrderStatus } }),
    ]);

    const [revDayG, ordDayG, revWeekG, ordWeekG, revMonthG, ordMonthG, totalRevG, totalOrdG] = await Promise.all([
        db.GuestOrder.sum('TotalAmount', { where: { Status: successfulOrderStatus, OrderDate: { [Op.gte]: todayStart } } }),
        db.GuestOrder.count({ where: { Status: successfulOrderStatus, OrderDate: { [Op.gte]: todayStart } } }),
        db.GuestOrder.sum('TotalAmount', { where: { Status: successfulOrderStatus, OrderDate: { [Op.gte]: weekStart } } }),
        db.GuestOrder.count({ where: { Status: successfulOrderStatus, OrderDate: { [Op.gte]: weekStart } } }),
        db.GuestOrder.sum('TotalAmount', { where: { Status: successfulOrderStatus, OrderDate: { [Op.gte]: monthStart } } }),
        db.GuestOrder.count({ where: { Status: successfulOrderStatus, OrderDate: { [Op.gte]: monthStart } } }),
        db.GuestOrder.sum('TotalAmount', { where: { Status: successfulOrderStatus } }),
        db.GuestOrder.count({ where: { Status: successfulOrderStatus } }),
    ]);

    return {
        revenueDay: (revDayO || 0) + (revDayG || 0),
        ordersDay: (ordDayO || 0) + (ordDayG || 0),
        revenueWeek: (revWeekO || 0) + (revWeekG || 0),
        ordersWeek: (ordWeekO || 0) + (ordDayG || 0),
        revenueMonth: (revMonthO || 0) + (revMonthG || 0),
        ordersMonth: (ordMonthO || 0) + (ordMonthG || 0),
        totalRevenue: (totalRevO || 0) + (totalRevG || 0),
        totalOrders: (totalOrdO || 0) + (totalOrdG || 0), // Lưu ý: totalOrders ở đây là tổng đơn *thành công*
    };
}

async function getOrderStatusCounts() {
    const orderCounts = await db.Order.findAll({
        group: ['Status'],
        attributes: ['Status', [Sequelize.fn('COUNT', 'OrderID'), 'count']],
        raw: true
    });
    const guestOrderCounts = await db.GuestOrder.findAll({
        group: ['Status'],
        attributes: ['Status', [Sequelize.fn('COUNT', 'GuestOrderID'), 'count']],
        raw: true
    });

    const statusMap = {};
    [...orderCounts, ...guestOrderCounts].forEach(row => {
        statusMap[row.Status] = (statusMap[row.Status] || 0) + row.count;
    });
    return Object.entries(statusMap).map(([Status, count]) => ({ Status, count }));
}

async function getRevenueChartData() {
    return db.sequelize.query(getRevenueChartQuery(), {
        replacements: { statuses: successfulOrderStatus, startDate: last30DaysStart },
        type: Sequelize.QueryTypes.SELECT,
        raw: true
    });
}

async function getOrdersChartData() {
    return db.sequelize.query(getOrdersChartQuery(), {
        replacements: { statuses: successfulOrderStatus, startDate: last30DaysStart },
        type: Sequelize.QueryTypes.SELECT,
        raw: true
    });
}