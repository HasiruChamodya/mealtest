// routes/invoiceRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const invoice = require("../controllers/invoiceController");

router.get(
  "/",
  requireAuth,
  requireRole("ACCOUNTANT", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  invoice.listInvoices
);

router.get(
  "/:id",
  requireAuth,
  requireRole("ACCOUNTANT", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  invoice.getInvoice
);

router.post(
  "/",
  requireAuth,
  requireRole("ACCOUNTANT", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  invoice.createInvoice
);

router.patch(
  "/:id/status",
  requireAuth,
  requireRole("ACCOUNTANT", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  invoice.updateInvoiceStatus
);

module.exports = router;
