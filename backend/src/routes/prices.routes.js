'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/prices.controller');

const priceRoles = ['system_admin', 'hospital_admin', 'accountant'];
const viewRoles  = ['system_admin', 'hospital_admin', 'accountant', 'subject_clerk'];

router.get('/',                  auth, authorize(viewRoles),  controller.list);
router.put('/:itemId',           auth, authorize(priceRoles), controller.updatePrice);
router.get('/history/:itemId',   auth, authorize(viewRoles),  controller.getPriceHistory);
router.post('/bulk-update',      auth, authorize(priceRoles), controller.bulkUpdate);

module.exports = router;
