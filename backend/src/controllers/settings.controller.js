'use strict';

const { query } = require('../config/database');

const list = async (req, res, next) => {
  try {
    const result = await query('SELECT id, key, value, description, updated_at FROM system_settings ORDER BY key');
    res.json({ success: true, data: { settings: result.rows } });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'value is required' } });
    const result = await query(
      `INSERT INTO system_settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_by=$3, updated_at=NOW()
       RETURNING *`,
      [req.params.key, value, req.user.id]
    );
    res.json({ success: true, data: { setting: result.rows[0] } });
  } catch (err) { next(err); }
};

module.exports = { list, update };
