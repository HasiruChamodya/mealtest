'use strict';

const { query } = require('../config/database');
const { formatDate } = require('../utils/helpers');

const getDashboard = async (req, res, next) => {
  try {
    const today = formatDate(new Date());
    const role = req.user.role;
    let data = {};

    if (role === 'diet_clerk') {
      const censusCount = await query(`SELECT COUNT(*) FROM census_entries WHERE date=$1 AND entered_by=$2`, [today, req.user.id]);
      const wardsSubmitted = await query(`SELECT COUNT(DISTINCT ward_id) FROM census_entries WHERE date=$1`, [today]);
      const totalWards = await query(`SELECT COUNT(*) FROM wards WHERE is_active=true`);
      data = {
        my_submissions_today: parseInt(censusCount.rows[0].count, 10),
        wards_submitted_today: parseInt(wardsSubmitted.rows[0].count, 10),
        total_active_wards: parseInt(totalWards.rows[0].count, 10),
      };
    } else if (role === 'subject_clerk') {
      const pendingCalcs = await query(`SELECT COUNT(*) FROM calculations WHERE status='pending'`);
      const pendingOrders = await query(`SELECT COUNT(*) FROM purchase_orders WHERE status='draft'`);
      const submittedOrders = await query(`SELECT COUNT(*) FROM purchase_orders WHERE status='submitted'`);
      data = {
        pending_calculations: parseInt(pendingCalcs.rows[0].count, 10),
        draft_orders: parseInt(pendingOrders.rows[0].count, 10),
        submitted_orders: parseInt(submittedOrders.rows[0].count, 10),
      };
    } else if (role === 'accountant') {
      const pendingApprovals = await query(`SELECT COUNT(*) FROM purchase_orders WHERE status='submitted'`);
      const draftInvoices = await query(`SELECT COUNT(*) FROM invoices WHERE status='draft'`);
      const paidInvoices = await query(`SELECT COUNT(*) FROM invoices WHERE status='paid'`);
      const totalSpend = await query(
        `SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE TO_CHAR(created_at,'YYYY-MM')=$1`,
        [today.slice(0, 7)]
      );
      data = {
        pending_approvals: parseInt(pendingApprovals.rows[0].count, 10),
        draft_invoices: parseInt(draftInvoices.rows[0].count, 10),
        paid_invoices: parseInt(paidInvoices.rows[0].count, 10),
        monthly_spend_lkr: parseFloat(totalSpend.rows[0].total),
      };
    } else if (role === 'kitchen') {
      const calcRes = await query(
        `SELECT COUNT(*) FROM calculations WHERE date=$1 AND status IN ('completed','approved')`, [today]
      );
      const pendingDeliveries = await query(
        `SELECT COUNT(*) FROM purchase_orders WHERE status='approved'`
      );
      const openIssues = await query(`SELECT COUNT(*) FROM issue_reports WHERE status='open'`);
      data = {
        cook_sheet_ready: parseInt(calcRes.rows[0].count, 10) > 0,
        pending_deliveries: parseInt(pendingDeliveries.rows[0].count, 10),
        open_issues: parseInt(openIssues.rows[0].count, 10),
      };
    } else if (role === 'hospital_admin') {
      const totalWards = await query(`SELECT COUNT(*) FROM wards WHERE is_active=true`);
      const totalItems = await query(`SELECT COUNT(*) FROM items WHERE is_active=true`);
      const activeCycles = await query(`SELECT COUNT(*) FROM meal_cycles WHERE is_active=true`);
      const todayCensus = await query(`SELECT COUNT(*) FROM census_entries WHERE date=$1`, [today]);
      data = {
        total_active_wards: parseInt(totalWards.rows[0].count, 10),
        total_active_items: parseInt(totalItems.rows[0].count, 10),
        active_meal_cycles: parseInt(activeCycles.rows[0].count, 10),
        census_entries_today: parseInt(todayCensus.rows[0].count, 10),
      };
    } else if (role === 'system_admin') {
      const totalUsers = await query(`SELECT COUNT(*) FROM users WHERE is_active=true`);
      const recentAudit = await query(`SELECT COUNT(*) FROM audit_logs WHERE created_at >= NOW() - INTERVAL '24 hours'`);
      const totalWards = await query(`SELECT COUNT(*) FROM wards WHERE is_active=true`);
      const totalItems = await query(`SELECT COUNT(*) FROM items WHERE is_active=true`);
      data = {
        total_active_users: parseInt(totalUsers.rows[0].count, 10),
        audit_events_last_24h: parseInt(recentAudit.rows[0].count, 10),
        total_active_wards: parseInt(totalWards.rows[0].count, 10),
        total_active_items: parseInt(totalItems.rows[0].count, 10),
      };
    }

    res.json({ success: true, data: { role, today, ...data } });
  } catch (err) { next(err); }
};

module.exports = { getDashboard };
