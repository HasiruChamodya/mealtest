'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/approvals.controller');

const approverRoles = ['system_admin', 'hospital_admin'];

router.get('/',               auth, authorize(approverRoles), controller.list);
router.get('/:id',            auth, authorize(approverRoles), controller.getById);
router.post('/:id/approve',   auth, authorize(approverRoles), controller.approve);
router.post('/:id/reject',    auth, authorize(approverRoles), controller.reject);

module.exports = router;
