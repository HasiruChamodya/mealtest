// routes/reportRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const { getFinancialReport } = require("../controllers/invoiceController");

router.get(
  "/financial",
  requireAuth,
  requireRole("ACCOUNTANT", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  getFinancialReport
);

module.exports = router;
