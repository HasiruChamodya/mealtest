// routes/dashboardRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const dashboard = require("../controllers/dashboardController");

router.get("/", requireAuth, dashboard.getDashboard);

module.exports = router;
