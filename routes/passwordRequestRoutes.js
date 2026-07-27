const express = require('express');
const router = express.Router();
const passwordRequestController = require('../controllers/passwordRequestController');
const validateDeptAdminSession = require('../middlewares/validateDeptAdminSession');
const validateAdminSession = require('../middlewares/validateAdminSession');

// Public Stages
router.post('/verify-stage1', passwordRequestController.verifyStage1);
router.post('/verify_stage1', passwordRequestController.verifyStage1);
router.post('/verify-stage2', passwordRequestController.verifyStage2);
router.post('/verify_stage2', passwordRequestController.verifyStage2);

// Admin-Only Resolution
router.get('/admin-requests', validateAdminSession, passwordRequestController.getAdminRequests);

// DeptAdmin-Only Resolution
router.get('/deptadmin-requests', validateDeptAdminSession, passwordRequestController.getDeptAdminRequests);

// General Resolution
router.post('/resolve', passwordRequestController.resolveRequest);

module.exports = router;
