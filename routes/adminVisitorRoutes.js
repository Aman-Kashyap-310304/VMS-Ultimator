// routes/adminVisitorRoutes.js
const express = require('express');
const router = express.Router();
const adminVisitorController = require('../controllers/adminVisitorController');
const validateAdminSession = require('../middlewares/validateAdminSession');

// Departments
router.post('/departments', validateAdminSession, adminVisitorController.createDepartment);
router.get('/departments', adminVisitorController.getDepartments); // Public or visitor-friendly access to list departments

// DeptAdmins
router.post('/create-dept-admin', validateAdminSession, adminVisitorController.createDeptAdmin);
router.get('/dept-admins', validateAdminSession, adminVisitorController.getDeptAdmins);
router.delete('/dept-admins/:portalId', validateAdminSession, adminVisitorController.deleteDeptAdmin);

// Visitors
router.get('/visitors', validateAdminSession, adminVisitorController.getVisitors);
router.delete('/visitors/:id', validateAdminSession, adminVisitorController.deleteVisitor);
router.post('/visitors/:id/toggle-block', validateAdminSession, adminVisitorController.toggleBlockVisitor);

// Security Alerts / Lockouts
router.get('/alerts', validateAdminSession, adminVisitorController.getWrongPasswordAlerts);
router.post('/alerts/:id/resolve', validateAdminSession, adminVisitorController.resolveAlert);

// Analytics
router.get('/analytics', validateAdminSession, adminVisitorController.getAnalyticsData);

module.exports = router;
