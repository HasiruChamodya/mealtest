// controllers/dashboardController.js
const pool = require("../config/db");

// GET /api/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;
    const today = new Date().toISOString().split("T")[0];

    let data = {};

    if (role === "SYSTEM_ADMIN") {
      const [userCounts, recentAudit, wardCount] = await Promise.all([
        pool.query(
          `SELECT role, COUNT(*) as count, SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_count
           FROM users GROUP BY role ORDER BY role`
        ),
        pool.query(
          `SELECT id, timestamp, user_name, action, entity, severity, success
           FROM audit_logs ORDER BY timestamp DESC LIMIT 10`
        ),
        pool.query("SELECT COUNT(*) as count FROM wards WHERE is_active = true"),
      ]);

      data = {
        role,
        user_counts: userCounts.rows,
        recent_audit_logs: recentAudit.rows,
        system_stats: {
          total_wards: Number(wardCount.rows[0]?.count || 0),
          today: today,
        },
      };
    } else if (role === "HOSPITAL_ADMIN") {
      const [wardCount, censusStatus, dietConfig] = await Promise.all([
        pool.query("SELECT COUNT(*) as count FROM wards WHERE is_active = true"),
        pool.query(
          `SELECT wc.status, COUNT(*) as count
           FROM ward_census wc
           WHERE wc.date = $1
           GROUP BY wc.status`,
          [today]
        ),
        pool.query("SELECT active_diets, active_cycles FROM diet_config WHERE id = 1"),
      ]);

      data = {
        role,
        ward_count: Number(wardCount.rows[0]?.count || 0),
        today_census_status: censusStatus.rows,
        active_diet_config: dietConfig.rows[0] || { active_diets: {}, active_cycles: {} },
        today: today,
      };
    } else if (role === "DIET_CLERK") {
      const [totalWards, censusToday] = await Promise.all([
        pool.query("SELECT COUNT(*) as count FROM wards WHERE is_active = true"),
        pool.query(
          // ward_census.ward_id is VARCHAR, wards.id is UUID — cast needed
          `SELECT wc.ward_id, w.name as ward_name, wc.status, wc.total_patients
           FROM ward_census wc
           JOIN wards w ON w.id::text = wc.ward_id
           WHERE wc.date = $1`,
          [today]
        ),
      ]);

      const totalWardsCount = Number(totalWards.rows[0]?.count || 0);
      const submittedCount = censusToday.rows.filter((c) => c.status === "submitted" || c.status === "locked").length;

      data = {
        role,
        today: today,
        total_wards: totalWardsCount,
        submitted_today: submittedCount,
        pending_submissions: totalWardsCount - submittedCount,
        census_per_ward: censusToday.rows,
      };
    } else if (role === "SUBJECT_CLERK") {
      const [censusSubmitted, pendingCalcs, recentOrders] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) as count FROM ward_census
           WHERE date = $1 AND status IN ('submitted', 'locked')`,
          [today]
        ),
        pool.query(
          `SELECT COUNT(*) as count FROM calculations
           WHERE status IN ('pending', 'completed')`
        ),
        pool.query(
          `SELECT o.id, o.date, o.meal, o.status, o.total_cost, o.created_at
           FROM orders o
           ORDER BY o.created_at DESC LIMIT 5`
        ),
      ]);

      data = {
        role,
        today: today,
        census_submitted_today: Number(censusSubmitted.rows[0]?.count || 0),
        pending_calculations: Number(pendingCalcs.rows[0]?.count || 0),
        recent_orders: recentOrders.rows,
      };
    } else if (role === "ACCOUNTANT") {
      const [pendingInvoices, monthlySpend, priceUpdates] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) as count FROM invoices WHERE status IN ('draft', 'sent')`
        ),
        pool.query(
          `SELECT COALESCE(SUM(total), 0) as total
           FROM invoices
           WHERE date >= date_trunc('month', CURRENT_DATE)
             AND status != 'draft'`
        ),
        pool.query(
          `SELECT i.id, i.name,
             MAX(ip.effective_from) as last_updated
           FROM ingredients i
           LEFT JOIN item_prices ip ON ip.ingredient_id = i.id
           GROUP BY i.id, i.name
           ORDER BY last_updated ASC NULLS FIRST
           LIMIT 5`
        ),
      ]);

      data = {
        role,
        today: today,
        pending_invoices: Number(pendingInvoices.rows[0]?.count || 0),
        total_spend_this_month: Number(monthlySpend.rows[0]?.total || 0),
        price_update_reminders: priceUpdates.rows,
      };
    } else if (role === "KITCHEN") {
      const [cookSheetAvail, pendingDeliveries, openIssues] = await Promise.all([
        pool.query(
          `SELECT meal, status FROM calculations
           WHERE date = $1 AND status IN ('approved', 'sent_to_kitchen')
           ORDER BY meal`,
          [today]
        ),
        pool.query(
          `SELECT COUNT(*) as count FROM orders
           WHERE status = 'approved'`
        ),
        pool.query(
          `SELECT COUNT(*) as count FROM issue_reports WHERE status = 'open'`
        ),
      ]);

      data = {
        role,
        today: today,
        cook_sheet_available: cookSheetAvail.rows,
        pending_deliveries: Number(pendingDeliveries.rows[0]?.count || 0),
        open_issues: Number(openIssues.rows[0]?.count || 0),
      };
    } else {
      data = { role, today, message: "Dashboard not configured for this role" };
    }

    res.json({ dashboard: data });
  } catch (error) {
    console.error("GET DASHBOARD ERROR:", error);
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
};
