// routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const order = require("../controllers/orderController");

router.post(
  "/",
  requireAuth,
  requireRole("SUBJECT_CLERK", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  order.createOrder
);

router.get(
  "/",
  requireAuth,
  requireRole("SUBJECT_CLERK", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "ACCOUNTANT", "KITCHEN"),
  order.listOrders
);

router.get(
  "/:id",
  requireAuth,
  requireRole("SUBJECT_CLERK", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "ACCOUNTANT", "KITCHEN"),
  order.getOrder
);

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("SUBJECT_CLERK", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "ACCOUNTANT"),
  order.updateOrderStatus
);

module.exports = router;
