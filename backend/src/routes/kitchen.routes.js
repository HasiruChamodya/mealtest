'use strict';

const router = require('express').Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const controller = require('../controllers/kitchen.controller');

const kitchenRoles = ['system_admin', 'hospital_admin', 'kitchen'];
const allRoles     = ['system_admin', 'hospital_admin', 'diet_clerk', 'subject_clerk', 'accountant', 'kitchen'];

router.get('/cook-sheet',                                    auth, authorize(allRoles),     controller.getCookSheet);
router.get('/cook-sheet/:date',                              auth, authorize(allRoles),     controller.getCookSheetByDate);
router.post('/deliveries',                                   auth, authorize(kitchenRoles), controller.createDelivery);
router.get('/deliveries',                                    auth, authorize(kitchenRoles), controller.listDeliveries);
router.get('/deliveries/:id',                                auth, authorize(kitchenRoles), controller.getDelivery);
router.put('/deliveries/:id/items/:itemId',                  auth, authorize(kitchenRoles), controller.updateDeliveryItem);
router.post('/deliveries/:id/items/:itemId/photos',          auth, authorize(kitchenRoles), controller.addPhoto);
router.post('/issue-reports',                                auth, authorize(kitchenRoles), controller.createIssueReport);
router.get('/issue-reports',                                 auth, authorize(kitchenRoles), controller.listIssueReports);

module.exports = router;
