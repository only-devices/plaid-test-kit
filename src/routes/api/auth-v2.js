// src/routes/api/auth-v2.js - Service-based authentication routes
const express = require('express');
const router = express.Router();
const AuthService = require('../../services/authService');
const { ErrorService } = require('../../services/errorService');
const ResponseUtils = require('../../utils/response');
const ValidationUtils = require('../../utils/validation');
const { auth: authLogger } = require('../../utils/logger');

// Auth page route
router.get('/auth', (req, res) => {
  const error = req.query.error;
  const html = AuthService.generateAuthPageHTML(error);
  res.send(html);
});

// Validate API key endpoint with enhanced error handling
router.post('/api/validate-key', ErrorService.asyncHandler(async (req, res) => {
  const { clientId, secret, environment, remember } = req.body;

  // Validate input
  ValidationUtils.validateRequired(req.body, ['clientId', 'secret', 'environment']);
  
  if (!ValidationUtils.validateEnvironment(environment)) {
    throw ErrorService.createValidationError('Invalid environment', 'environment');
  }

  try {
    // Validate credentials with Plaid
    await AuthService.validateCredentials(clientId, secret, environment);

    // Store credentials securely
    const credentials = { clientId, secret, environment };
    AuthService.storeCredentials(req, res, credentials, remember);

    authLogger.auth('Login successful', clientId, { environment });

    // Redirect to home page
    res.redirect('/');

  } catch (error) {
    authLogger.auth('Login failed', clientId, { 
      environment, 
      error: error.message 
    });

    if (error.response?.data?.error_code) {
      // Plaid API error
      res.redirect('/auth?error=validation_failed');
    } else {
      // Generic error
      res.redirect('/auth?error=invalid');
    }
  }
}));

// Logout endpoint
router.post('/api/logout', ErrorService.asyncHandler(async (req, res) => {
  const returnUrl = req.body.returnUrl || req.query.returnUrl || '/auth';
  
  // Log logout event
  authLogger.auth('Logout', req.plaidClientId);
  
  // Clear credentials
  AuthService.logout(req, res);

  if (req.accepts('html')) {
    res.redirect(`${returnUrl}?message=logged_out`);
  } else {
    ResponseUtils.success(res, { redirect: returnUrl }, 'Logged out successfully');
  }
}));

// Get authentication status
router.get('/api/auth-status', ErrorService.asyncHandler(async (req, res) => {
  const status = AuthService.getAuthStatus(req);
  ResponseUtils.success(res, status);
}));

// Force reauthentication
router.post('/api/force-reauth', ErrorService.asyncHandler(async (req, res) => {
  authLogger.auth('Force reauth requested', req.plaidClientId);
  
  AuthService.forceReauth(req, res);

  if (req.accepts('html')) {
    res.redirect('/auth?message=reauth_requested');
  } else {
    ResponseUtils.success(res, { redirect: '/auth' }, 'Please re-authenticate');
  }
}));

module.exports = router;