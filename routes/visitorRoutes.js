// routes/visitorRoutes.js
const express = require('express');
const router = express.Router();
const visitorAuthController = require('../controllers/visitorAuthController');
const visitorController = require('../controllers/visitorController');
const validateVisitorSession = require('../middlewares/validateVisitorSession');
const uploadVisitorFiles = require('../middlewares/uploadVisitorFiles');

// OCR Upload and Parse
router.post('/ocr', uploadVisitorFiles, visitorAuthController.processOcr);

// Auth endpoints
router.post('/register-otp', visitorAuthController.sendRegistrationOtp);
router.post('/register', uploadVisitorFiles, visitorAuthController.registerVisitor);
router.post('/login', visitorAuthController.loginVisitor);

// Forgot Password Flow
router.post('/forgot-password-otp', visitorAuthController.forgotPasswordOtp);
router.post('/reset-password', visitorAuthController.resetPassword);

// Functional endpoints
router.post('/request', validateVisitorSession, visitorController.createVisitorRequest);
router.get('/profile', validateVisitorSession, visitorController.getVisitorProfile);
router.post('/update-profile', validateVisitorSession, uploadVisitorFiles, visitorController.updateVisitorProfile);
router.post('/remove-photo', validateVisitorSession, visitorController.removePhoto);
router.get('/history', validateVisitorSession, visitorController.getVisitorHistory);
router.get('/pass/:passNumber', validateVisitorSession, visitorController.getPassDetail);
router.delete('/delete-account', validateVisitorSession, visitorController.deleteAccount);

module.exports = router;
