'use strict';

const router = require('express').Router();

router.use('/auth',          require('./auth.routes'));
router.use('/users',         require('./users.routes'));
router.use('/wards',         require('./wards.routes'));
router.use('/diet-types',    require('./dietTypes.routes'));
router.use('/items',         require('./items.routes'));
router.use('/norm-weights',  require('./normWeights.routes'));
router.use('/meal-cycles',   require('./mealCycles.routes'));
router.use('/recipes',       require('./recipes.routes'));
router.use('/census',        require('./census.routes'));
router.use('/calculations',  require('./calculations.routes'));
router.use('/orders',        require('./orders.routes'));
router.use('/approvals',     require('./approvals.routes'));
router.use('/invoices',      require('./invoices.routes'));
router.use('/prices',        require('./prices.routes'));
router.use('/reports',       require('./reports.routes'));
router.use('/kitchen',       require('./kitchen.routes'));
router.use('/notifications', require('./notifications.routes'));
router.use('/audit',         require('./audit.routes'));
router.use('/backups',       require('./backups.routes'));
router.use('/settings',      require('./settings.routes'));
router.use('/dashboard',     require('./dashboard.routes'));

module.exports = router;
