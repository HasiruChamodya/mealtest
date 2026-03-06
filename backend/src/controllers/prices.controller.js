'use strict';

const { query } = require('../config/database');

const list = async (req, res, next) => {
  try {
    // Return the latest effective price for each active item
    const result = await query(
      `SELECT DISTINCT ON (i.id)
         i.id AS item_id, i.name AS item_name, i.unit,
         ip.price_per_unit, ip.effective_date, ip.id AS price_id
       FROM items i
       LEFT JOIN item_prices ip ON ip.item_id = i.id
       WHERE i.is_active = true
       ORDER BY i.id, ip.effective_date DESC NULLS LAST, ip.created_at DESC NULLS LAST`
    );
    res.json({ success: true, data: { prices: result.rows } });
  } catch (err) { next(err); }
};

const updatePrice = async (req, res, next) => {
  try {
    const { price_per_unit, effective_date } = req.body;
    if (price_per_unit === undefined) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'price_per_unit is required' } });
    const result = await query(
      'INSERT INTO item_prices (item_id, price_per_unit, effective_date, created_by) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.itemId, price_per_unit, effective_date || new Date().toISOString().slice(0, 10), req.user.id]
    );
    res.status(201).json({ success: true, data: { price: result.rows[0] } });
  } catch (err) { next(err); }
};

const getPriceHistory = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ip.*, u.name AS created_by_name FROM item_prices ip
       LEFT JOIN users u ON u.id=ip.created_by
       WHERE ip.item_id=$1 ORDER BY ip.effective_date DESC, ip.created_at DESC`,
      [req.params.itemId]
    );
    res.json({ success: true, data: { history: result.rows } });
  } catch (err) { next(err); }
};

const bulkUpdate = async (req, res, next) => {
  try {
    const { prices } = req.body; // Array of { item_id, price_per_unit, effective_date }
    if (!Array.isArray(prices) || !prices.length) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'prices array is required' } });
    }
    const inserted = [];
    for (const p of prices) {
      const r = await query(
        'INSERT INTO item_prices (item_id, price_per_unit, effective_date, created_by) VALUES ($1,$2,$3,$4) RETURNING *',
        [p.item_id, p.price_per_unit, p.effective_date || new Date().toISOString().slice(0, 10), req.user.id]
      );
      inserted.push(r.rows[0]);
    }
    res.json({ success: true, data: { inserted, count: inserted.length } });
  } catch (err) { next(err); }
};

module.exports = { list, updatePrice, getPriceHistory, bulkUpdate };
