'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/notifications.controller');

router.get('/',             auth, controller.list);
router.patch('/:id/read',   auth, controller.markRead);
router.patch('/read-all',   auth, controller.markAllRead);

module.exports = router;
