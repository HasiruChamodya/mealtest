'use strict';

const { query, pool } = require('../config/database');
const { paginationMeta } = require('../utils/helpers');

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, meal_type_id, diet_type_id } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (p - 1) * l;
    const conditions = [];
    const params = [];
    if (meal_type_id) { params.push(meal_type_id); conditions.push(`r.meal_type_id=$${params.length}`); }
    if (diet_type_id) { params.push(diet_type_id); conditions.push(`r.diet_type_id=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM recipes r ${where}`, params);
    params.push(l, offset);
    const dataRes = await query(
      `SELECT r.*, mt.name AS meal_type_name, dt.name AS diet_type_name
       FROM recipes r
       LEFT JOIN meal_types mt ON mt.id = r.meal_type_id
       LEFT JOIN diet_types dt ON dt.id = r.diet_type_id
       ${where} ORDER BY r.name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params
    );
    res.json({ success: true, data: { recipes: dataRes.rows, pagination: paginationMeta(parseInt(countRes.rows[0].count, 10), p, l) } });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT r.*, mt.name AS meal_type_name, dt.name AS diet_type_name FROM recipes r
       LEFT JOIN meal_types mt ON mt.id = r.meal_type_id
       LEFT JOIN diet_types dt ON dt.id = r.diet_type_id
       WHERE r.id = $1`, [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recipe not found' } });
    const items = await query(
      `SELECT ri.*, i.name AS item_name, i.unit FROM recipe_items ri JOIN items i ON i.id = ri.item_id WHERE ri.recipe_id = $1`,
      [req.params.id]
    );
    result.rows[0].items = items.rows;
    res.json({ success: true, data: { recipe: result.rows[0] } });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, meal_type_id, diet_type_id, description, instructions, items = [] } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name is required' } });
    await client.query('BEGIN');
    const recipeRes = await client.query(
      'INSERT INTO recipes (name, meal_type_id, diet_type_id, description, instructions) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, meal_type_id || null, diet_type_id || null, description || null, instructions || null]
    );
    const recipe = recipeRes.rows[0];
    for (const item of items) {
      await client.query('INSERT INTO recipe_items (recipe_id, item_id, quantity_grams) VALUES ($1,$2,$3)', [recipe.id, item.item_id, item.quantity_grams]);
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { recipe } });
  } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
};

const update = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, meal_type_id, diet_type_id, description, instructions, items } = req.body;
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE recipes SET name=COALESCE($1,name), meal_type_id=COALESCE($2,meal_type_id), diet_type_id=COALESCE($3,diet_type_id),
       description=COALESCE($4,description), instructions=COALESCE($5,instructions), updated_at=NOW() WHERE id=$6 RETURNING *`,
      [name || null, meal_type_id || null, diet_type_id || null, description || null, instructions || null, req.params.id]
    );
    if (!result.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recipe not found' } }); }
    if (Array.isArray(items)) {
      await client.query('DELETE FROM recipe_items WHERE recipe_id=$1', [req.params.id]);
      for (const item of items) {
        await client.query('INSERT INTO recipe_items (recipe_id, item_id, quantity_grams) VALUES ($1,$2,$3)', [req.params.id, item.item_id, item.quantity_grams]);
      }
    }
    await client.query('COMMIT');
    res.json({ success: true, data: { recipe: result.rows[0] } });
  } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
};

const remove = async (req, res, next) => {
  try {
    const result = await query('DELETE FROM recipes WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Recipe not found' } });
    res.json({ success: true, data: { message: 'Recipe deleted' } });
  } catch (err) { next(err); }
};

module.exports = { list, getById, create, update, remove };
