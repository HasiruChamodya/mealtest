'use strict';

const { query } = require('../config/database');
const { paginationMeta } = require('../utils/helpers');

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, active } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (p - 1) * l;

    const conditions = [];
    const params = [];
    if (active !== undefined) {
      params.push(active === 'true');
      conditions.push(`is_active = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) FROM wards ${where}`, params);
    params.push(l, offset);
    const dataRes = await query(
      `SELECT * FROM wards ${where} ORDER BY name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, data: { wards: dataRes.rows, pagination: paginationMeta(parseInt(countRes.rows[0].count, 10), p, l) } });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM wards WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ward not found' } });
    res.json({ success: true, data: { ward: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, code, bed_count = 0 } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name and code are required' } });
    const result = await query(
      'INSERT INTO wards (name, code, bed_count) VALUES ($1, $2, $3) RETURNING *',
      [name, code.toUpperCase(), bed_count]
    );
    res.status(201).json({ success: true, data: { ward: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, code, bed_count } = req.body;
    const result = await query(
      `UPDATE wards SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        bed_count = COALESCE($3, bed_count),
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name || null, code ? code.toUpperCase() : null, bed_count !== undefined ? bed_count : null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ward not found' } });
    res.json({ success: true, data: { ward: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE wards SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ward not found' } });
    res.json({ success: true, data: { message: 'Ward deactivated successfully' } });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, remove };
