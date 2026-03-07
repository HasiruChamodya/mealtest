// routes/kitchenRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const kitchen = require("../controllers/kitchenController");

router.get(
  "/cook-sheet",
  requireAuth,
  requireRole("KITCHEN", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUBJECT_CLERK"),
  kitchen.getCookSheet
);

router.post(
  "/receiving",
  requireAuth,
  requireRole("KITCHEN", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  kitchen.createReceiving
);

router.get(
  "/receiving",
  requireAuth,
  requireRole("KITCHEN", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "ACCOUNTANT"),
  kitchen.listReceiving
);

router.get(
  "/receiving/:id",
  requireAuth,
  requireRole("KITCHEN", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "ACCOUNTANT"),
  kitchen.getReceiving
);

router.patch(
  "/receiving/:id",
  requireAuth,
  requireRole("KITCHEN", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  kitchen.updateReceiving
);

router.post(
  "/issues",
  requireAuth,
  requireRole("KITCHEN", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  kitchen.createIssueReport
);

router.get(
  "/issues",
  requireAuth,
  requireRole("KITCHEN", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "ACCOUNTANT"),
  kitchen.listIssueReports
);

router.patch(
  "/issues/:id/status",
  requireAuth,
  requireRole("KITCHEN", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "ACCOUNTANT"),
  kitchen.updateIssueStatus
);

module.exports = router;
