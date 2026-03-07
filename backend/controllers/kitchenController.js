// controllers/kitchenController.js
const pool = require("../config/db");
const { writeAudit } = require("../utils/audit");

// Helper: create notifications for roles
const createRoleNotification = async ({ role, title, message, type = "info", link = null }) => {
  try {
    await pool.query(
      `INSERT INTO notifications (role, title, message, type, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [role, title, message, type, link]
    );
  } catch (err) {
    console.error("[NOTIFICATION_CREATE_FAILED]", err.message);
  }
};

// GET /api/kitchen/cook-sheet
exports.getCookSheet = async (req, res) => {
  try {
    const { date, meal } = req.query;

    if (!date || !meal) {
      return res.status(400).json({ message: "date and meal are required" });
    }

    const result = await pool.query(
      `SELECT * FROM calculations
       WHERE date = $1 AND meal = $2 AND status IN ('approved', 'sent_to_kitchen')`,
      [date, meal]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "No approved calculation found for this date and meal" });
    }

    const calculation = result.rows[0];
    const finalAggregation = calculation.results?.stage6_final_aggregation || {};

    const cookSheet = Object.values(finalAggregation).map((item) => ({
      ingredient_id: item.ingredient_id,
      name: item.name,
      total_kg: item.total_kg || 0,
      total_grams: item.total_grams || 0,
    }));

    cookSheet.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      cook_sheet: {
        date,
        meal,
        calculation_id: calculation.id,
        status: calculation.status,
        summary: calculation.summary,
        items: cookSheet,
        extra_items: calculation.results?.stage5_extra_items || {},
      },
    });
  } catch (error) {
    console.error("GET COOK SHEET ERROR:", error);
    res.status(500).json({ message: "Failed to fetch cook sheet" });
  }
};

// POST /api/kitchen/receiving
exports.createReceiving = async (req, res) => {
  try {
    const { order_id, items = [], notes } = req.body;

    if (!order_id) {
      return res.status(400).json({ message: "order_id is required" });
    }

    // Verify order exists
    const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [order_id]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const hasIssues = items.some(
      (item) => item.quality_status === "failed" || item.quality_status === "issues"
    );
    const overallStatus = hasIssues ? "issues_found" : "received";

    const result = await pool.query(
      `INSERT INTO goods_receiving (order_id, received_by, items, overall_status, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        order_id,
        req.user?.id || null,
        JSON.stringify(items),
        overallStatus,
        notes || null,
      ]
    );

    await writeAudit({
      req,
      action: "CREATE_RECEIVING",
      entity: "goods_receiving",
      entity_id: String(result.rows[0].id),
      details: { order_id, overall_status: overallStatus, items_count: items.length },
      severity: "info",
      status_code: 201,
      success: true,
    });

    res.status(201).json({
      message: "Goods receiving record created",
      receiving: result.rows[0],
    });
  } catch (error) {
    console.error("CREATE RECEIVING ERROR:", error);

    await writeAudit({
      req,
      action: "CREATE_RECEIVING",
      entity: "goods_receiving",
      details: { error: error.message },
      severity: "error",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to create receiving record", error: error.message });
  }
};

// GET /api/kitchen/receiving
exports.listReceiving = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT gr.*, u.full_name as received_by_name, o.date as order_date, o.meal as order_meal
       FROM goods_receiving gr
       LEFT JOIN users u ON u.id = gr.received_by
       LEFT JOIN orders o ON o.id = gr.order_id
       ORDER BY gr.date DESC, gr.created_at DESC`
    );

    res.json({ receiving_records: result.rows });
  } catch (error) {
    console.error("LIST RECEIVING ERROR:", error);
    res.status(500).json({ message: "Failed to fetch receiving records" });
  }
};

// GET /api/kitchen/receiving/:id
exports.getReceiving = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT gr.*, u.full_name as received_by_name, o.date as order_date, o.meal as order_meal
       FROM goods_receiving gr
       LEFT JOIN users u ON u.id = gr.received_by
       LEFT JOIN orders o ON o.id = gr.order_id
       WHERE gr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Receiving record not found" });
    }

    res.json({ receiving: result.rows[0] });
  } catch (error) {
    console.error("GET RECEIVING ERROR:", error);
    res.status(500).json({ message: "Failed to fetch receiving record" });
  }
};

// PATCH /api/kitchen/receiving/:id
exports.updateReceiving = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, notes, overall_status } = req.body;

    const existing = await pool.query("SELECT * FROM goods_receiving WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Receiving record not found" });
    }

    const updateParts = ["updated_at = NOW()"];
    const params = [];

    if (items !== undefined) {
      params.push(JSON.stringify(items));
      updateParts.push(`items = $${params.length}`);
    }
    if (notes !== undefined) {
      params.push(notes);
      updateParts.push(`notes = $${params.length}`);
    }
    if (overall_status !== undefined) {
      const validStatuses = ["pending", "received", "issues_found"];
      if (!validStatuses.includes(overall_status)) {
        return res.status(400).json({ message: "Invalid overall_status" });
      }
      params.push(overall_status);
      updateParts.push(`overall_status = $${params.length}`);
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE goods_receiving SET ${updateParts.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await writeAudit({
      req,
      action: "UPDATE_RECEIVING",
      entity: "goods_receiving",
      entity_id: String(id),
      details: { message: "Receiving record updated" },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.json({ message: "Receiving record updated", receiving: result.rows[0] });
  } catch (error) {
    console.error("UPDATE RECEIVING ERROR:", error);
    res.status(500).json({ message: "Failed to update receiving record" });
  }
};

// POST /api/kitchen/issues
exports.createIssueReport = async (req, res) => {
  try {
    const {
      goods_receiving_id,
      order_id,
      item_name,
      issue_type,
      description,
      severity = "medium",
    } = req.body;

    if (!item_name || !issue_type) {
      return res.status(400).json({ message: "item_name and issue_type are required" });
    }

    const validIssueTypes = ["spoiled", "poor_quality", "partially_damaged", "quantity_mismatch", "other"];
    if (!validIssueTypes.includes(issue_type)) {
      return res.status(400).json({ message: "Invalid issue_type" });
    }

    const result = await pool.query(
      `INSERT INTO issue_reports
         (goods_receiving_id, order_id, item_name, issue_type, description, severity, reported_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        goods_receiving_id || null,
        order_id || null,
        item_name,
        issue_type,
        description || null,
        severity,
        req.user?.id || null,
      ]
    );

    const issue = result.rows[0];

    // Notify HOSPITAL_ADMIN and ACCOUNTANT roles
    const notifyMessage = `Issue reported: ${item_name} (${issue_type}) — Severity: ${severity}`;
    await createRoleNotification({
      role: "HOSPITAL_ADMIN",
      title: "New Issue Report",
      message: notifyMessage,
      type: severity === "critical" ? "error" : "warning",
      link: `/kitchen/issues/${issue.id}`,
    });
    await createRoleNotification({
      role: "ACCOUNTANT",
      title: "New Issue Report",
      message: notifyMessage,
      type: "warning",
      link: `/kitchen/issues/${issue.id}`,
    });

    await writeAudit({
      req,
      action: "CREATE_ISSUE_REPORT",
      entity: "issue_reports",
      entity_id: String(issue.id),
      details: { item_name, issue_type, severity, order_id, goods_receiving_id },
      severity: severity === "critical" ? "error" : "warning",
      status_code: 201,
      success: true,
    });

    res.status(201).json({ message: "Issue report created", issue });
  } catch (error) {
    console.error("CREATE ISSUE REPORT ERROR:", error);

    await writeAudit({
      req,
      action: "CREATE_ISSUE_REPORT",
      entity: "issue_reports",
      details: { error: error.message },
      severity: "error",
      status_code: 500,
      success: false,
    });

    res.status(500).json({ message: "Failed to create issue report", error: error.message });
  }
};

