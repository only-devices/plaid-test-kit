// src/utils/response.js

/**
 * Utility functions for standardized API responses
 */
class ResponseUtils {
  /**
   * Send a success response
   */
  static success(res, data = {}, message = 'Success') {
    return res.json({
      success: true,
      message,
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send an error response
   */
  static error(res, error, statusCode = 500) {
    const errorData = {
      success: false,
      error: typeof error === 'string' ? error : error.message,
      timestamp: new Date().toISOString()
    };

    // Include additional error details in development
    if (process.env.NODE_ENV === 'development' && error.stack) {
      errorData.stack = error.stack;
    }

    // Include specific error details if available
    if (error.response?.data) {
      errorData.details = error.response.data;
    } else if (error.details) {
      errorData.details = error.details;
    }

    console.error(`API Error (${statusCode}):`, error);

    return res.status(statusCode).json(errorData);
  }

  /**
   * Send a validation error response
   */
  static validationError(res, message, field = null) {
    const errorData = {
      success: false,
      error: 'Validation Error',
      message,
      timestamp: new Date().toISOString()
    };

    if (field) {
      errorData.field = field;
    }

    return res.status(400).json(errorData);
  }

  /**
   * Send an authentication error response
   */
  static authError(res, message = 'Authentication required') {
    return res.status(401).json({
      success: false,
      error: 'Authentication Error',
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send a not found error response
   */
  static notFound(res, resource = 'Resource') {
    return res.status(404).json({
      success: false,
      error: 'Not Found',
      message: `${resource} not found`,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle async route errors
   */
  static asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Send paginated response
   */
  static paginated(res, data, total, page = 1, limit = 10) {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return res.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext,
        hasPrev
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send health check response
   */
  static health(res, additionalData = {}) {
    return res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      ...additionalData
    });
  }
}

module.exports = ResponseUtils;