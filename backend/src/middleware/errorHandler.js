'use strict';

const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, next) {
  logger.error(`${err.name}: ${err.message}`, { stack: err.stack });

  // Joi validation error
  if (err.name === 'ValidationError' && err.isJoi) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      },
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired' },
    });
  }

  // PostgreSQL unique constraint violation
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'A record with this value already exists', details: err.detail },
    });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: { code: 'FOREIGN_KEY_VIOLATION', message: 'Referenced record does not exist', details: err.detail },
    });
  }

  // Not found (custom)
  if (err.status === 404) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: err.message || 'Resource not found' },
    });
  }

  // Generic 500
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};
