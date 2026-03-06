'use strict';

/**
 * Append LIMIT/OFFSET clauses to a SQL query string.
 * @param {string} sql
 * @param {number} page  - 1-based page number
 * @param {number} limit - records per page
 * @returns {{ sql: string, offset: number }}
 */
function paginate(sql, page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;
  return { sql: `${sql} LIMIT ${l} OFFSET ${offset}`, offset, limit: l };
}

/**
 * Build a pagination metadata object.
 */
function paginationMeta(total, page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return {
    total: parseInt(total, 10),
    page: p,
    limit: l,
    totalPages: Math.ceil(parseInt(total, 10) / l),
  };
}

/**
 * Generate a unique purchase order number like PO-YYYYMMDD-XXXXX.
 */
function generateOrderNumber() {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `PO-${ymd}-${rand}`;
}

/**
 * Generate a unique invoice number like INV-YYYYMMDD-XXXXX.
 */
function generateInvoiceNumber() {
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `INV-${ymd}-${rand}`;
}

/**
 * Format a Date object or ISO string as YYYY-MM-DD.
 */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}

module.exports = { paginate, paginationMeta, generateOrderNumber, generateInvoiceNumber, formatDate };
