// routes/securityRoutes.js
const express = require('express');
const router = express.Router();
const securityVisitorEmployeeController = require('../controllers/securityVisitorEmployeeController');
const validateSecuritySession = require('../middlewares/validateSecuritySession');

router.get('/pass/:passId', validateSecuritySession, securityVisitorEmployeeController.getVisitorDetails);
router.post('/pass/:passId/check-in', validateSecuritySession, securityVisitorEmployeeController.checkInVisitor);
router.post('/pass/:passId/check-out', validateSecuritySession, securityVisitorEmployeeController.checkOutVisitor);
router.get('/logs', validateSecuritySession, securityVisitorEmployeeController.getTodayLogs);
router.get('/visits', validateSecuritySession, securityVisitorEmployeeController.getVisitsToMonitor);
router.get('/alerts', validateSecuritySession, securityVisitorEmployeeController.getSecurityAlerts);

module.exports = router;
