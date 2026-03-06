'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/calculations.controller');

const clerkRoles = ['system_admin', 'hospital_admin', 'subject_clerk'];
const allAdmins  = ['system_admin', 'hospital_admin', 'subject_clerk', 'accountant'];

router.post('/trigger',        auth, authorize(clerkRoles), controller.trigger);
router.get('/',                auth, authorize(allAdmins),  controller.list);
router.get('/:id',             auth, authorize(allAdmins),  controller.getById);
router.get('/:id/results',     auth, authorize(allAdmins),  controller.getResults);
router.put('/:id/approve',     auth, authorize(['system_admin', 'hospital_admin']), controller.approve);

module.exports = router;
