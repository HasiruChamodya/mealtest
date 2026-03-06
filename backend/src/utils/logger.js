'use strict';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] !== undefined ? LEVELS[process.env.LOG_LEVEL] : LEVELS.info;

function log(level, message, meta) {
  if (LEVELS[level] > currentLevel) return;
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${message}`;
  if (meta) {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](base, meta);
  } else {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](base);
  }
}

const logger = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};

module.exports = logger;
