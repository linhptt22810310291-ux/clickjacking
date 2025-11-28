'use strict';

console.log('🚀 Server starting...');
console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 DATABASE_URL exists:', !!process.env.DATABASE_URL);

// 🔐 Load environment variables FIRST (before any other imports)
const dotenv = require("dotenv");
const path = require("path");

// Load .env file (only needed for local development, Render sets env vars directly)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '.env') });
}

console.log('✅ Dotenv loaded');

let express, cors, passport, GoogleStrategy, FacebookStrategy, multer, jwt, expressjwt, fs, axios;
let db;

try {
  express = require("express");
  cors = require("cors");
  passport = require("passport");
  GoogleStrategy = require("passport-google-oauth20").Strategy;
  FacebookStrategy = require("passport-facebook").Strategy;
  multer = require("multer");
  jwt = require("jsonwebtoken");
  expressjwt = require('express-jwt').expressjwt;
  fs = require("fs");
  axios = require("axios");
  console.log('✅ Core modules loaded');
} catch (err) {
  console.error('❌ Error loading core modules:', err.message);
  process.exit(1);
}

// --- TÍCH HỢP SEQUELIZE ---
try {
  db = require('./models');
  console.log('✅ Database models loaded');
} catch (err) {
  console.error('❌ Error loading database models:', err.message);
  console.error(err.stack);
  process.exit(1);
}

// 🚨 SIMPLE LOGGER (không dùng winston để tránh crash)
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args)
};

// 🛡️ ANTI-CLICKJACKING MIDDLEWARE
const { antiClickjacking, presets, detectIframeRequest, testAntiClickjacking } = require('./middleware/antiClickjacking');

// 🛡️ ADVANCED SECURITY MIDDLEWARE
const {
  helmetMiddleware,
  enforceHTTPS,
  additionalSecurityHeaders,
  rateLimiters,
  sanitizeData,
  preventXSS,
  preventHPP,
  detectSuspiciousActivity,
  requestLogger,
} = require('./middleware/security.middleware');

// 🔐 SESSION & MFA MIDDLEWARE
const { sessionManager } = require('./middleware/session.middleware');

// 🔐 NEW SECURITY FEATURES
const { sessionMiddleware: captchaSession, generateCaptcha, verifyCaptcha } = require('./middleware/captcha.middleware');
const { csrfProtection, verifyCsrfToken, getCsrfToken } = require('./middleware/csrf.middleware');
const { firewallMiddleware, ipRateLimit } = require('./middleware/firewall.middleware');
const { verifyEmailToken, resendVerificationEmail } = require('./services/emailVerification.service');

const app = express();

/* ---------------- SECURITY MIDDLEWARES (Áp dụng đầu tiên) ---------------- */
// 🔐 1. HTTP Security Headers (Helmet) - CSP được set loose cho development
app.use(helmetMiddleware);

// 🔒 2. HTTPS Enforcement (chỉ trong production)
if (process.env.NODE_ENV === 'production') {
  app.use(enforceHTTPS);
  app.use(additionalSecurityHeaders); // Chỉ thêm strict headers trong production
}

// 🧹 3. Data Sanitization - Chống Injection Attacks (Chỉ cho API routes, không cho static files)
// Sẽ apply sau khi setup CORS và static files

