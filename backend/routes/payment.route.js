const express = require('express');
const router = express.Router();
const {
    vnpayIpnHandler,
    vnpayReturnHandler
} = require('../controllers/payment.controller');

router.get('/vnpay_ipn', vnpayIpnHandler);       // IPN (sau này dùng)
router.get('/vnpay_return', vnpayReturnHandler); // RETURN xử lý ngay khi user quay về

module.exports = router;
