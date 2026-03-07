// controllers/notificationController.js
const pool = require("../config/db");
const { writeAudit } = require("../utils/audit");

// GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE (user_id = $1 OR role = $2)
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId, userRole]
    );

    const unreadCount = result.rows.filter((n) => !n.is_read).length;

    res.json({ notifications: result.rows, unread_count: unreadCount });
  } catch (error) {
    console.error("GET NOTIFICATIONS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

// PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification marked as read", notification: result.rows[0] });
  } catch (error) {
    console.error("MARK NOTIFICATION READ ERROR:", error);
    res.status(500).json({ message: "Failed to mark notification as read" });
  }
};

// POST /api/notifications
exports.createNotification = async (req, res) => {
  try {
    const { user_id, role, title, message, type = "info", link } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: "title and message are required" });
    }

    if (!user_id && !role) {
      return res.status(400).json({ message: "Either user_id or role must be provided" });
    }

    const result = await pool.query(
      `INSERT INTO notifications (user_id, role, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [user_id || null, role || null, title, message, type, link || null]
    );

    await writeAudit({
      req,
      action: "CREATE_NOTIFICATION",
      entity: "notifications",
      entity_id: String(result.rows[0].id),
      details: { user_id, role, title },
      severity: "info",
      status_code: 201,
      success: true,
    });

    res.status(201).json({ message: "Notification created", notification: result.rows[0] });
  } catch (error) {
    console.error("CREATE NOTIFICATION ERROR:", error);
    res.status(500).json({ message: "Failed to create notification", error: error.message });
  }
};
