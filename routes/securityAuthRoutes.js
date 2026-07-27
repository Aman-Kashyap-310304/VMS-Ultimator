// routes/securityAuthRoutes.js
const express = require('express');
const router = express.Router();
const securityAuthController = require('../controllers/securityAuthController');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const validateSecuritySession = require('../middlewares/validateSecuritySession');

router.post('/login', securityAuthController.loginSecurity);
router.get('/profile', validateSecuritySession, securityAuthController.getProfile);
router.post('/change-password', validateSecuritySession, securityAuthController.changePassword);
router.post('/update-profile', validateSecuritySession, upload.single('photo'), securityAuthController.updateProfile);
router.post('/remove-photo', validateSecuritySession, securityAuthController.removePhoto);

module.exports = router;