// GET /api/kitchen/issues
exports.listIssueReports = async (req, res) => {
  try {
    const { status, severity } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`ir.status = $${params.length}`);
    }
    if (severity) {
      params.push(severity);
      conditions.push(`ir.severity = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT ir.*, u.full_name as reported_by_name
       FROM issue_reports ir
       LEFT JOIN users u ON u.id = ir.reported_by
       ${whereClause}
       ORDER BY ir.created_at DESC`,
      params
    );

    res.json({ issues: result.rows });
  } catch (error) {
    console.error("LIST ISSUE REPORTS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch issue reports" });
  }
};

// PATCH /api/kitchen/issues/:id/status
exports.updateIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["open", "acknowledged", "resolved"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const existing = await pool.query("SELECT * FROM issue_reports WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Issue report not found" });
    }

    const updateFields = ["status = $1", "updated_at = NOW()"];
    const params = [status];

    if (status === "acknowledged") {
      params.push(req.user?.id || null);
      updateFields.push(`acknowledged_by = $${params.length}`);
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE issue_reports SET ${updateFields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await writeAudit({
      req,
      action: "UPDATE_ISSUE_STATUS",
      entity: "issue_reports",
      entity_id: String(id),
      old_value: { status: existing.rows[0].status },
      new_value: { status },
      details: { message: `Issue status changed to ${status}` },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.json({ message: "Issue status updated", issue: result.rows[0] });
  } catch (error) {
    console.error("UPDATE ISSUE STATUS ERROR:", error);
    res.status(500).json({ message: "Failed to update issue status" });
  }
};
