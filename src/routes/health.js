// src/routes/health.js
const express = require('express');
const router = express.Router();
const { rateLimiter } = require('../middleware/rateLimiter');

// Health check endpoint (public for Railway health checks)
router.get('/health', rateLimiter, (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: 'sandbox',
    version: require('../../package.json').version || '2.0.0',
    node_version: process.version
  });
});

module.exports = router;