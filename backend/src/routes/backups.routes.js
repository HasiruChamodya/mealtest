'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/backups.controller');

const adminOnly = [auth, authorize(['system_admin'])];

router.get('/',              ...adminOnly, controller.list);
router.post('/',             ...adminOnly, controller.create);
router.post('/:id/restore',  ...adminOnly, controller.restore);

module.exports = router;
