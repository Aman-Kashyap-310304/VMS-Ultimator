// routes/adminAuthRoutes.js
const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');

router.post('/login', adminAuthController.loginAdmin);
router.post('/forgot-password-otp', adminAuthController.forgotPasswordOtp);
router.post('/reveal-password', adminAuthController.revealPassword);

module.exports = router;
