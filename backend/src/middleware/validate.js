'use strict';

/**
 * Joi validation middleware factory.
 * @param {Object} schema - Object with optional keys: body, params, query (Joi schemas)
 */
module.exports = function validate(schema) {
  return (req, res, next) => {
    const errors = [];

    ['body', 'params', 'query'].forEach((key) => {
      if (schema[key]) {
        const { error, value } = schema[key].validate(req[key], { abortEarly: false, stripUnknown: true });
        if (error) {
          errors.push(...error.details.map((d) => ({ field: `${key}.${d.path.join('.')}`, message: d.message })));
        } else {
          req[key] = value;
        }
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors },
      });
    }

    next();
  };
};
