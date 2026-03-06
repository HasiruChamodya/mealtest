'use strict';

const { query } = require('../config/database');
const { paginationMeta } = require('../utils/helpers');
const invoiceService = require('../services/invoice.service');

const create = async (req, res, next) => {
  try {
    const { order_id, supplier_name } = req.body;
    if (!order_id) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'order_id is required' } });
    const invoice = await invoiceService.generateInvoice(order_id, req.user.id, supplier_name);
    res.status(201).json({ success: true, data: { invoice } });
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (p - 1) * l;
    const conditions = [];
    const params = [];
    if (status) { params.push(status); conditions.push(`i.status=$${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM invoices i ${where}`, params);
    params.push(l, offset);
    const dataRes = await query(
      `SELECT i.*, u.name AS created_by_name, po.order_number
       FROM invoices i
       LEFT JOIN users u ON u.id=i.created_by
       LEFT JOIN purchase_orders po ON po.id=i.purchase_order_id
       ${where} ORDER BY i.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params
    );
    res.json({ success: true, data: { invoices: dataRes.rows, pagination: paginationMeta(parseInt(countRes.rows[0].count, 10), p, l) } });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT i.*, u.name AS created_by_name, po.order_number
       FROM invoices i
       LEFT JOIN users u ON u.id=i.created_by
       LEFT JOIN purchase_orders po ON po.id=i.purchase_order_id
       WHERE i.id=$1`, [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
    const items = await query(
      `SELECT ii.*, i2.name AS item_name, i2.unit FROM invoice_items ii JOIN items i2 ON i2.id=ii.item_id WHERE ii.invoice_id=$1`,
      [req.params.id]
    );
    result.rows[0].items = items.rows;
    res.json({ success: true, data: { invoice: result.rows[0] } });
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['draft', 'sent', 'paid'].includes(status)) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'status must be draft, sent, or paid' } });
    }
    const result = await query(
      'UPDATE invoices SET status=$1::invoice_status, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
    res.json({ success: true, data: { invoice: result.rows[0] } });
  } catch (err) { next(err); }
};

const download = async (req, res, next) => {
  try {
    const invoice = await query(
      `SELECT i.*, u.name AS created_by_name, po.order_number, ss.value AS hospital_name
       FROM invoices i
       LEFT JOIN users u ON u.id=i.created_by
       LEFT JOIN purchase_orders po ON po.id=i.purchase_order_id
       LEFT JOIN system_settings ss ON ss.key='hospital_name'
       WHERE i.id=$1`, [req.params.id]
    );
    if (!invoice.rows[0]) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Invoice not found' } });
    const items = await query(
      `SELECT ii.*, it.name AS item_name, it.unit FROM invoice_items ii JOIN items it ON it.id=ii.item_id WHERE ii.invoice_id=$1`,
      [req.params.id]
    );
    const data = { ...invoice.rows[0], items: items.rows };
    res.json({ success: true, data: { invoice: data } });
  } catch (err) { next(err); }
};

module.exports = { create, list, getById, updateStatus, download };
