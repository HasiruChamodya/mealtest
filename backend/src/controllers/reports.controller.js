'use strict';

const { query } = require('../config/database');

const financialSummary = async (req, res, next) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const result = await query(
      `SELECT
         TO_CHAR(i.created_at, 'YYYY-MM') AS month,
         COUNT(i.id) AS invoice_count,
         SUM(i.total_amount) AS total_amount,
         SUM(CASE WHEN i.status='paid' THEN i.total_amount ELSE 0 END) AS paid_amount,
         SUM(CASE WHEN i.status!='paid' THEN i.total_amount ELSE 0 END) AS pending_amount
       FROM invoices i
       WHERE EXTRACT(YEAR FROM i.created_at) = $1
       GROUP BY month ORDER BY month`,
      [year]
    );
    res.json({ success: true, data: { summary: result.rows, year: parseInt(year, 10) } });
  } catch (err) { next(err); }
};

const budgetTracking = async (req, res, next) => {
  try {
    const { month } = req.query;
    const m = month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const budgetSetting = await query(`SELECT value FROM system_settings WHERE key='monthly_budget_lkr'`);
    const budget = parseFloat(budgetSetting.rows[0]?.value || 0);
    const spendRes = await query(
      `SELECT COALESCE(SUM(total_amount),0) AS total_spent FROM invoices WHERE TO_CHAR(created_at,'YYYY-MM')=$1`,
      [m]
    );
    const spent = parseFloat(spendRes.rows[0].total_spent);
    const percentUsed = budget > 0 ? Math.round((spent / budget) * 100) : 0;
    res.json({
      success: true,
      data: {
        month: m,
        budget_lkr: budget,
        spent_lkr: spent,
        remaining_lkr: budget - spent,
        percent_used: percentUsed,
      },
    });
  } catch (err) { next(err); }
};

const costByCategory = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const conditions = [];
    const params = [];
    if (start_date) { params.push(start_date); conditions.push(`i.created_at >= $${params.length}`); }
    if (end_date) { params.push(end_date); conditions.push(`i.created_at <= $${params.length}`); }
    const where = conditions.length ? `AND ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT ic.name AS category, SUM(ii.total_price) AS total_cost, COUNT(DISTINCT ii.item_id) AS item_count
       FROM invoice_items ii
       JOIN items it ON it.id = ii.item_id
       LEFT JOIN item_categories ic ON ic.id = it.category_id
       JOIN invoices i ON i.id = ii.invoice_id
       WHERE 1=1 ${where}
       GROUP BY ic.name ORDER BY total_cost DESC`,
      params
    );
    res.json({ success: true, data: { categories: result.rows } });
  } catch (err) { next(err); }
};

const costByWard = async (req, res, next) => {
  try {
    const { date } = req.query;
    const d = date || new Date().toISOString().slice(0, 10);
    // Estimate cost by ward by prorating total invoice cost against patient counts per ward
    const wardCounts = await query(
      `SELECT w.id AS ward_id, w.name AS ward_name, COALESCE(SUM(cdc.patient_count),0) AS patient_count
       FROM wards w
       LEFT JOIN census_entries ce ON ce.ward_id=w.id AND ce.date=$1
       LEFT JOIN census_diet_counts cdc ON cdc.census_entry_id=ce.id
       GROUP BY w.id, w.name ORDER BY patient_count DESC`,
      [d]
    );
    const totalPatients = wardCounts.rows.reduce((s, r) => s + parseInt(r.patient_count, 10), 0);
    // Get total invoice cost for today
    const invoiceCost = await query(
      `SELECT COALESCE(SUM(total_amount),0) AS total FROM invoices WHERE created_at >= $1::date AND created_at < $1::date + INTERVAL '1 day'`, [d]
    );
    const totalCost = parseFloat(invoiceCost.rows[0].total);
    const wards = wardCounts.rows.map(r => {
      const count = parseInt(r.patient_count, 10);
      const share = totalPatients > 0 ? (count / totalPatients) * totalCost : 0;
      return { ...r, estimated_cost: Math.round(share * 100) / 100 };
    });
    res.json({ success: true, data: { date: d, wards, total_cost: totalCost, total_patients: totalPatients } });
  } catch (err) { next(err); }
};

module.exports = { financialSummary, budgetTracking, costByCategory, costByWard };