/* ---------------- CORS & Middlewares cơ bản ---------------- */
const corsOptions = {
  origin: function (origin, callback) {
    // Cho phép requests từ:
    // 1. Frontend React (localhost:3000)
    // 2. Bot Control Panel (file:// = origin null)
    // 3. Không có origin (Postman, curl, bot scripts)
    const allowedOrigins = ['http://localhost:3000', 'http://localhost:5000'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Cho phép tất cả trong development
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Client-IP'],
  exposedHeaders: ['X-Session-ID'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ⚠️ RE-ENABLE CAPTCHA SESSION (needed for login)
// 🔐 CAPTCHA Session (must be before other session middlewares)
app.use(captchaSession);

// 🔐 6. Session Management
app.use(sessionManager);

// 🔥 7. FIREWALL - Block malicious IPs (BẬT)
app.use(firewallMiddleware);

// 🚦 8. IP-based Rate Limiting (BẬT) - Chống DDoS cấp IP
// Loại trừ các routes quan trọng khỏi rate limit
app.use((req, res, next) => {
  // Skip rate limit cho các routes cần thiết
  const skipPaths = [
    '/api/security',    // Security dashboard
    '/api/bot-stats',   // Bot statistics
    '/api/captcha',     // CAPTCHA generation (cần cho login)
    '/api/home',        // Trang chủ
  ];
  
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  return ipRateLimit(100, 60000)(req, res, next); // 100 requests / 60 giây
});

// ✅ SECURITY STATUS - TẤT CẢ ĐÃ BẬT:
// ✅ CAPTCHA Session: ENABLED (required for login captcha)
// ✅ Session Manager: ENABLED (max 3 concurrent sessions, 30min timeout)
// ✅ Anti-Clickjacking: ENABLED (X-Frame-Options: DENY)
// ✅ Rate Limiting: ENABLED (API: 15/phút, Login: 5/15min)
// ✅ Helmet: ENABLED (XSS protection, HSTS, noSniff)
// ✅ Data Sanitization: ENABLED (XSS, SQL Injection prevention)
// ✅ Bot Detection: ENABLED (via Rate Limiting)
// ✅ Firewall: ENABLED (Block malicious IPs)
// ✅ IP Rate Limit: ENABLED (DDoS protection)
// ⚠️ CSRF: DISABLED (conflicts with API-first design)

// 🛡️ ANTI-CLICKJACKING PROTECTION - ENABLED
app.use(antiClickjacking(presets.dev)); // Dùng dev preset để có logging
app.use(detectIframeRequest); // Phát hiện requests từ iframe
app.use(testAntiClickjacking); // Thêm debug headers

// --- Cấu hình Multer và Static Files (giữ nguyên) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Serve các file tĩnh từ thư mục uploads (với CORS headers)
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Serve ảnh blog qua đường dẫn /images (map vào thư mục uploads/blogs)
app.use('/images', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads', 'blogs')));

// 🧹 Áp dụng Data Sanitization CHỈ cho API routes (sau static files)
app.use('/api', sanitizeData);  // Chống NoSQL Injection
app.use('/api', preventXSS);    // Chống XSS
app.use('/api', preventHPP);    // Chống HTTP Parameter Pollution

// 📝 Request Logger - Ghi log API requests
app.use('/api', requestLogger);

// 🚨 Suspicious Activity Detection - Chỉ cho API routes
app.use('/api', detectSuspiciousActivity);

  

/* ---------------- MIDDLEWARE XÁC THỰC ---------------- */

// Middleware xác thực JWT cho các route /api/admin (TRỪ route login và register)
const adminJwtMiddleware = expressjwt({ 
  secret: process.env.JWT_SECRET, 
  algorithms: ['HS256']
});

// ✅ Áp dụng JWT chỉ cho các route admin CẦN xác thực (không áp dụng cho /auth)
app.use('/api/admin', (req, res, next) => {
  // Bỏ qua JWT cho route login/register
  if (req.path.startsWith('/auth')) {
    return next();
  }
  // Áp dụng JWT cho các route khác
  adminJwtMiddleware(req, res, (err) => {
    if (err) {
      return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
    req.user = req.auth; // gắn payload vào req.user
    next();
  });
});


// Middleware xác thực JWT cho các route user cần đăng nhập
const authenticateUser = expressjwt({ secret: process.env.JWT_SECRET, algorithms: ['HS256'] });

// Middleware xác thực "tùy chọn" cho wishlist
const authenticateWishlistOptional = expressjwt({
    secret: process.env.JWT_SECRET,
    algorithms: ['HS256'],
    credentialsRequired: false // Quan trọng: không báo lỗi nếu thiếu token
});


/* ---------------- PASSPORT - SOCIAL LOGIN (REFACTORED) ---------------- */
app.use(passport.initialize());

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        // Sử dụng Sequelize: Tìm user bằng email, nếu không có thì tạo mới
        const [user, created] = await db.User.findOrCreate({
            where: { Email: email },
            defaults: {
                Username: profile.displayName.replace(/\s/g, '') + Date.now().toString().slice(-4), // Tạo username unique
                Password: 'provided_by_google', // Mật khẩu không dùng cho OAuth
                Role: 'user',
                FullName: profile.displayName,
                AvatarURL: profile.photos?.[0]?.value || null,
            }
        });
        return done(null, user);
      } catch (err) {
        console.error("Google OAuth error:", err);
        return done(err, null);
      }
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ["id", "displayName", "photos", "email"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || `${profile.id}@facebook-placeholder.com`;
        const [user, created] = await db.User.findOrCreate({
            where: { Email: email },
            defaults: {
                Username: profile.displayName.replace(/\s/g, '') + Date.now().toString().slice(-4),
                Password: 'provided_by_facebook',
                Role: 'user',
                FullName: profile.displayName,
                AvatarURL: profile.photos?.[0]?.value || null,
            }
        });
        return done(null, user);
      } catch (err) {
        console.error("Facebook OAuth error:", err);
        return done(err, null);
      }
    }
  )
);


/* ---------------- IMPORT ROUTERS (Đã được refactor) ---------------- */
// User-facing routes
const authRouter = require('./routes/user/auth');
const profileRouter = require('./routes/user/profile');
const productsUserRouter = require('./routes/user/productsUser');
const cartUserRouter = require('./routes/user/cartUser');
const blogsUserRouter = require('./routes/user/blogsUser');
const addressesUserRouter = require('./routes/user/addressesUser');
const homeRouter = require('./routes/user/homeUser');
const userCouponsRoute = require('./routes/user/coupons');
const shippingRouter = require('./routes/user/shipping');
const userPaymentMethodsRouter = require('./routes/user/paymentMethods');
const { userOrdersRouter, guestOrdersRouter } = require('./routes/user/ordersUser');
const guestHistoryRouter = require('./routes/user/guestHistory');
const passwordRouter = require('./routes/user/password');
const wishlistUserRouter = require('./routes/user/wishlist');
const paymentRoutes = require('./routes/payment.route');
// Admin routes
const adminAuthRoutes = require("./routes/admin/authAdmin");
const adminBlogsRouter = require("./routes/admin/blogsAdmin");
const adminCategoriesRouter = require("./routes/admin/categoriesAdmin");
const adminCouponsRouter = require("./routes/admin/couponsAdmin");
const adminDashboardRouter = require("./routes/admin/homeAdmin");
const adminOrdersRouter = require("./routes/admin/ordersAdmin");
const adminPaymentMethodsRouter = require("./routes/admin/paymentMethods");
const adminProductsRouter = require("./routes/admin/productsAdmin");
const adminReviewsRouter = require("./routes/admin/reviews");
const adminUsersRouter = require("./routes/admin/usersAdmin")(upload); // Truyền `upload` vào cho route này

const paymentRouter = require('./routes/payment.route');
app.use('/api/payment', paymentRouter);

// 🛡️ Bot Detection & Stats Routes
const { trackPageVisit, detectBot } = require('./middleware/botDetection');
const botStatsRouter = require('./routes/bot-stats.route');

/* ---------------- USE ROUTERS (Tổ chức lại theo prefix) ---------------- */
const apiRouter = express.Router();

// 🔐 Security Endpoints (public - no auth required)
apiRouter.get('/captcha', generateCaptcha);
apiRouter.get('/csrf-token', getCsrfToken);
apiRouter.get('/verify-email', verifyEmailToken);
apiRouter.post('/resend-verification', resendVerificationEmail);

// 🎯 Bot Stats API - Real-time monitoring (không cần bot detection)
apiRouter.use('/bot-stats', botStatsRouter);

// 🛡️ Public User Routes - TẤT CẢ đều có Rate Limiting chống Bot Attack (30 req/phút/IP)
apiRouter.use('/auth', authRouter);
apiRouter.use('/products', rateLimiters.api, productsUserRouter);
apiRouter.use('/blogs', rateLimiters.api, blogsUserRouter);
apiRouter.use('/home', rateLimiters.api, homeRouter);
apiRouter.use('/shipping', rateLimiters.api, shippingRouter);
apiRouter.use('/payment-methods', rateLimiters.api, userPaymentMethodsRouter);
apiRouter.use('/guest-history', rateLimiters.api, guestHistoryRouter);
apiRouter.use('/guest-orders', rateLimiters.api, guestOrdersRouter);
apiRouter.use('/password', passwordRouter);
apiRouter.use('/payment', paymentRoutes);

// 🛡️ User Routes - Có Rate Limiting
apiRouter.use('/cart', rateLimiters.api, cartUserRouter);
apiRouter.use('/user/coupons', rateLimiters.api, userCouponsRoute);

// Authenticated User Routes
const userAuthMiddleware = (req, res, next) => { if(req.auth) req.user = req.auth; next(); };
apiRouter.use('/profile', authenticateUser, userAuthMiddleware, profileRouter);
apiRouter.use('/addresses', authenticateUser, userAuthMiddleware, addressesUserRouter);
apiRouter.use('/user/orders', authenticateUser, userAuthMiddleware, userOrdersRouter);
apiRouter.use('/wishlist', authenticateWishlistOptional, userAuthMiddleware, wishlistUserRouter);

// Admin Routes (đã có middleware /api/admin ở trên)
apiRouter.use('/admin/auth', adminAuthRoutes);
apiRouter.use('/admin/blogs', adminBlogsRouter);
apiRouter.use('/admin/categories', adminCategoriesRouter);
apiRouter.use('/admin/coupons', adminCouponsRouter);
apiRouter.use('/admin/home', adminDashboardRouter);
apiRouter.use('/admin/orders', adminOrdersRouter);
apiRouter.use('/admin/payment-methods', adminPaymentMethodsRouter);
apiRouter.use('/admin/products', adminProductsRouter);
apiRouter.use('/admin/reviews', adminReviewsRouter);
apiRouter.use('/admin/users', adminUsersRouter);

// 🛡️ Security Monitor (PUBLIC - không cần auth)
const securityRouter = require('./routes/admin/security.route');
apiRouter.use('/security', securityRouter);

// Gắn router chính vào /api
app.use('/api', apiRouter);

/* ---------------- API CURRENT USER (REFACTORED) ---------------- */
app.get("/api/current_user", authenticateUser, async (req, res) => {
    try {
        const user = await db.User.findByPk(req.auth.id, {
            attributes: ['UserID', 'Username', 'Email', 'Role', 'AvatarURL']
        });
        if (!user) return res.status(404).json(null);
        
        const userData = user.get({ plain: true });
        res.json({
            ...userData,
            avatar: userData.AvatarURL ? `${process.env.BASE_URL || 'http://localhost:5000'}${userData.AvatarURL}` : null,
        });
    } catch (err) {
        res.status(500).json(null);
    }
});


/* ---------------- OAUTH ROUTES (REFACTORED) ---------------- */
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "http://localhost:3000/login", session: false }), (req, res) => {
    const user = req.user.get({ plain: true });
    const payload = { id: user.UserID, role: user.Role, username: user.Username, email: user.Email, avatar: user.AvatarURL };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.redirect(`http://localhost:3000/login?token=${token}&role=${user.Role}`);
});

