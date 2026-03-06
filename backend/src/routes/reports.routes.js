'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/reports.controller');

const reportRoles = ['system_admin', 'hospital_admin', 'accountant'];

router.get('/financial-summary', auth, authorize(reportRoles), controller.financialSummary);
router.get('/budget-tracking',   auth, authorize(reportRoles), controller.budgetTracking);
router.get('/cost-by-category',  auth, authorize(reportRoles), controller.costByCategory);
router.get('/cost-by-ward',      auth, authorize(reportRoles), controller.costByWard);

module.exports = router;
