'use strict';

const { query } = require('../config/database');
const { paginationMeta, formatDate } = require('../utils/helpers');
const calculationService = require('../services/calculation.service');

const trigger = async (req, res, next) => {
  try {
    const { date } = req.body;
    const d = date || formatDate(new Date());
    const result = await calculationService.runCalculation(d, req.user.id);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (p - 1) * l;
    const conditions = [];
    const params = [];
    if (status) { params.push(status); conditions.push(`c.status=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM calculations c ${where}`, params);
    params.push(l, offset);
    const dataRes = await query(
      `SELECT c.*, u.name AS triggered_by_name FROM calculations c
       LEFT JOIN users u ON u.id=c.triggered_by
       ${where} ORDER BY c.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params
    );
    res.json({ success: true, data: { calculations: dataRes.rows, pagination: paginationMeta(parseInt(countRes.rows[0].count, 10), p, l) } });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.*, u.name AS triggered_by_name FROM calculations c LEFT JOIN users u ON u.id=c.triggered_by WHERE c.id=$1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Calculation not found' } });
    res.json({ success: true, data: { calculation: result.rows[0] } });
  } catch (err) { next(err); }
};

const getResults = async (req, res, next) => {
  try {
    const results = await query(
      `SELECT cr.*, i.name AS item_name, i.unit, mt.name AS meal_type_name
       FROM calculation_results cr
       LEFT JOIN items i ON i.id=cr.item_id
       LEFT JOIN meal_types mt ON mt.id=cr.meal_type_id
       WHERE cr.calculation_id=$1
       ORDER BY cr.stage, i.name`,
      [req.params.id]
    );
    // Group by stage
    const byStage = {};
    for (const r of results.rows) {
      if (!byStage[r.stage]) byStage[r.stage] = [];
      byStage[r.stage].push(r);
    }
    res.json({ success: true, data: { results: results.rows, byStage } });
  } catch (err) { next(err); }
};

const approve = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE calculations SET status='approved' WHERE id=$1 AND status='completed' RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Calculation not found or not in completed state' } });
    res.json({ success: true, data: { calculation: result.rows[0] } });
  } catch (err) { next(err); }
};

module.exports = { trigger, list, getById, getResults, approve };
