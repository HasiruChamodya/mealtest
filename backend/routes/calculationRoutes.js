// routes/calculationRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const calc = require("../controllers/calculationController");

router.post(
  "/trigger",
  requireAuth,
  requireRole("SUBJECT_CLERK", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  calc.triggerCalculation
);

router.get(
  "/",
  requireAuth,
  requireRole("SUBJECT_CLERK", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "KITCHEN", "ACCOUNTANT"),
  calc.listCalculations
);

router.get(
  "/:id",
  requireAuth,
  requireRole("SUBJECT_CLERK", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "KITCHEN", "ACCOUNTANT"),
  calc.getCalculation
);

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("SUBJECT_CLERK", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  calc.updateCalculationStatus
);

module.exports = router;
