// routes/visitorAuthRoutes.js
const express = require('express');
const router = express.Router();
const visitorAuthController = require('../controllers/visitorAuthController');

router.post('/register-otp', visitorAuthController.sendRegistrationOtp);
router.post('/register', visitorAuthController.registerVisitor);
router.post('/login', visitorAuthController.loginVisitor);

module.exports = router;
