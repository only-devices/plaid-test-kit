// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per minute
  message: { error: 'Too many requests, please take a deep breath and try again in a minute.' }
});

module.exports = {
  rateLimiter
};