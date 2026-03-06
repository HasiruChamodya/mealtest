'use strict';

const { query, pool } = require('../config/database');
const { paginationMeta, formatDate } = require('../utils/helpers');

const create = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { date, ward_id, meal_type_id, diet_counts = [], extras = [] } = req.body;
    if (!date || !ward_id || !meal_type_id) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'date, ward_id, meal_type_id are required' } });
    }
    await client.query('BEGIN');
    // Upsert census entry
    const entryRes = await client.query(
      `INSERT INTO census_entries (date, ward_id, meal_type_id, entered_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (date, ward_id, meal_type_id) DO UPDATE SET entered_by=$4, updated_at=NOW()
       RETURNING *`,
      [date, ward_id, meal_type_id, req.user.id]
    );
    const entry = entryRes.rows[0];

    // Replace diet counts
    await client.query('DELETE FROM census_diet_counts WHERE census_entry_id=$1', [entry.id]);
    for (const dc of diet_counts) {
      await client.query(
        'INSERT INTO census_diet_counts (census_entry_id, diet_type_id, patient_count) VALUES ($1,$2,$3)',
        [entry.id, dc.diet_type_id, dc.patient_count]
      );
    }

    // Replace extras
    await client.query('DELETE FROM census_extras WHERE census_entry_id=$1', [entry.id]);
    for (const ex of extras) {
      await client.query(
        'INSERT INTO census_extras (census_entry_id, item_id, quantity) VALUES ($1,$2,$3)',
        [entry.id, ex.item_id, ex.quantity]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { censusEntry: entry } });
  } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
};

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, date, ward_id } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (p - 1) * l;
    const conditions = [];
    const params = [];
    if (date) { params.push(date); conditions.push(`ce.date=$${params.length}`); }
    if (ward_id) { params.push(ward_id); conditions.push(`ce.ward_id=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM census_entries ce ${where}`, params);
    params.push(l, offset);
    const dataRes = await query(
      `SELECT ce.*, w.name AS ward_name, mt.name AS meal_type_name, u.name AS entered_by_name
       FROM census_entries ce
       LEFT JOIN wards w ON w.id = ce.ward_id
       LEFT JOIN meal_types mt ON mt.id = ce.meal_type_id
       LEFT JOIN users u ON u.id = ce.entered_by
       ${where} ORDER BY ce.date DESC, w.name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params
    );
    // Attach diet counts and extras with bulk queries
    if (dataRes.rows.length > 0) {
      const entryIds = dataRes.rows.map(e => e.id);
      const allDc = await query(
        `SELECT cdc.*, dt.name AS diet_type_name FROM census_diet_counts cdc JOIN diet_types dt ON dt.id=cdc.diet_type_id WHERE cdc.census_entry_id = ANY($1::uuid[])`,
        [entryIds]
      );
      const allEx = await query(
        `SELECT ce2.*, i.name AS item_name FROM census_extras ce2 JOIN items i ON i.id=ce2.item_id WHERE ce2.census_entry_id = ANY($1::uuid[])`,
        [entryIds]
      );
      const dcByEntry = {};
      for (const row of allDc.rows) {
        if (!dcByEntry[row.census_entry_id]) dcByEntry[row.census_entry_id] = [];
        dcByEntry[row.census_entry_id].push(row);
      }
      const exByEntry = {};
      for (const row of allEx.rows) {
        if (!exByEntry[row.census_entry_id]) exByEntry[row.census_entry_id] = [];
        exByEntry[row.census_entry_id].push(row);
      }
      for (const entry of dataRes.rows) {
        entry.diet_counts = dcByEntry[entry.id] || [];
        entry.extras = exByEntry[entry.id] || [];
      }
    }
    res.json({ success: true, data: { entries: dataRes.rows, pagination: paginationMeta(parseInt(countRes.rows[0].count, 10), p, l) } });
  } catch (err) { next(err); }
};

const getSubmissions = async (req, res, next) => {
  try {
    const { date } = req.query;
    const d = date || formatDate(new Date());
    const result = await query(
      `SELECT ce.*, w.name AS ward_name, mt.name AS meal_type_name
       FROM census_entries ce
       LEFT JOIN wards w ON w.id=ce.ward_id
       LEFT JOIN meal_types mt ON mt.id=ce.meal_type_id
       WHERE ce.date=$1 AND ce.entered_by=$2 ORDER BY w.name, mt.sort_order`,
      [d, req.user.id]
    );
    res.json({ success: true, data: { submissions: result.rows } });
  } catch (err) { next(err); }
};

const getStatus = async (req, res, next) => {
  try {
    const { date } = req.query;
    const d = date || formatDate(new Date());
    const wards = await query('SELECT id, name, code FROM wards WHERE is_active=true ORDER BY name');
    const mealTypes = await query('SELECT id, name, code, sort_order FROM meal_types ORDER BY sort_order');
    const submitted = await query(
      `SELECT ward_id, meal_type_id FROM census_entries WHERE date=$1`, [d]
    );
    const submittedSet = new Set(submitted.rows.map(r => `${r.ward_id}:${r.meal_type_id}`));
    const status = wards.rows.map(ward => ({
      ...ward,
      meal_types: mealTypes.rows.map(mt => ({
        ...mt,
        submitted: submittedSet.has(`${ward.id}:${mt.id}`),
      })),
    }));
    res.json({ success: true, data: { date: d, status } });
  } catch (err) { next(err); }
};

module.exports = { create, list, getSubmissions, getStatus };
