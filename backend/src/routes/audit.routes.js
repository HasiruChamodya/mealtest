'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/audit.controller');

router.get('/', auth, authorize(['system_admin', 'hospital_admin']), controller.list);

module.exports = router;
