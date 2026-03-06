'use strict';

const { query } = require('../config/database');

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, unread_only } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (p - 1) * l;
    const conditions = [`user_id=$1`];
    const params = [req.user.id];
    if (unread_only === 'true') conditions.push('is_read=false');
    const where = `WHERE ${conditions.join(' AND ')}`;
    const countRes = await query(`SELECT COUNT(*) FROM notifications ${where}`, params);
    params.push(l, offset);
    const dataRes = await query(
      `SELECT * FROM notifications ${where} ORDER BY is_read ASC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ success: true, data: { notifications: dataRes.rows, total: parseInt(countRes.rows[0].count, 10) } });
  } catch (err) { next(err); }
};

const markRead = async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
    res.json({ success: true, data: { notification: result.rows[0] } });
  } catch (err) { next(err); }
};

const markAllRead = async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE notifications SET is_read=true WHERE user_id=$1 AND is_read=false',
      [req.user.id]
    );
    res.json({ success: true, data: { updated: result.rowCount } });
  } catch (err) { next(err); }
};

module.exports = { list, markRead, markAllRead };
