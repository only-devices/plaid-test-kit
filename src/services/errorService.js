// src/services/errorService.js
const { logger } = require('../utils/logger');
const ResponseUtils = require('../utils/response');

/**
 * Centralized error handling service
 */
class ErrorService {
  /**
   * Handle Plaid API errors
   */
  static handlePlaidError(error) {
    const plaidError = error.response?.data;
    
    if (!plaidError) {
      return {
        type: 'UNKNOWN_ERROR',
        message: error.message || 'An unknown error occurred',
        userMessage: 'An unexpected error occurred. Please try again.'
      };
    }

    // Map Plaid error codes to user-friendly messages
    const errorMap = {
      'INVALID_CREDENTIALS': 'Invalid Plaid credentials provided',
      'INVALID_ACCESS_TOKEN': 'Access token is invalid or expired',
      'INVALID_PUBLIC_TOKEN': 'Public token is invalid or expired',
      'ITEM_NOT_FOUND': 'Item not found or no longer accessible',
      'INSUFFICIENT_CREDENTIALS': 'Additional authentication required',
      'INVALID_REQUEST': 'Invalid request parameters',
      'RATE_LIMIT_EXCEEDED': 'Too many requests. Please try again later.',
      'API_ERROR': 'Plaid service temporarily unavailable',
      'ITEM_LOGIN_REQUIRED': 'User needs to re-authenticate with their bank',
      'WEBHOOK_ERROR': 'Webhook configuration error'
    };

    const userMessage = errorMap[plaidError.error_code] || 
                       plaidError.error_message || 
                       'An error occurred while communicating with Plaid';

    return {
      type: 'PLAID_ERROR',
      code: plaidError.error_code,
      message: plaidError.error_message,
      userMessage,
      details: plaidError
    };
  }

  /**
   * Handle authentication errors
   */
  static handleAuthError(error, req) {
    const errorInfo = {
      type: 'AUTH_ERROR',
      message: error.message || 'Authentication failed',
      userMessage: 'Please log in to continue'
    };

    // Log authentication failure
    logger.auth('Authentication failed', req.plaidClientId, {
      error: error.message,
      path: req.path,
      ip: req.ip
    });

    return errorInfo;
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(error) {
    return {
      type: 'VALIDATION_ERROR',
      message: error.message,
      userMessage: error.message,
      field: error.field || null,
      missingFields: error.missingFields || null
    };
  }

  /**
   * Handle webhook errors
   */
  static handleWebhookError(error, webhookData = null) {
    const errorInfo = {
      type: 'WEBHOOK_ERROR',
      message: error.message,
      userMessage: 'Webhook processing failed'
    };

    // Log webhook error
    logger.webhook(
      webhookData?.webhook_type || 'unknown', 
      webhookData?.item_id || 'unknown', 
      false
    );

    return errorInfo;
  }

  /**
   * Handle database/storage errors
   */
  static handleStorageError(error) {
    return {
      type: 'STORAGE_ERROR',
      message: error.message,
      userMessage: 'Data storage error occurred'
    };
  }

  /**
   * Create error response based on error type
   */
  static createErrorResponse(error, req = null) {
    let errorInfo;

    // Determine error type and handle accordingly
    if (error.response?.data?.error_code) {
      errorInfo = this.handlePlaidError(error);
    } else if (error.status === 401 || error.message?.includes('auth')) {
      errorInfo = this.handleAuthError(error, req);
    } else if (error.status === 400 || error.missingFields) {
      errorInfo = this.handleValidationError(error);
    } else if (error.message?.includes('webhook')) {
      errorInfo = this.handleWebhookError(error);
    } else if (error.message?.includes('storage') || error.message?.includes('database')) {
      errorInfo = this.handleStorageError(error);
    } else {
      // Generic error
      errorInfo = {
        type: 'GENERIC_ERROR',
        message: error.message || 'An unexpected error occurred',
        userMessage: 'An unexpected error occurred. Please try again.'
      };
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      errorInfo.stack = error.stack;
    }

    return errorInfo;
  }

  /**
   * Express error handling middleware
   */
  static middleware() {
    return (error, req, res, next) => {
      // If response already sent, delegate to default Express error handler
      if (res.headersSent) {
        return next(error);
      }

      const errorInfo = this.createErrorResponse(error, req);
      
      // Log the error
      logger.error(`${errorInfo.type}: ${errorInfo.message}`, error);

      // Determine status code
      let statusCode = error.status || error.statusCode || 500;
      
      if (errorInfo.type === 'VALIDATION_ERROR') {
        statusCode = 400;
      } else if (errorInfo.type === 'AUTH_ERROR') {
        statusCode = 401;
      } else if (errorInfo.type === 'PLAID_ERROR') {
        statusCode = error.response?.status || 500;
      }

      // Send error response
      return res.status(statusCode).json({
        success: false,
        error: errorInfo.userMessage,
        type: errorInfo.type,
        ...(process.env.NODE_ENV === 'development' && {
          details: errorInfo.details,
          stack: errorInfo.stack
        }),
        timestamp: new Date().toISOString()
      });
    };
  }

  /**
   * Async wrapper for route handlers
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Create custom error classes
   */
  static createError(message, type = 'CUSTOM_ERROR', statusCode = 500, details = {}) {
    const error = new Error(message);
    error.type = type;
    error.status = statusCode;
    error.details = details;
    return error;
  }

  /**
   * Plaid-specific error creator
   */
  static createPlaidError(message, code = 'API_ERROR') {
    return this.createError(message, 'PLAID_ERROR', 500, { error_code: code });
  }

  /**
   * Validation error creator
   */
  static createValidationError(message, field = null, missingFields = null) {
    const error = this.createError(message, 'VALIDATION_ERROR', 400);
    if (field) error.field = field;
    if (missingFields) error.missingFields = missingFields;
    return error;
  }

  /**
   * Authentication error creator
   */
  static createAuthError(message = 'Authentication required') {
    return this.createError(message, 'AUTH_ERROR', 401);
  }

  /**
   * Rate limiting error creator
   */
  static createRateLimitError(message = 'Too many requests') {
    return this.createError(message, 'RATE_LIMIT_ERROR', 429);
  }

  /**
   * Get error statistics
   */
  static getErrorStats() {
    // This would typically connect to a logging service or database
    return {
      totalErrors: 0,
      errorsByType: {},
      recentErrors: [],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Health check that includes error monitoring
   */
  static healthCheck() {
    const stats = this.getErrorStats();
    const isHealthy = stats.totalErrors < 100; // Example threshold
    
    return {
      status: isHealthy ? 'healthy' : 'degraded',
      errorStats: stats,
      lastCheck: new Date().toISOString()
    };
  }
}

// Custom error classes
class PlaidError extends Error {
  constructor(message, code = 'API_ERROR', details = {}) {
    super(message);
    this.name = 'PlaidError';
    this.type = 'PLAID_ERROR';
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends Error {
  constructor(message, field = null, missingFields = null) {
    super(message);
    this.name = 'ValidationError';
    this.type = 'VALIDATION_ERROR';
    this.status = 400;
    this.field = field;
    this.missingFields = missingFields;
  }
}

class AuthError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthError';
    this.type = 'AUTH_ERROR';
    this.status = 401;
  }
}

module.exports = {
  ErrorService,
  PlaidError,
  ValidationError,
  AuthError
};