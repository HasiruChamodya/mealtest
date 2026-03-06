'use strict';

const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  logger.debug('New PostgreSQL client connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

/**
 * Execute a parameterised query using the pool.
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug(`Executed query in ${duration}ms: ${text.substring(0, 80)}`);
  return res;
}

module.exports = { pool, query };
