'use strict';

const { pool } = require('../config/database');
const { generateInvoiceNumber } = require('../utils/helpers');

/**
 * Generate an invoice from an approved purchase order.
 * Fetches the latest price for each item and creates invoice_items.
 */
async function generateInvoice(orderId, userId, supplierName) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch order
    const orderRes = await client.query('SELECT * FROM purchase_orders WHERE id=$1', [orderId]);
    const order = orderRes.rows[0];
    if (!order) throw Object.assign(new Error('Purchase order not found'), { status: 404 });

    // Fetch order items
    const itemsRes = await client.query(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id=$1', [orderId]
    );
    const orderItems = itemsRes.rows;

    let totalAmount = 0;
    const invoiceItems = [];

    for (const oi of orderItems) {
      // Get latest price for this item
      const priceRes = await client.query(
        `SELECT price_per_unit FROM item_prices WHERE item_id=$1 ORDER BY effective_date DESC, created_at DESC LIMIT 1`,
        [oi.item_id]
      );
      const unitPrice = priceRes.rows[0] ? parseFloat(priceRes.rows[0].price_per_unit) : parseFloat(oi.unit_price);
      const lineTotal = parseFloat(oi.quantity) * unitPrice;
      totalAmount += lineTotal;
      invoiceItems.push({ item_id: oi.item_id, quantity: oi.quantity, unit_price: unitPrice });
    }

    const invoiceNumber = generateInvoiceNumber();
    const invoiceRes = await client.query(
      `INSERT INTO invoices (purchase_order_id, invoice_number, supplier_name, total_amount, status, created_by)
       VALUES ($1, $2, $3, $4, 'draft', $5) RETURNING *`,
      [orderId, invoiceNumber, supplierName || 'Unknown Supplier', Math.round(totalAmount * 100) / 100, userId]
    );
    const invoice = invoiceRes.rows[0];

    for (const ii of invoiceItems) {
      await client.query(
        'INSERT INTO invoice_items (invoice_id, item_id, quantity, unit_price) VALUES ($1,$2,$3,$4)',
        [invoice.id, ii.item_id, ii.quantity, ii.unit_price]
      );
    }

    await client.query('COMMIT');
    return invoice;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { generateInvoice };
