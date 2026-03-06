'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/mealCycles.controller');

const allRoles = ['system_admin', 'hospital_admin', 'diet_clerk', 'subject_clerk', 'accountant', 'kitchen'];
const manageRoles = ['system_admin', 'hospital_admin', 'diet_clerk'];

router.get('/daily',   auth, authorize(allRoles),    controller.getDaily);
router.post('/daily',  auth, authorize(manageRoles), controller.setDaily);
router.get('/',        auth, authorize(allRoles),    controller.list);
router.get('/:id',     auth, authorize(allRoles),    controller.getById);
router.post('/',       auth, authorize(manageRoles), controller.create);
router.put('/:id',     auth, authorize(manageRoles), controller.update);
router.delete('/:id',  auth, authorize(manageRoles), controller.remove);

module.exports = router;
