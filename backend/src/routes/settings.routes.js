'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/settings.controller');

const adminRoles = ['system_admin', 'hospital_admin'];

router.get('/',      auth, authorize(adminRoles), controller.list);
router.put('/:key',  auth, authorize(adminRoles), controller.update);

module.exports = router;
