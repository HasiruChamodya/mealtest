'use strict';

const { query } = require('../config/database');
const { paginationMeta } = require('../utils/helpers');

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (p - 1) * l;
    const countRes = await query(`SELECT COUNT(*) FROM purchase_orders WHERE status='submitted'`);
    const dataRes = await query(
      `SELECT po.*, u.name AS created_by_name
       FROM purchase_orders po LEFT JOIN users u ON u.id=po.created_by
       WHERE po.status='submitted' ORDER BY po.created_at DESC LIMIT $1 OFFSET $2`, [l, offset]
    );
    res.json({ success: true, data: { orders: dataRes.rows, pagination: paginationMeta(parseInt(countRes.rows[0].count, 10), p, l) } });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT po.*, u.name AS created_by_name FROM purchase_orders po LEFT JOIN users u ON u.id=po.created_by WHERE po.id=$1`,
      [req.params.id]
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

const approve = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE purchase_orders SET status='approved', approved_by=$1, approved_at=NOW(), updated_at=NOW()
       WHERE id=$2 AND status='submitted' RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found or not pending approval' } });
    res.json({ success: true, data: { order: result.rows[0] } });
  } catch (err) { next(err); }
};

const reject = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const result = await query(
      `UPDATE purchase_orders SET status='rejected', approved_by=$1, approved_at=NOW(), notes=COALESCE($2, notes), updated_at=NOW()
       WHERE id=$3 AND status='submitted' RETURNING *`,
      [req.user.id, notes || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found or not pending approval' } });
    res.json({ success: true, data: { order: result.rows[0] } });
  } catch (err) { next(err); }
};

module.exports = { list, getById, approve, reject };
