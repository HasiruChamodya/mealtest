'use strict';

const { query, pool } = require('../config/database');
const { paginationMeta } = require('../utils/helpers');

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (p - 1) * l;
    const countRes = await query('SELECT COUNT(*) FROM meal_cycles');
    const dataRes = await query('SELECT * FROM meal_cycles ORDER BY created_at DESC LIMIT $1 OFFSET $2', [l, offset]);
    if (dataRes.rows.length > 0) {
      const cycleIds = dataRes.rows.map(c => c.id);
      const allItems = await query(
        `SELECT mci.*, i.name AS item_name, mt.name AS meal_type_name FROM meal_cycle_items mci
         JOIN items i ON i.id = mci.item_id
         JOIN meal_types mt ON mt.id = mci.meal_type_id
         WHERE mci.meal_cycle_id = ANY($1::uuid[])`,
        [cycleIds]
      );
      const itemsByGroup = {};
      for (const row of allItems.rows) {
        if (!itemsByGroup[row.meal_cycle_id]) itemsByGroup[row.meal_cycle_id] = [];
        itemsByGroup[row.meal_cycle_id].push(row);
      }
      for (const cycle of dataRes.rows) cycle.items = itemsByGroup[cycle.id] || [];
    }
    res.json({ success: true, data: { mealCycles: dataRes.rows, pagination: paginationMeta(parseInt(countRes.rows[0].count, 10), p, l) } });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM meal_cycles WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Meal cycle not found' } });
    const items = await query(
      `SELECT mci.*, i.name AS item_name, mt.name AS meal_type_name FROM meal_cycle_items mci
       JOIN items i ON i.id = mci.item_id JOIN meal_types mt ON mt.id = mci.meal_type_id
       WHERE mci.meal_cycle_id = $1`, [req.params.id]
    );
    result.rows[0].items = items.rows;
    res.json({ success: true, data: { mealCycle: result.rows[0] } });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, description, items = [] } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
    await client.query('BEGIN');
    const cycleRes = await client.query(
      'INSERT INTO meal_cycles (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    );
    const cycle = cycleRes.rows[0];
    for (const item of items) {
      await client.query(
        'INSERT INTO meal_cycle_items (meal_cycle_id, item_id, meal_type_id) VALUES ($1, $2, $3)',
        [cycle.id, item.item_id, item.meal_type_id]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { mealCycle: cycle } });
  } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
};

const update = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, description, is_active, items } = req.body;
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE meal_cycles SET name=COALESCE($1,name), description=COALESCE($2,description), is_active=COALESCE($3,is_active), updated_at=NOW() WHERE id=$4 RETURNING *`,
      [name || null, description || null, is_active !== undefined ? is_active : null, req.params.id]
    );
    if (!result.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Meal cycle not found' } }); }
    if (Array.isArray(items)) {
      await client.query('DELETE FROM meal_cycle_items WHERE meal_cycle_id = $1', [req.params.id]);
      for (const item of items) {
        await client.query('INSERT INTO meal_cycle_items (meal_cycle_id, item_id, meal_type_id) VALUES ($1,$2,$3)', [req.params.id, item.item_id, item.meal_type_id]);
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, data: { mealCycle: result.rows[0] } });
  } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
};

const remove = async (req, res, next) => {
  try {
    const result = await query('UPDATE meal_cycles SET is_active=false, updated_at=NOW() WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Meal cycle not found' } });
    res.json({ success: true, data: { message: 'Meal cycle deactivated' } });
  } catch (err) { next(err); }
};

const getDaily = async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const result = await query(
      `SELECT dmc.*, pc.name AS patient_cycle_name, sc.name AS staff_cycle_name
       FROM daily_meal_cycle dmc
       LEFT JOIN meal_cycles pc ON pc.id = dmc.patient_cycle_id
       LEFT JOIN meal_cycles sc ON sc.id = dmc.staff_cycle_id
       WHERE dmc.date = $1`, [date]
    );
    res.json({ success: true, data: { dailyCycle: result.rows[0] || null } });
  } catch (err) { next(err); }
};

const setDaily = async (req, res, next) => {
  try {
    const { date, patient_cycle_id, staff_cycle_id } = req.body;
    const d = date || new Date().toISOString().slice(0, 10);
    const result = await query(
      `INSERT INTO daily_meal_cycle (date, patient_cycle_id, staff_cycle_id, set_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (date) DO UPDATE SET patient_cycle_id=$2, staff_cycle_id=$3, set_by=$4
       RETURNING *`,
      [d, patient_cycle_id || null, staff_cycle_id || null, req.user.id]
    );
    res.json({ success: true, data: { dailyCycle: result.rows[0] } });
  } catch (err) { next(err); }
};

module.exports = { list, getById, create, update, remove, getDaily, setDaily };
