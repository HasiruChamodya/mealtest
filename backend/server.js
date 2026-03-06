'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const routes = require('./src/routes/index');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Request logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' } },
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`MealFlow backend listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;
