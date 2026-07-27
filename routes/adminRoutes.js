// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const adminVisitorController = require('../controllers/adminVisitorController');
const validateAdminSession = require('../middlewares/validateAdminSession');

// Auth endpoints
router.post('/login', adminAuthController.loginAdmin);
router.post('/forgot-password-otp', adminAuthController.forgotPasswordOtp);
router.post('/reveal-password', adminAuthController.revealPassword);
router.get('/profile', validateAdminSession, adminAuthController.getAdminProfile);

// Departments
router.post('/departments', validateAdminSession, adminVisitorController.createDepartment);
router.get('/departments', adminVisitorController.getDepartments);
router.get('/departments-stats', validateAdminSession, adminVisitorController.getDepartmentsWithStats);
router.get('/departments/:dept_code/overview', validateAdminSession, adminVisitorController.getDepartmentOverview);
router.put('/departments/:dept_code', validateAdminSession, adminVisitorController.updateDepartment);
router.delete('/departments/:dept_code', validateAdminSession, adminVisitorController.deleteDepartment);

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// DeptAdmins
router.post('/create-dept-admin', validateAdminSession, upload.single('photo'), adminVisitorController.createDeptAdmin);
router.get('/decline-dept-admin', adminVisitorController.declineDeptAdmin);
router.get('/dept-admins', validateAdminSession, adminVisitorController.getDeptAdmins);
router.delete('/dept-admins/:portalId', validateAdminSession, adminVisitorController.deleteDeptAdmin);
router.post('/dept-admins/:portalId/unlock-direct', validateAdminSession, adminVisitorController.unlockDirectDeptAdmin);
router.post('/dept-admins/:portalId/toggle-block', validateAdminSession, adminVisitorController.toggleBlockDeptAdmin);
router.put('/dept-admins/:portalId', validateAdminSession, adminVisitorController.updateDeptAdmin);

// Visitors
router.get('/visitors', validateAdminSession, adminVisitorController.getVisitors);
router.delete('/visitors/:id', validateAdminSession, adminVisitorController.deleteVisitor);
router.post('/visitors/:id/toggle-block', validateAdminSession, adminVisitorController.toggleBlockVisitor);
router.get('/visitor-updates', validateAdminSession, adminVisitorController.getVisitorProfileUpdates);
router.get('/visitor-logs', validateAdminSession, adminVisitorController.getVisitorLogs);

// Security Alerts / Lockouts
router.get('/alerts', validateAdminSession, adminVisitorController.getWrongPasswordAlerts);
router.post('/alerts/:id/resolve', validateAdminSession, adminVisitorController.resolveAlert);

// Analytics
router.get('/analytics', validateAdminSession, adminVisitorController.getAnalyticsData);

module.exports = router;
