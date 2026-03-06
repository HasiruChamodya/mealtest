'use strict';

const { query, pool } = require('../config/database');
const { paginationMeta, generateOrderNumber } = require('../utils/helpers');

const create = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { calculation_id, notes, items = [] } = req.body;
    if (!items.length) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'items are required' } });
    await client.query('BEGIN');
    const orderNumber = generateOrderNumber();
    const orderRes = await client.query(
      'INSERT INTO purchase_orders (calculation_id, order_number, status, created_by, notes) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [calculation_id || null, orderNumber, 'draft', req.user.id, notes || null]
    );
    const order = orderRes.rows[0];
    for (const item of items) {
      await client.query(
        'INSERT INTO purchase_order_items (purchase_order_id, item_id, quantity, unit, unit_price) VALUES ($1,$2,$3,$4,$5)',
        [order.id, item.item_id, item.quantity, item.unit || 'kg', item.unit_price || 0]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { order } });
  } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
};

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (p - 1) * l;
    const conditions = [];
    const params = [];
    if (status) { params.push(status); conditions.push(`po.status=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM purchase_orders po ${where}`, params);
    params.push(l, offset);
    const dataRes = await query(
      `SELECT po.*, u.name AS created_by_name, a.name AS approved_by_name
       FROM purchase_orders po
       LEFT JOIN users u ON u.id=po.created_by
       LEFT JOIN users a ON a.id=po.approved_by
       ${where} ORDER BY po.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params
    );
    res.json({ success: true, data: { orders: dataRes.rows, pagination: paginationMeta(parseInt(countRes.rows[0].count, 10), p, l) } });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT po.*, u.name AS created_by_name, a.name AS approved_by_name
       FROM purchase_orders po
       LEFT JOIN users u ON u.id=po.created_by
       LEFT JOIN users a ON a.id=po.approved_by
       WHERE po.id=$1`, [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    const items = await query(
      `SELECT poi.*, i.name AS item_name FROM purchase_order_items poi JOIN items i ON i.id=poi.item_id WHERE poi.purchase_order_id=$1`,
      [req.params.id]
    );
    result.rows[0].items = items.rows;
    res.json({ success: true, data: { order: result.rows[0] } });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { notes, items } = req.body;
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE purchase_orders SET notes=COALESCE($1,notes), updated_at=NOW() WHERE id=$2 AND status='draft' RETURNING *`,
      [notes || null, req.params.id]
    );
    if (!result.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found or not editable' } }); }
    if (Array.isArray(items)) {
      await client.query('DELETE FROM purchase_order_items WHERE purchase_order_id=$1', [req.params.id]);
      for (const item of items) {
        await client.query('INSERT INTO purchase_order_items (purchase_order_id, item_id, quantity, unit, unit_price) VALUES ($1,$2,$3,$4,$5)',
          [req.params.id, item.item_id, item.quantity, item.unit || 'kg', item.unit_price || 0]);
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, data: { order: result.rows[0] } });
  } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
};

const submit = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE purchase_orders SET status='submitted', updated_at=NOW() WHERE id=$1 AND status='draft' RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found or already submitted' } });
    res.json({ success: true, data: { order: result.rows[0] } });
  } catch (err) { next(err); }
};

module.exports = { create, list, getById, update, submit };
