// src/utils/validation.js

/**
 * Utility functions for request validation
 */
class ValidationUtils {
  /**
   * Validate required fields in request body
   */
  static validateRequired(body, requiredFields) {
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
      error.missingFields = missingFields;
      error.status = 400;
      throw error;
    }
  }

  /**
   * Validate email format
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format (basic)
   */
  static validatePhone(phone) {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Validate environment value
   */
  static validateEnvironment(environment) {
    const validEnvironments = ['sandbox', 'development', 'production'];
    return validEnvironments.includes(environment);
  }

  /**
   * Validate account index
   */
  static validateAccountIndex(index, maxIndex = null) {
    const accountIndex = parseInt(index);
    
    if (isNaN(accountIndex) || accountIndex < 0) {
      return false;
    }
    
    if (maxIndex !== null && accountIndex >= maxIndex) {
      return false;
    }
    
    return true;
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input) {
    if (typeof input !== 'string') return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .slice(0, 1000); // Limit length
  }

  /**
   * Validate and sanitize address object
   */
  static validateAddress(address) {
    if (!address || typeof address !== 'object') {
      throw new Error('Address must be an object');
    }

    const requiredFields = ['street', 'city', 'state', 'zip'];
    this.validateRequired(address, requiredFields);

    return {
      street: this.sanitizeString(address.street),
      city: this.sanitizeString(address.city),
      state: this.sanitizeString(address.state),
      zip: this.sanitizeString(address.zip),
      country: this.sanitizeString(address.country) || 'US'
    };
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(query) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
    
    return { page, limit };
  }

  /**
   * Validate date range
   */
  static validateDateRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format');
    }
    
    if (start > end) {
      throw new Error('Start date must be before end date');
    }
    
    // Limit to 1 year range
    const maxRange = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
    if (end - start > maxRange) {
      throw new Error('Date range cannot exceed 1 year');
    }
    
    return { start, end };
  }

  /**
   * Create validation middleware
   */
  static createValidator(validationRules) {
    return (req, res, next) => {
      try {
        for (const rule of validationRules) {
          rule(req);
        }
        next();
      } catch (error) {
        const ResponseUtils = require('./response');
        return ResponseUtils.validationError(res, error.message);
      }
    };
  }

  /**
   * Common validation rules
   */
  static rules = {
    requireAuth: (req) => {
      if (!req.plaidClientId || !req.plaidSecret) {
        const error = new Error('Authentication required');
        error.status = 401;
        throw error;
      }
    },

    requireAccessToken: (req) => {
      if (!req.body.access_token && !global.accessToken) {
        throw new Error('Access token is required');
      }
    },

    validatePlaidCredentials: (req) => {
      const { environment } = req.body;
      
      if (!ValidationUtils.validateEnvironment(environment)) {
        throw new Error('Invalid environment');
      }
    },

    validateIdentityData: (req) => {
      const { name, email, phone, address } = req.body;
      
      ValidationUtils.validateRequired(req.body, ['name', 'email', 'phone', 'address']);
      
      if (!ValidationUtils.validateEmail(email)) {
        throw new Error('Invalid email format');
      }
      
      if (!ValidationUtils.validatePhone(phone)) {
        throw new Error('Invalid phone format');
      }
      
      ValidationUtils.validateAddress(address);
    }
  };
}

module.exports = ValidationUtils;