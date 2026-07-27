// routes/employeeAuthRoutes.js
const express = require('express');
const router = express.Router();
const employeeAuthController = require('../controllers/employeeAuthController');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const validateEmployeeSession = require('../middlewares/validateEmployeeSession');

router.post('/login', employeeAuthController.loginEmployee);
router.get('/profile', validateEmployeeSession, employeeAuthController.getProfile);
router.post('/change-password', validateEmployeeSession, employeeAuthController.changePassword);
router.post('/update-profile', validateEmployeeSession, upload.single('photo'), employeeAuthController.updateProfile);
router.post('/remove-photo', validateEmployeeSession, employeeAuthController.removePhoto);
router.get('/schedules', validateEmployeeSession, employeeAuthController.getSchedules);
router.post('/schedules/:id/done', validateEmployeeSession, employeeAuthController.markScheduleDone);

module.exports = router;
