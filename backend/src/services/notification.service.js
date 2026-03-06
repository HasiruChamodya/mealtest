'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Create a notification for a single user.
 */
async function createNotification(userId, title, message, type = 'info', relatedEntityType = null, relatedEntityId = null) {
  try {
    const result = await query(
      `INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [userId, title, message, type, relatedEntityType, relatedEntityId]
    );
    return result.rows[0];
  } catch (err) {
    logger.error('Failed to create notification', err);
    throw err;
  }
}

/**
 * Create notifications for all active users with the given role.
 */
async function notifyRole(role, title, message, type = 'info', relatedEntityType = null, relatedEntityId = null) {
  try {
    const users = await query('SELECT id FROM users WHERE role=$1 AND is_active=true', [role]);
    const notifications = await Promise.all(
      users.rows.map(user => createNotification(user.id, title, message, type, relatedEntityType, relatedEntityId))
    );
    return notifications;
  } catch (err) {
    logger.error(`Failed to notify role ${role}`, err);
    throw err;
  }
}

module.exports = { createNotification, notifyRole };