app.get("/auth/facebook", passport.authenticate("facebook", { scope: ["email"], session: false }));
app.get("/auth/facebook/callback", passport.authenticate("facebook", { failureRedirect: "http://localhost:3000/login", session: false }), (req, res) => {
    const user = req.user.get({ plain: true });
    const payload = { id: user.UserID, role: user.Role, username: user.Username, email: user.Email, avatar: user.AvatarURL };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.redirect(`http://localhost:3000/login?token=${token}&role=${user.Role}`);
});


/* ---------------- ERROR HANDLER ---------------- */
app.use((err, req, res, next) => {
    if (err && err.name === 'UnauthorizedError') {
        return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
    // Thêm các xử lý lỗi khác nếu cần
    console.error(err.stack);
    res.status(500).send('Something broke!');
});


/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 5000;

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  logger.error(`Uncaught Exception: ${error.message}`);
  // Không exit process để server tiếp tục chạy
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error(`Unhandled Rejection: ${reason}`);
});

// Log all environment variables (for debugging)
console.log('🔧 Environment check:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  hasDbUrl: !!process.env.DATABASE_URL,
  hasJwtSecret: !!process.env.JWT_SECRET
});

db.sequelize.authenticate()
  .then(() => {
    console.log('✅ Kết nối CSDL thành công bằng Sequelize.');
    
    // Trong production, sync database để tạo tables
    if (process.env.NODE_ENV === 'production') {
      return db.sequelize.sync({ alter: false }).then(() => {
        console.log('🔄 Database synced successfully.');
      });
    }
  })
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`🚀 Backend đang chạy tại http://localhost:${PORT}`);
      console.log(`🚀 Backend đang chạy tại http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Kết nối CSDL thất bại:', err.message);
    console.error('❌ Full error:', err);
    process.exit(1);
  });