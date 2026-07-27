// routes/deptAdminRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const deptAdminAuthController = require('../controllers/deptAdminAuthController');
const deptAdminVisitorController = require('../controllers/deptAdminVisitorController');
const validateDeptAdminSession = require('../middlewares/validateDeptAdminSession');

const upload = multer({ dest: 'uploads/' });
const adminVisitorController = require('../controllers/adminVisitorController');

// Auth
router.post('/login', deptAdminAuthController.loginDeptAdmin);
router.get('/profile', validateDeptAdminSession, deptAdminAuthController.getProfile);
router.post('/change-password', validateDeptAdminSession, deptAdminAuthController.changePassword);
router.post('/update-profile', validateDeptAdminSession, upload.single('photo'), deptAdminAuthController.updateProfile);
router.post('/remove-photo', validateDeptAdminSession, deptAdminAuthController.removePhoto);

// Visitor Management
router.get('/requests', validateDeptAdminSession, deptAdminVisitorController.getVisitorRequests);
router.post('/requests/:passId/approve', validateDeptAdminSession, deptAdminVisitorController.approveVisitorRequest);
router.post('/requests/:passId/reject', validateDeptAdminSession, deptAdminVisitorController.rejectVisitorRequest);
router.get('/visitor-updates', validateDeptAdminSession, deptAdminVisitorController.getVisitorProfileUpdates);
router.get('/visitor-logs', validateDeptAdminSession, deptAdminVisitorController.getVisitorLogs);

// User Creation under DeptAdmin (Employees & Security)
router.get('/decline-role', deptAdminVisitorController.declineUserRole);
router.post('/create-user', validateDeptAdminSession, upload.single('photo'), deptAdminVisitorController.createStaffUser);
router.get('/users', validateDeptAdminSession, deptAdminVisitorController.getStaffUsers);
router.delete('/users/:portalId', validateDeptAdminSession, deptAdminVisitorController.deleteStaffUser);
router.post('/users/:portalId/unlock-direct', validateDeptAdminSession, deptAdminVisitorController.unlockDirectUser);

// Schedules
router.post('/schedules', validateDeptAdminSession, deptAdminVisitorController.createSchedule);
router.get('/schedules', validateDeptAdminSession, deptAdminVisitorController.getSchedules);
router.put('/schedules/:id', validateDeptAdminSession, deptAdminVisitorController.updateSchedule);
router.post('/schedules/:id/done', validateDeptAdminSession, deptAdminVisitorController.markScheduleDone);
router.delete('/schedules/:id', validateDeptAdminSession, deptAdminVisitorController.deleteSchedule);

// Departments CRUD for Dept Admin
router.get('/departments', validateDeptAdminSession, adminVisitorController.getDepartments);
router.post('/departments', validateDeptAdminSession, adminVisitorController.createDepartment);
router.get('/departments/:dept_code/overview', validateDeptAdminSession, adminVisitorController.getDepartmentOverview);
router.put('/departments/:dept_code', validateDeptAdminSession, adminVisitorController.updateDepartment);
router.delete('/departments/:dept_code', validateDeptAdminSession, adminVisitorController.deleteDepartment);

module.exports = router;
