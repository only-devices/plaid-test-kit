// app-final.js - Ultimate service-based architecture
const express = require('express');
const cookieParser = require('cookie-parser');

// Import configuration modules
const { BASE_URL, PORT, validateEnvironment } = require('./src/config/environment');
const { createSessionConfig, session } = require('./src/config/session');

// Import middleware
const { validateApiKey } = require('./src/middleware/auth');
const { ErrorService } = require('./src/services/errorService');

// Import enhanced route modules
const authRoutesV2 = require('./src/routes/api/auth-v2');
const plaidRoutesV2 = require('./src/routes/api/plaid-v2');
const webhookRoutesV2 = require('./src/routes/api/webhooks-v2');
const healthRoutes = require('./src/routes/health');
const pageRoutes = require('./src/routes/pages');

// Import utilities
const { logger } = require('./src/utils/logger');

// Import storage (this initializes the itemStore)
require('./src/storage/itemStore');

// Validate environment variables
validateEnvironment();

const app = express();
app.set('trust proxy', 1); // Trust first proxy (ngrok or similar)

// 1. BASIC MIDDLEWARE
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Session configuration
app.use(session(createSessionConfig()));

// Request logging middleware
app.use(logger.requestMiddleware());

// 2. PUBLIC ROUTES (before auth middleware)
app.use(healthRoutes);
app.use(webhookRoutesV2);

// 3. APPLY AUTH MIDDLEWARE (protects routes below)
app.use(validateApiKey);

// 4. PROTECTED ROUTES (service-based)
app.use(authRoutesV2);
app.use(plaidRoutesV2);
app.use(pageRoutes);

// 5. STATIC FILES (served last)
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// 6. ERROR HANDLING MIDDLEWARE (must be last)
app.use(ErrorService.middleware());

// 404 handler
app.use((req, res) => {
  const ResponseUtils = require('./src/utils/response');
  ResponseUtils.notFound(res, 'Page');
});

// Start the server
app.listen(PORT, () => {
  logger.success(`Plaid Test Kit (Service-Based) running on ${BASE_URL}`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    features: [
      'Service-based architecture',
      'Enhanced error handling',
      'Comprehensive logging',
      'Request validation',
      'Webhook management',
      'Authentication service'
    ]
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;