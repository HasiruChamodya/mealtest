'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/normWeights.controller');

const dietRoles = ['system_admin', 'hospital_admin', 'diet_clerk'];

router.get('/',       auth, authorize(dietRoles), controller.list);
router.get('/matrix', auth, authorize(dietRoles), controller.getMatrix);
router.post('/',      auth, authorize(dietRoles), controller.create);
router.put('/',       auth, authorize(dietRoles), controller.bulkUpdate);

module.exports = router;
