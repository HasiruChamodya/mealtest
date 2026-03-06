'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/users.controller');

const adminOnly = [auth, authorize(['system_admin'])];

router.get('/',            ...adminOnly, controller.list);
router.get('/:id',         ...adminOnly, controller.getById);
router.post('/',           ...adminOnly, controller.create);
router.put('/:id',         ...adminOnly, controller.update);
router.patch('/:id/status',...adminOnly, controller.updateStatus);

module.exports = router;
