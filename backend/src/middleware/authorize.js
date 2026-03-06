'use strict';

/**
 * Role-based authorization middleware factory.
 * @param {string[]} roles - Allowed roles
 */
module.exports = function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action' },
      });
    }
    next();
  };
};
