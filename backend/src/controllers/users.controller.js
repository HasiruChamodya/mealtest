'use strict';

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { paginationMeta } = require('../utils/helpers');

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (p - 1) * l;

    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR username ILIKE $${params.length})`);
    }
    if (role) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM users ${where}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    params.push(l, offset);
    const dataRes = await query(
      `SELECT id, username, name, role, email, is_active, created_at, updated_at FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ success: true, data: { users: dataRes.rows, pagination: paginationMeta(total, p, l) } });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, username, name, role, email, is_active, created_at, updated_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { username, password, name, role, email } = req.body;
    if (!username || !password || !name || !role) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'username, password, name, and role are required' } });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (username, password_hash, name, role, email) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, name, role, email, is_active, created_at',
      [username, passwordHash, name, role, email || null]
    );
    res.status(201).json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, role, email } = req.body;
    const result = await query(
      `UPDATE users SET
        name = COALESCE($1, name),
        role = COALESCE($2::user_role, role),
        email = COALESCE($3, email),
        updated_at = NOW()
       WHERE id = $4
       RETURNING id, username, name, role, email, is_active, created_at, updated_at`,
      [name || null, role || null, email || null, req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { is_active } = req.body;
    if (is_active === undefined) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'is_active is required' } });
    }
    const result = await query(
      'UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, name, role, is_active',
      [is_active, req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update, updateStatus };
