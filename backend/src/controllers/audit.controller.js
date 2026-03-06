'use strict';

const { query } = require('../config/database');
const { paginationMeta } = require('../utils/helpers');

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, user_id, entity_type, start_date, end_date } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (p - 1) * l;
    const conditions = [];
    const params = [];
    if (user_id)     { params.push(user_id);     conditions.push(`al.user_id=$${params.length}`); }
    if (entity_type) { params.push(entity_type); conditions.push(`al.entity_type=$${params.length}`); }
    if (start_date)  { params.push(start_date);  conditions.push(`al.created_at >= $${params.length}`); }
    if (end_date)    { params.push(end_date);     conditions.push(`al.created_at <= $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM audit_logs al ${where}`, params);
    params.push(l, offset);
    const dataRes = await query(
      `SELECT al.*, u.name AS user_name, u.role AS user_role
       FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id
       ${where} ORDER BY al.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ success: true, data: { logs: dataRes.rows, pagination: paginationMeta(parseInt(countRes.rows[0].count, 10), p, l) } });
  } catch (err) { next(err); }
};

module.exports = { list };
