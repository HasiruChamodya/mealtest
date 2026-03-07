// routes/priceRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const price = require("../controllers/priceController");

router.get(
  "/",
  requireAuth,
  requireRole("ACCOUNTANT", "HOSPITAL_ADMIN", "SYSTEM_ADMIN", "SUBJECT_CLERK"),
  price.getPrices
);

router.post(
  "/",
  requireAuth,
  requireRole("ACCOUNTANT", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  price.setPrice
);

router.get(
  "/history/:ingredientId",
  requireAuth,
  requireRole("ACCOUNTANT", "HOSPITAL_ADMIN", "SYSTEM_ADMIN"),
  price.getPriceHistory
);

module.exports = router;
