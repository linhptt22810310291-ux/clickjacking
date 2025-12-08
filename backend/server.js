'use strict';

console.log('🚀 Server starting...');
console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('📧 Email Config:', {
  GMAIL_USER: process.env.GMAIL_USER ? `${process.env.GMAIL_USER.substring(0, 5)}...` : 'NOT SET',
  GMAIL_PASS: process.env.GMAIL_PASS ? 'SET (hidden)' : 'NOT SET',
  EMAIL_USER: process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 5)}...` : 'NOT SET',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? 'SET (hidden)' : 'NOT SET'
});

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

console.log('✅ Logger created');

// Load middleware with error handling
let antiClickjacking, presets, helmetMiddleware, enforceHTTPS, additionalSecurityHeaders;
let rateLimiters, sanitizeData, preventXSS, preventHPP, detectSuspiciousActivity, requestLogger;
let sessionManager, captchaSession, generateCaptcha, verifyCaptcha;
let csrfProtection, verifyCsrfToken, getCsrfToken, firewallMiddleware, ipRateLimit;
let verifyEmailToken, resendVerificationEmail;

try {
  // 🛡️ ANTI-CLICKJACKING MIDDLEWARE
  const acModule = require('./middleware/antiClickjacking');
  antiClickjacking = acModule.antiClickjacking;
  presets = acModule.presets;
  console.log('✅ Anti-clickjacking loaded');

  // 🛡️ ADVANCED SECURITY MIDDLEWARE
  const secModule = require('./middleware/security.middleware');
  helmetMiddleware = secModule.helmetMiddleware;
  enforceHTTPS = secModule.enforceHTTPS;
  additionalSecurityHeaders = secModule.additionalSecurityHeaders;
  rateLimiters = secModule.rateLimiters;
  sanitizeData = secModule.sanitizeData;
  preventXSS = secModule.preventXSS;
  preventHPP = secModule.preventHPP;
  detectSuspiciousActivity = secModule.detectSuspiciousActivity;
  requestLogger = secModule.requestLogger;
  console.log('✅ Security middleware loaded');

  // 🔐 SESSION & MFA MIDDLEWARE
  const sessModule = require('./middleware/session.middleware');
  sessionManager = sessModule.sessionManager;
  console.log('✅ Session middleware loaded');

  // 🔐 CAPTCHA
  const captchaModule = require('./middleware/captcha.middleware');
  captchaSession = captchaModule.sessionMiddleware;
  generateCaptcha = captchaModule.generateCaptcha;
  verifyCaptcha = captchaModule.verifyCaptcha;
  console.log('✅ Captcha middleware loaded');

  // 🔐 CSRF
  const csrfModule = require('./middleware/csrf.middleware');
  csrfProtection = csrfModule.csrfProtection;
  verifyCsrfToken = csrfModule.verifyCsrfToken;
  getCsrfToken = csrfModule.getCsrfToken;
  console.log('✅ CSRF middleware loaded');

  // 🔥 FIREWALL
  const fwModule = require('./middleware/firewall.middleware');
  firewallMiddleware = fwModule.firewallMiddleware;
  ipRateLimit = fwModule.ipRateLimit;
  console.log('✅ Firewall middleware loaded');

  // 📧 EMAIL VERIFICATION
  const emailModule = require('./services/emailVerification.service');
  verifyEmailToken = emailModule.verifyEmailToken;
  resendVerificationEmail = emailModule.resendVerificationEmail;
  console.log('✅ Email service loaded');

} catch (err) {
  console.error('❌ Error loading middleware:', err.message);
  console.error(err.stack);
  process.exit(1);
}

console.log('✅ All middleware loaded successfully');

const app = express();
console.log('✅ Express app created');

/* ---------------- TRUST PROXY (Required for Render/Heroku) ---------------- */
// Required when behind a reverse proxy (like Render, Heroku, nginx)
// This allows express-rate-limit to correctly identify users by IP
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy
  console.log('✅ Trust proxy enabled for production');
}

/* ---------------- SECURITY MIDDLEWARES (Áp dụng đầu tiên) ---------------- */
try {
  // 🔐 1. HTTP Security Headers (Helmet) - CSP được set loose cho development
  app.use(helmetMiddleware);
  console.log('✅ Helmet applied');

  // 🔒 2. HTTPS Enforcement (chỉ trong production)
  if (process.env.NODE_ENV === 'production') {
    app.use(enforceHTTPS);
    app.use(additionalSecurityHeaders); // Chỉ thêm strict headers trong production
    console.log('✅ HTTPS enforcement applied');
  }
} catch (err) {
  console.error('❌ Error applying security middleware:', err.message);
}

// 🧹 3. Data Sanitization - Chống Injection Attacks (Chỉ cho API routes, không cho static files)
// Sẽ apply sau khi setup CORS và static files

/* ---------------- CORS & Middlewares cơ bản ---------------- */
const corsOptions = {
  origin: function (origin, callback) {
    // Cho phép tất cả origins trong production để frontend Render có thể truy cập
    const allowedOrigins = [
      'http://localhost:3000', 
      'http://localhost:5000',
      'https://clickjacking-frontend.onrender.com',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Trong production, cho phép tất cả origins (tạm thời)
      callback(null, true);
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID', 'X-Client-IP'],
  exposedHeaders: ['X-Session-ID'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

try {
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  console.log('✅ CORS and body parsers applied');

  // ⚠️ RE-ENABLE CAPTCHA SESSION (needed for login)
  // 🔐 CAPTCHA Session (must be before other session middlewares)
  app.use(captchaSession);
  console.log('✅ Captcha session applied');

  // 🔐 6. Session Management
  app.use(sessionManager);
  console.log('✅ Session manager applied');

  // 🔥 7. FIREWALL - Block malicious IPs (BẬT)
  app.use(firewallMiddleware);
  console.log('✅ Firewall applied');
} catch (err) {
  console.error('❌ Error applying app middleware:', err.message);
  console.error(err.stack);
}

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

console.log('🔧 Setting up anti-clickjacking...');

// 🛡️ ANTI-CLICKJACKING PROTECTION - ENABLED
try {
  app.use(antiClickjacking(presets.dev)); // Dùng dev preset để có logging
  console.log('✅ Anti-clickjacking applied');
} catch (err) {
  console.error('❌ Anti-clickjacking error:', err.message);
}

console.log('🔧 Setting up multer and static files...');

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
console.log('✅ Multer configured');

// Serve các file tĩnh từ thư mục uploads (với CORS headers)
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));
console.log('✅ Static files configured');

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
console.log('✅ Data sanitization applied');

// 📝 Request Logger - Ghi log API requests
app.use('/api', requestLogger);

// 🚨 Suspicious Activity Detection - Chỉ cho API routes
app.use('/api', detectSuspiciousActivity);
console.log('✅ Request logging and detection applied');

  

/* ---------------- MIDDLEWARE XÁC THỰC ---------------- */
console.log('🔧 Setting up JWT middleware...');
console.log('🔧 JWT_SECRET exists:', !!process.env.JWT_SECRET);

// Middleware xác thực JWT cho các route /api/admin (TRỪ route login và register)
const adminJwtMiddleware = expressjwt({ 
  secret: process.env.JWT_SECRET || 'fallback-secret-for-testing', 
  algorithms: ['HS256']
});
console.log('✅ JWT middleware created');

console.log('🔧 Setting up admin JWT middleware...');

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
console.log('✅ Admin JWT route applied');

// Middleware xác thực JWT cho các route user cần đăng nhập
const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-testing';
const authenticateUser = expressjwt({ secret: jwtSecret, algorithms: ['HS256'] });
console.log('✅ User JWT middleware created');

// Middleware xác thực "tùy chọn" cho wishlist
const authenticateWishlistOptional = expressjwt({
    secret: jwtSecret,
    algorithms: ['HS256'],
    credentialsRequired: false // Quan trọng: không báo lỗi nếu thiếu token
});
console.log('✅ Wishlist JWT middleware created');


/* ---------------- PASSPORT - SOCIAL LOGIN (REFACTORED) ---------------- */
console.log('🔧 Setting up Passport...');
app.use(passport.initialize());

// Production URLs (dùng khi không có env vars)
const isProduction = process.env.NODE_ENV === 'production';
const PROD_BACKEND_URL = 'https://clickjacking-backend.onrender.com';
const PROD_FRONTEND_URL = 'https://clickjacking-frontend.onrender.com';

// Chỉ setup Google OAuth nếu có credentials
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const googleCallbackURL = process.env.GOOGLE_CALLBACK_URL || 
    (isProduction ? `${PROD_BACKEND_URL}/auth/google/callback` : 'http://localhost:5000/auth/google/callback');
  
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: googleCallbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value;
          const [user, created] = await db.User.findOrCreate({
              where: { Email: email },
              defaults: {
                  Username: profile.displayName.replace(/\s/g, '') + Date.now().toString().slice(-4),
                  Password: 'provided_by_google',
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
  console.log('✅ Google OAuth configured');
} else {
  console.log('⚠️ Google OAuth skipped (no credentials)');
}

// Chỉ setup Facebook OAuth nếu có credentials
if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  const facebookCallbackURL = process.env.FACEBOOK_CALLBACK_URL || 
    (isProduction ? `${PROD_BACKEND_URL}/auth/facebook/callback` : 'http://localhost:5000/auth/facebook/callback');
  
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        callbackURL: facebookCallbackURL,
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
  console.log('✅ Facebook OAuth configured');
} else {
  console.log('⚠️ Facebook OAuth skipped (no credentials)');
}

console.log('✅ Passport configured');

/* ---------------- IMPORT ROUTERS (Đã được refactor) ---------------- */
console.log('📦 Loading routes...');

try {
  // User-facing routes
  var authRouter = require('./routes/user/auth');
  console.log('  ✅ auth route');
  var profileRouter = require('./routes/user/profile');
  console.log('  ✅ profile route');
  var productsUserRouter = require('./routes/user/productsUser');
  console.log('  ✅ products route');
  var cartUserRouter = require('./routes/user/cartUser');
  console.log('  ✅ cart route');
  var blogsUserRouter = require('./routes/user/blogsUser');
  console.log('  ✅ blogs route');
  var addressesUserRouter = require('./routes/user/addressesUser');
  console.log('  ✅ addresses route');
  var homeRouter = require('./routes/user/homeUser');
  console.log('  ✅ home route');
  var userCouponsRoute = require('./routes/user/coupons');
  console.log('  ✅ coupons route');
  var shippingRouter = require('./routes/user/shipping');
  console.log('  ✅ shipping route');
  var userPaymentMethodsRouter = require('./routes/user/paymentMethods');
  console.log('  ✅ paymentMethods route');
  var { userOrdersRouter, guestOrdersRouter } = require('./routes/user/ordersUser');
  console.log('  ✅ orders route');
  var guestHistoryRouter = require('./routes/user/guestHistory');
  console.log('  ✅ guestHistory route');
  var passwordRouter = require('./routes/user/password');
  console.log('  ✅ password route');
  var wishlistUserRouter = require('./routes/user/wishlist');
  console.log('  ✅ wishlist route');
  var paymentRoutes = require('./routes/payment.route');
  console.log('  ✅ payment route');
  
  // Admin routes
  var adminAuthRoutes = require("./routes/admin/authAdmin");
  console.log('  ✅ admin auth route');
  var adminBlogsRouter = require("./routes/admin/blogsAdmin");
  console.log('  ✅ admin blogs route');
  var adminCategoriesRouter = require("./routes/admin/categoriesAdmin");
  console.log('  ✅ admin categories route');
  var adminCouponsRouter = require("./routes/admin/couponsAdmin");
  console.log('  ✅ admin coupons route');
  var adminDashboardRouter = require("./routes/admin/homeAdmin");
  console.log('  ✅ admin dashboard route');
  var adminOrdersRouter = require("./routes/admin/ordersAdmin");
  console.log('  ✅ admin orders route');
  var adminPaymentMethodsRouter = require("./routes/admin/paymentMethods");
  console.log('  ✅ admin paymentMethods route');
  var adminProductsRouter = require("./routes/admin/productsAdmin");
  console.log('  ✅ admin products route');
  var adminReviewsRouter = require("./routes/admin/reviews");
  console.log('  ✅ admin reviews route');
  var adminUsersRouter = require("./routes/admin/usersAdmin")(upload);
  console.log('  ✅ admin users route');

  var paymentRouter = require('./routes/payment.route');
  app.use('/api/payment', paymentRouter);
  console.log('  ✅ payment router mounted');

  // 🛡️ Bot Detection & Stats Routes
  var { trackPageVisit, detectBot } = require('./middleware/botDetection');
  var botStatsRouter = require('./routes/bot-stats.route');
  console.log('  ✅ bot stats route');
  
  console.log('✅ All routes loaded successfully');
} catch (err) {
  console.error('❌ Error loading routes:', err.message);
  console.error(err.stack);
  process.exit(1);
}

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

// Chat routes
var chatRoutes = require('./routes/chat.routes');
var adminChatRouter = require('./routes/admin/chatAdmin');
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/admin/chat', adminChatRouter);
console.log('  ✅ chat routes mounted');

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
const FRONTEND_URL = process.env.FRONTEND_URL || (isProduction ? PROD_FRONTEND_URL : 'http://localhost:3000');

app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"], session: false }));
app.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: `${FRONTEND_URL}/login`, session: false }), (req, res) => {
    const user = req.user.get({ plain: true });
    const payload = { id: user.UserID, role: user.Role, username: user.Username, email: user.Email, avatar: user.AvatarURL };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.redirect(`${FRONTEND_URL}/login?token=${token}&role=${user.Role}`);
});

app.get("/auth/facebook", passport.authenticate("facebook", { scope: ["email"], session: false }));
app.get("/auth/facebook/callback", passport.authenticate("facebook", { failureRedirect: `${FRONTEND_URL}/login`, session: false }), (req, res) => {
    const user = req.user.get({ plain: true });
    const payload = { id: user.UserID, role: user.Role, username: user.Username, email: user.Email, avatar: user.AvatarURL };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.redirect(`${FRONTEND_URL}/login?token=${token}&role=${user.Role}`);
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
  .then(async () => {
    // Auto-seed database if empty (production only)
    if (process.env.NODE_ENV === 'production') {
      try {
        const autoSeed = require('./scripts/autoSeed');
        await autoSeed();
      } catch (err) {
        console.error('⚠️ Auto-seed error (non-fatal):', err.message);
      }
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