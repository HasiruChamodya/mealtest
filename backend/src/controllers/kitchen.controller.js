'use strict';

const { query, pool } = require('../config/database');
const { formatDate } = require('../utils/helpers');

const getCookSheet = async (req, res, next) => {
  try {
    const date = formatDate(new Date());
    return getCookSheetForDate(date, res, next);
  } catch (err) { next(err); }
};

const getCookSheetByDate = async (req, res, next) => {
  try {
    return getCookSheetForDate(req.params.date, res, next);
  } catch (err) { next(err); }
};

async function getCookSheetForDate(date, res, next) {
  try {
    // Find the latest completed calculation for the date
    const calcRes = await query(
      `SELECT id FROM calculations WHERE date=$1 AND status IN ('completed','approved') ORDER BY created_at DESC LIMIT 1`,
      [date]
    );
    if (!calcRes.rows[0]) {
      return res.json({ success: true, data: { date, cook_sheet: [], message: 'No calculation found for this date' } });
    }
    const calcId = calcRes.rows[0].id;
    const results = await query(
      `SELECT cr.*, i.name AS item_name, i.unit, mt.name AS meal_type_name
       FROM calculation_results cr
       LEFT JOIN items i ON i.id=cr.item_id
       LEFT JOIN meal_types mt ON mt.id=cr.meal_type_id
       WHERE cr.calculation_id=$1 AND cr.stage='final'
       ORDER BY i.name`, [calcId]
    );
    res.json({ success: true, data: { date, calculation_id: calcId, cook_sheet: results.rows } });
  } catch (err) { next(err); }
}

const createDelivery = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { purchase_order_id, notes, items = [] } = req.body;
    await client.query('BEGIN');
    const deliveryRes = await client.query(
      'INSERT INTO deliveries (purchase_order_id, received_by, notes) VALUES ($1,$2,$3) RETURNING *',
      [purchase_order_id || null, req.user.id, notes || null]
    );
    const delivery = deliveryRes.rows[0];
    for (const item of items) {
      await client.query(
        `INSERT INTO delivery_items (delivery_id, item_id, expected_quantity, received_quantity, quality_status, notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [delivery.id, item.item_id, item.expected_quantity || null, item.received_quantity || null,
         item.quality_status || 'good', item.notes || null]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { delivery } });
  } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
};

const listDeliveries = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT d.*, u.name AS received_by_name, po.order_number
       FROM deliveries d
       LEFT JOIN users u ON u.id=d.received_by
       LEFT JOIN purchase_orders po ON po.id=d.purchase_order_id
       ORDER BY d.received_at DESC LIMIT 50`
    );
    res.json({ success: true, data: { deliveries: result.rows } });
  } catch (err) { next(err); }
};

const getDelivery = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT d.*, u.name AS received_by_name FROM deliveries d LEFT JOIN users u ON u.id=d.received_by WHERE d.id=$1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Delivery not found' } });
    const items = await query(
      `SELECT di.*, i.name AS item_name FROM delivery_items di JOIN items i ON i.id=di.item_id WHERE di.delivery_id=$1`,
      [req.params.id]
    );
    if (items.rows.length > 0) {
      const itemIds = items.rows.map(di => di.id);
      const allPhotos = await query('SELECT * FROM delivery_photos WHERE delivery_item_id = ANY($1::uuid[])', [itemIds]);
      const photosByItem = {};
      for (const photo of allPhotos.rows) {
        if (!photosByItem[photo.delivery_item_id]) photosByItem[photo.delivery_item_id] = [];
        photosByItem[photo.delivery_item_id].push(photo);
      }
      for (const item of items.rows) item.photos = photosByItem[item.id] || [];
    }
    result.rows[0].items = items.rows;
    res.json({ success: true, data: { delivery: result.rows[0] } });
  } catch (err) { next(err); }
};

const updateDeliveryItem = async (req, res, next) => {
  try {
    const { received_quantity, quality_status, notes } = req.body;
    const result = await query(
      `UPDATE delivery_items SET
         received_quantity=COALESCE($1,received_quantity),
         quality_status=COALESCE($2::quality_status,quality_status),
         notes=COALESCE($3,notes)
       WHERE delivery_id=$4 AND id=$5 RETURNING *`,
      [received_quantity !== undefined ? received_quantity : null, quality_status || null, notes || null, req.params.id, req.params.itemId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Delivery item not found' } });
    res.json({ success: true, data: { deliveryItem: result.rows[0] } });
  } catch (err) { next(err); }
};

const addPhoto = async (req, res, next) => {
  try {
    const { photo_url } = req.body;
    if (!photo_url) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'photo_url is required' } });
    const result = await query(
      'INSERT INTO delivery_photos (delivery_item_id, photo_url) VALUES ($1,$2) RETURNING *',
      [req.params.itemId, photo_url]
    );
    res.status(201).json({ success: true, data: { photo: result.rows[0] } });
  } catch (err) { next(err); }
};

const createIssueReport = async (req, res, next) => {
  try {
    const { delivery_id, delivery_item_id, description, severity } = req.body;
    if (!description) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'description is required' } });
    const result = await query(
      'INSERT INTO issue_reports (delivery_id, delivery_item_id, reported_by, description, severity) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [delivery_id || null, delivery_item_id || null, req.user.id, description, severity || 'medium']
    );
    res.status(201).json({ success: true, data: { issueReport: result.rows[0] } });
  } catch (err) { next(err); }
};

const listIssueReports = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ir.*, u.name AS reported_by_name FROM issue_reports ir
       LEFT JOIN users u ON u.id=ir.reported_by
       ORDER BY ir.created_at DESC LIMIT 100`
    );
    res.json({ success: true, data: { issueReports: result.rows } });
  } catch (err) { next(err); }
};

module.exports = { getCookSheet, getCookSheetByDate, createDelivery, listDeliveries, getDelivery, updateDeliveryItem, addPhoto, createIssueReport, listIssueReports };
