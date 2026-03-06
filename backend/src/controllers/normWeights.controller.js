'use strict';

const { query, pool } = require('../config/database');

const list = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT nw.*, i.name AS item_name, i.unit, mt.name AS meal_type_name, mt.code AS meal_type_code, dt.name AS diet_type_name, dt.code AS diet_type_code
       FROM norm_weights nw
       JOIN items i ON i.id = nw.item_id
       JOIN meal_types mt ON mt.id = nw.meal_type_id
       JOIN diet_types dt ON dt.id = nw.diet_type_id
       ORDER BY i.name, mt.sort_order, dt.name`
    );
    res.json({ success: true, data: { normWeights: result.rows } });
  } catch (err) { next(err); }
};

const getMatrix = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT nw.*, i.name AS item_name, mt.name AS meal_type_name, dt.name AS diet_type_name
       FROM norm_weights nw
       JOIN items i ON i.id = nw.item_id
       JOIN meal_types mt ON mt.id = nw.meal_type_id
       JOIN diet_types dt ON dt.id = nw.diet_type_id`
    );
    // Build nested matrix: { itemId: { mealTypeId: { dietTypeId: { weight, factor } } } }
    const matrix = {};
    for (const row of result.rows) {
      if (!matrix[row.item_id]) matrix[row.item_id] = { item_name: row.item_name };
      if (!matrix[row.item_id][row.meal_type_id]) matrix[row.item_id][row.meal_type_id] = { meal_type_name: row.meal_type_name };
      matrix[row.item_id][row.meal_type_id][row.diet_type_id] = {
        diet_type_name: row.diet_type_name,
        weight_grams: parseFloat(row.weight_grams),
        conversion_factor: parseFloat(row.conversion_factor),
        id: row.id,
      };
    }
    res.json({ success: true, data: { matrix } });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { item_id, meal_type_id, diet_type_id, weight_grams, conversion_factor = 1.0 } = req.body;
    if (!item_id || !meal_type_id || !diet_type_id || weight_grams === undefined) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'item_id, meal_type_id, diet_type_id, weight_grams are required' } });
    }
    const result = await query(
      `INSERT INTO norm_weights (item_id, meal_type_id, diet_type_id, weight_grams, conversion_factor)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [item_id, meal_type_id, diet_type_id, weight_grams, conversion_factor]
    );
    res.status(201).json({ success: true, data: { normWeight: result.rows[0] } });
  } catch (err) { next(err); }
};

const bulkUpdate = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { entries } = req.body; // Array of { item_id, meal_type_id, diet_type_id, weight_grams, conversion_factor }
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'entries array is required' } });
    }
    await client.query('BEGIN');
    const updated = [];
    for (const entry of entries) {
      const { item_id, meal_type_id, diet_type_id, weight_grams, conversion_factor = 1.0 } = entry;
      const r = await client.query(
        `INSERT INTO norm_weights (item_id, meal_type_id, diet_type_id, weight_grams, conversion_factor)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (item_id, meal_type_id, diet_type_id) DO UPDATE
           SET weight_grams=$4, conversion_factor=$5, updated_at=NOW()
         RETURNING *`,
        [item_id, meal_type_id, diet_type_id, weight_grams, conversion_factor]
      );
      updated.push(r.rows[0]);
    }
    await client.query('COMMIT');
    res.json({ success: true, data: { updated, count: updated.length } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

module.exports = { list, getMatrix, create, bulkUpdate };
