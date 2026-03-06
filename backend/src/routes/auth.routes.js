'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const controller = require('../controllers/auth.controller');

router.post('/login',   controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout',  auth, controller.logout);
router.get('/me',       auth, controller.me);

module.exports = router;
