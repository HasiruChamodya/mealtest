'use strict';

const { query } = require('../config/database');

const list = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT b.*, u.name AS created_by_name FROM backups b LEFT JOIN users u ON u.id=b.created_by ORDER BY b.created_at DESC LIMIT 50`
    );
    res.json({ success: true, data: { backups: result.rows } });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const filename = `mealflow_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
    const result = await query(
      'INSERT INTO backups (filename, status, created_by) VALUES ($1, $2, $3) RETURNING *',
      [filename, 'pending', req.user.id]
    );
    // Simulate async completion (in production, trigger actual pg_dump here)
    await query('UPDATE backups SET status=$1, completed_at=NOW(), size_bytes=$2 WHERE id=$3', ['completed', 0, result.rows[0].id]);
    const updated = await query('SELECT * FROM backups WHERE id=$1', [result.rows[0].id]);
    res.status(201).json({ success: true, data: { backup: updated.rows[0] } });
  } catch (err) { next(err); }
};

const restore = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM backups WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Backup not found' } });
    // In production this would trigger an actual restore. Here we simulate.
    res.json({ success: true, data: { message: `Restore initiated for backup: ${result.rows[0].filename}` } });
  } catch (err) { next(err); }
};

module.exports = { list, create, restore };
