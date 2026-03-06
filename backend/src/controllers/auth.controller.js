'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '24h' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
}

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Username and password are required' } });
    }

    const result = await query('SELECT * FROM users WHERE username = $1 AND is_active = true', [username]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
    }

    const token = signToken(user);
    const refreshToken = signRefreshToken(user);

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: { id: user.id, username: user.username, name: user.name, role: user.role, email: user.email },
      },
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, username, name, role, email, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Refresh token is required' } });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Refresh token is invalid or expired' } });
    }

    const result = await query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.id]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found or inactive' } });
    }

    const token = signToken(user);
    res.json({ success: true, data: { token } });
  } catch (err) {
    next(err);
  }
};

module.exports = { login, logout, me, refresh };
