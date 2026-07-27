// routes/employeeVisitorRoutes.js
const express = require('express');
const router = express.Router();
const employeeVisitorController = require('../controllers/employeeVisitorController');
const validateEmployeeSession = require('../middlewares/validateEmployeeSession');
const adminVisitorController = require('../controllers/adminVisitorController');

router.get('/assigned-passes', validateEmployeeSession, employeeVisitorController.getAssignedPasses);
router.post('/pass/:passId/arrived', validateEmployeeSession, employeeVisitorController.markArrival);
router.post('/pass/:passId/flag-left', validateEmployeeSession, employeeVisitorController.flagVisitorLeft);
router.get('/departments', validateEmployeeSession, adminVisitorController.getDepartments);
router.get('/departments/:dept_code/overview', validateEmployeeSession, adminVisitorController.getDepartmentOverview);

module.exports = router;
