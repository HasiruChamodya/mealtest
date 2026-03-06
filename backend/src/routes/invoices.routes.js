'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/invoices.controller');

const accountantRoles = ['system_admin', 'hospital_admin', 'accountant'];

router.post('/',              auth, authorize(accountantRoles), controller.create);
router.get('/',               auth, authorize(accountantRoles), controller.list);
router.get('/:id',            auth, authorize(accountantRoles), controller.getById);
router.put('/:id/status',     auth, authorize(accountantRoles), controller.updateStatus);
router.get('/:id/download',   auth, authorize(accountantRoles), controller.download);

module.exports = router;
