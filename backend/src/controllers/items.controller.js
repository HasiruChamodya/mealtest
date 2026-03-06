'use strict';

const { query } = require('../config/database');
const { paginationMeta } = require('../utils/helpers');

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, category_id, active } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (p - 1) * l;

    const conditions = [];
    const params = [];
    if (category_id) { params.push(category_id); conditions.push(`i.category_id = $${params.length}`); }
    if (active !== undefined) { params.push(active === 'true'); conditions.push(`i.is_active = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) FROM items i ${where}`, params);
    params.push(l, offset);
    const dataRes = await query(
      `SELECT i.*, ic.name AS category_name
       FROM items i
       LEFT JOIN item_categories ic ON ic.id = i.category_id
       ${where}
       ORDER BY ic.name ASC, i.name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const categoriesRes = await query('SELECT * FROM item_categories ORDER BY name');
    res.json({
      success: true,
      data: {
        items: dataRes.rows,
        categories: categoriesRes.rows,
        pagination: paginationMeta(parseInt(countRes.rows[0].count, 10), p, l),
      },
    });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT i.*, ic.name AS category_name FROM items i LEFT JOIN item_categories ic ON ic.id = i.category_id WHERE i.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } });
    res.json({ success: true, data: { item: result.rows[0] } });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, category_id, unit = 'kg' } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
    const result = await query(
      'INSERT INTO items (name, category_id, unit) VALUES ($1, $2, $3) RETURNING *',
      [name, category_id || null, unit]
    );
    res.status(201).json({ success: true, data: { item: result.rows[0] } });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { name, category_id, unit } = req.body;
    const result = await query(
      `UPDATE items SET name=COALESCE($1,name), category_id=COALESCE($2,category_id), unit=COALESCE($3,unit), updated_at=NOW() WHERE id=$4 RETURNING *`,
      [name || null, category_id || null, unit || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } });
    res.json({ success: true, data: { item: result.rows[0] } });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const result = await query('UPDATE items SET is_active=false, updated_at=NOW() WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Item not found' } });
    res.json({ success: true, data: { message: 'Item deactivated successfully' } });
  } catch (err) { next(err); }
};

module.exports = { list, getById, create, update, remove };
