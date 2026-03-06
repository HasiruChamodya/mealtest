'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/orders.controller');

const subjectRoles = ['system_admin', 'hospital_admin', 'subject_clerk'];
const viewRoles    = ['system_admin', 'hospital_admin', 'subject_clerk', 'accountant'];

router.post('/',             auth, authorize(subjectRoles), controller.create);
router.get('/',              auth, authorize(viewRoles),    controller.list);
router.get('/:id',           auth, authorize(viewRoles),    controller.getById);
router.put('/:id',           auth, authorize(subjectRoles), controller.update);
router.post('/:id/submit',   auth, authorize(subjectRoles), controller.submit);

module.exports = router;
