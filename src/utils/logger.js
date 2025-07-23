// src/utils/logger.js

/**
 * Enhanced logging utility with different levels and formatting
 */
class Logger {
  constructor(context = 'App') {
    this.context = context;
    this.colors = {
      reset: '\x1b[0m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };
  }

  /**
   * Format timestamp
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message
   */
  formatMessage(level, message, data = null) {
    const timestamp = this.getTimestamp();
    const contextStr = `[${this.context}]`;
    const levelStr = `[${level.toUpperCase()}]`;
    
    let formatted = `${timestamp} ${contextStr} ${levelStr} ${message}`;
    
    if (data) {
      formatted += `\n${JSON.stringify(data, null, 2)}`;
    }
    
    return formatted;
  }

  /**
   * Add color to console output
   */
  colorize(text, color) {
    if (process.env.NODE_ENV === 'production') {
      return text; // No colors in production
    }
    return `${this.colors[color]}${text}${this.colors.reset}`;
  }

  /**
   * Log info message
   */
  info(message, data = null) {
    const formatted = this.formatMessage('info', message, data);
    console.log(this.colorize(formatted, 'blue'));
  }

  /**
   * Log success message
   */
  success(message, data = null) {
    const formatted = this.formatMessage('success', message, data);
    console.log(this.colorize(formatted, 'green'));
  }

  /**
   * Log warning message
   */
  warn(message, data = null) {
    const formatted = this.formatMessage('warn', message, data);
    console.warn(this.colorize(formatted, 'yellow'));
  }

  /**
   * Log error message
   */
  error(message, error = null) {
    const errorData = error ? {
      message: error.message,
      stack: error.stack,
      ...(error.response?.data && { plaidError: error.response.data })
    } : null;
    
    const formatted = this.formatMessage('error', message, errorData);
    console.error(this.colorize(formatted, 'red'));
  }

  /**
   * Log debug message (only in development)
   */
  debug(message, data = null) {
    if (process.env.NODE_ENV !== 'development') return;
    
    const formatted = this.formatMessage('debug', message, data);
    console.log(this.colorize(formatted, 'magenta'));
  }

  /**
   * Log API request
   */
  request(method, path, userId = null) {
    const message = `${method} ${path}`;
    const data = userId ? { userId } : null;
    
    const formatted = this.formatMessage('request', message, data);
    console.log(this.colorize(formatted, 'cyan'));
  }

  /**
   * Log API response
   */
  response(method, path, statusCode, duration = null) {
    const message = `${method} ${path} - ${statusCode}`;
    const data = duration ? { duration: `${duration}ms` } : null;
    
    const color = statusCode >= 400 ? 'red' : statusCode >= 300 ? 'yellow' : 'green';
    const formatted = this.formatMessage('response', message, data);
    console.log(this.colorize(formatted, color));
  }

  /**
   * Log Plaid API calls
   */
  plaidCall(endpoint, success = true, details = null) {
    const message = `Plaid ${endpoint} ${success ? 'succeeded' : 'failed'}`;
    const level = success ? 'success' : 'error';
    
    const formatted = this.formatMessage(level, message, details);
    const color = success ? 'green' : 'red';
    console.log(this.colorize(formatted, color));
  }

  /**
   * Log authentication events
   */
  auth(event, userId = null, details = null) {
    const message = `Auth: ${event}`;
    const data = { userId, ...details };
    
    const formatted = this.formatMessage('auth', message, data);
    console.log(this.colorize(formatted, 'magenta'));
  }

  /**
   * Log webhook events
   */
  webhook(type, itemId, success = true) {
    const message = `Webhook ${type} for item ${itemId} ${success ? 'processed' : 'failed'}`;
    const level = success ? 'info' : 'error';
    
    const formatted = this.formatMessage(level, message);
    const color = success ? 'cyan' : 'red';
    console.log(this.colorize(formatted, color));
  }

  /**
   * Create middleware for request logging
   */
  requestMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      // Log request
      this.request(req.method, req.path, req.plaidClientId);
      
      // Override res.json to log response
      const originalJson = res.json;
      res.json = function(data) {
        const duration = Date.now() - start;
        logger.response(req.method, req.path, res.statusCode, duration);
        return originalJson.call(this, data);
      };
      
      next();
    };
  }

  /**
   * Create child logger with different context
   */
  child(context) {
    return new Logger(context);
  }
}

// Create default logger instance
const logger = new Logger('PlaidTestKit');

// Create specific loggers for different modules
const loggers = {
  app: logger,
  auth: logger.child('Auth'),
  plaid: logger.child('Plaid'),
  webhook: logger.child('Webhook'),
  api: logger.child('API')
};

module.exports = {
  Logger,
  logger,
  ...loggers
};