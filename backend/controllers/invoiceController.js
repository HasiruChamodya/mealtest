// controllers/invoiceController.js
const pool = require("../config/db");
const { writeAudit } = require("../utils/audit");

// GET /api/invoices
exports.listInvoices = async (req, res) => {
  try {
    const { status, from, to } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`inv.status = $${params.length}`);
    }
    if (from) {
      params.push(from);
      conditions.push(`inv.date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`inv.date <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT inv.*, u.full_name as created_by_name
       FROM invoices inv
       LEFT JOIN users u ON u.id = inv.created_by
       ${whereClause}
       ORDER BY inv.date DESC, inv.created_at DESC`,
      params
    );

    res.json({ invoices: result.rows });
  } catch (error) {
    console.error("LIST INVOICES ERROR:", error);
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
};

// GET /api/invoices/:id
exports.getInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT inv.*, u.full_name as created_by_name, o.date as order_date, o.meal as order_meal
       FROM invoices inv
       LEFT JOIN users u ON u.id = inv.created_by
       LEFT JOIN orders o ON o.id = inv.order_id
       WHERE inv.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    res.json({ invoice: result.rows[0] });
  } catch (error) {
    console.error("GET INVOICE ERROR:", error);
    res.status(500).json({ message: "Failed to fetch invoice" });
  }
};

// POST /api/invoices
exports.createInvoice = async (req, res) => {
  try {
    const { order_id, notes, tax_rate = 0 } = req.body;

    if (!order_id) {
      return res.status(400).json({ message: "order_id is required" });
    }

    // Fetch the order
    const orderResult = await pool.query("SELECT * FROM orders WHERE id = $1", [order_id]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const order = orderResult.rows[0];

    if (order.status === "rejected") {
      return res.status(400).json({ message: "Cannot create invoice for a rejected order" });
    }

    // Generate invoice number: INV-YYYYMMDD-NNN using database date to avoid timezone issues
    const dateResult = await pool.query("SELECT TO_CHAR(CURRENT_DATE, 'YYYYMMDD') as date_str");
    const dateStr = dateResult.rows[0].date_str;
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM invoices WHERE date = CURRENT_DATE`
    );
    const seq = String(Number(countResult.rows[0].count) + 1).padStart(3, "0");
    const invoiceNumber = `INV-${dateStr}-${seq}`;

    const items = order.items || [];
    const subtotal = Number(order.total_cost) || 0;
    const tax = Math.round(subtotal * (Number(tax_rate) / 100) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    const result = await pool.query(
      `INSERT INTO invoices (order_id, invoice_number, items, subtotal, tax, total, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        order_id,
        invoiceNumber,
        JSON.stringify(items),
        subtotal,
        tax,
        total,
        notes || null,
        req.user?.id || null,
      ]
    );

    await writeAudit({
      req,
      action: "CREATE_INVOICE",
      entity: "invoices",
      entity_id: String(result.rows[0].id),
      details: { order_id, invoice_number: invoiceNumber, total },
      severity: "info",
      status_code: 201,
      success: true,
    });

    res.status(201).json({ message: "Invoice created successfully", invoice: result.rows[0] });
  } catch (error) {
    console.error("CREATE INVOICE ERROR:", error);

    await writeAudit({
      req,
      action: "CREATE_INVOICE",
      entity: "invoices",
      details: { error: error.message },
      severity: "error",
      status_code: 500,
      success: false,
    });

    if (error.code === "23505") {
      return res.status(409).json({ message: "Invoice for this order already exists" });
    }

    res.status(500).json({ message: "Failed to create invoice", error: error.message });
  }
};

// PATCH /api/invoices/:id/status
exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, payment_date } = req.body;

    const validStatuses = ["draft", "sent", "paid"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const existing = await pool.query("SELECT * FROM invoices WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const updateFields = ["status = $1", "updated_at = NOW()"];
    const params = [status];

    if (status === "paid" && payment_date) {
      params.push(payment_date);
      updateFields.push(`payment_date = $${params.length}`);
    } else if (status === "paid" && !payment_date) {
      updateFields.push("payment_date = CURRENT_DATE");
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE invoices SET ${updateFields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params
    );

    await writeAudit({
      req,
      action: "UPDATE_INVOICE_STATUS",
      entity: "invoices",
      entity_id: String(id),
      old_value: { status: existing.rows[0].status },
      new_value: { status },
      details: { message: `Invoice status changed to ${status}` },
      severity: "info",
      status_code: 200,
      success: true,
    });

    res.json({ message: "Invoice status updated", invoice: result.rows[0] });
  } catch (error) {
    console.error("UPDATE INVOICE STATUS ERROR:", error);
    res.status(500).json({ message: "Failed to update invoice status" });
  }
};

// GET /api/reports/financial
exports.getFinancialReport = async (req, res) => {
  try {
    const { from, to } = req.query;

    const dateFilter = [];
    const params = [];

    if (from) {
      params.push(from);
      dateFilter.push(`inv.date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      dateFilter.push(`inv.date <= $${params.length}`);
    }

    const whereClause = dateFilter.length > 0 ? `WHERE ${dateFilter.join(" AND ")}` : "";

    // Overall totals
    const totalsResult = await pool.query(
      `SELECT
         COUNT(*) as invoice_count,
         COALESCE(SUM(subtotal), 0) as total_subtotal,
         COALESCE(SUM(tax), 0) as total_tax,
         COALESCE(SUM(total), 0) as grand_total,
         COALESCE(AVG(total), 0) as avg_invoice_total
       FROM invoices inv
       ${whereClause}`,
      params
    );

    // Daily aggregation
    const dailyResult = await pool.query(
      `SELECT
         inv.date,
         COUNT(*) as invoice_count,
         COALESCE(SUM(inv.total), 0) as daily_total
       FROM invoices inv
       ${whereClause}
       GROUP BY inv.date
       ORDER BY inv.date DESC`,
      params
    );

    res.json({
      report: {
        period: { from: from || null, to: to || null },
        totals: totalsResult.rows[0],
        daily: dailyResult.rows,
      },
    });
  } catch (error) {
    console.error("GET FINANCIAL REPORT ERROR:", error);
    res.status(500).json({ message: "Failed to generate financial report" });
  }
};
