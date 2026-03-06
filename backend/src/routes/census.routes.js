'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/census.controller');

const clerkRoles = ['system_admin', 'hospital_admin', 'diet_clerk'];

router.post('/',            auth, authorize(clerkRoles), controller.create);
router.get('/',             auth, authorize(clerkRoles), controller.list);
router.get('/submissions',  auth, authorize(clerkRoles), controller.getSubmissions);
router.get('/status',       auth, authorize(clerkRoles), controller.getStatus);

module.exports = router;
