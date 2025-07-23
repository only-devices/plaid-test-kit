// src/config/session.js
const session = require('express-session');
const path = require('path');
const FileStore = require('session-file-store')(session);

function createSessionConfig() {
  const sessionConfig = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on activity
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    },
    name: 'plaid-test-kit-session'
  };

  // Always use FileStore to persist sessions across server restarts
  sessionConfig.store = new FileStore({
    path: path.join(__dirname, '../../sessions'),
    ttl: 86400, // 24 hours in seconds
    retries: 0,
    logFn: function () { }, // Disable file store logging
    // Automatic cleanup options
    reapInterval: 3600, // Clean up every hour (in seconds)
    reapAsync: true,    // Don't block the event loop during cleanup
    reapSyncFallback: false // Disable sync fallback for better performance
  });

  return sessionConfig;
}

module.exports = {
  createSessionConfig,
  session
};