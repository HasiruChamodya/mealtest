// routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const notification = require("../controllers/notificationController");

router.get("/", requireAuth, notification.getNotifications);

router.patch("/:id/read", requireAuth, notification.markAsRead);

router.post(
  "/",
  requireAuth,
  requireRole("SYSTEM_ADMIN", "HOSPITAL_ADMIN"),
  notification.createNotification
);

module.exports = router;
