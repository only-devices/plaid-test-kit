// src/routes/api/plaid-v2.js - Service-based Plaid routes
const express = require('express');
const router = express.Router();
const PlaidService = require('../../services/plaidService');
const { ErrorService } = require('../../services/errorService');
const ResponseUtils = require('../../utils/response');
const ValidationUtils = require('../../utils/validation');
const { plaid: plaidLogger } = require('../../utils/logger');
const { itemStore } = require('../../storage/itemStore');

// Store access token (in production, use proper database/session storage)
let accessToken = null;
let customLinkConfig = null;

// Status endpoint
router.get('/api/status', ErrorService.asyncHandler(async (req, res) => {
  const status = {
    hasAccessToken: !!accessToken,
    access_token: accessToken || null,
    has_custom_link_config: !!customLinkConfig,
    custom_link_config: customLinkConfig || null,
    environment: 'sandbox',
    authenticated: !!(req.plaidClientId && req.plaidSecret),
    user_environment: req.plaidEnvironment || 'unknown'
  };

  ResponseUtils.success(res, status);
}));

// Create link token
router.post('/api/create-link-token', ErrorService.asyncHandler(async (req, res) => {
  const plaidService = new PlaidService(req);
  
  plaidLogger.info('Creating link token', { 
    clientId: req.plaidClientId,
    environment: req.plaidEnvironment 
  });

  try {
    const result = await plaidService.createLinkToken(req.body);
    
    plaidLogger.plaidCall('linkTokenCreate', true, {
      hasHostedLink: !!result.hosted_link_url
    });

    ResponseUtils.success(res, result, 'Link token created successfully');

  } catch (error) {
    plaidLogger.plaidCall('linkTokenCreate', false, { error: error.message });
    throw ErrorService.createPlaidError('Failed to create link token');
  }
}));

// Exchange public token for access token
router.post('/api/exchange-token', ErrorService.asyncHandler(async (req, res) => {
  const { public_token } = req.body;

  ValidationUtils.validateRequired(req.body, ['public_token']);

  const plaidService = new PlaidService(req);

  try {
    const result = await plaidService.exchangePublicToken(public_token);
    
    // Store access token
    accessToken = result.access_token;

    // Store item info for webhook organization
    itemStore.set(result.item_id, {
      clientId: req.plaidClientId,
      secret: req.plaidSecret,
      environment: req.plaidEnvironment
    });

    plaidLogger.plaidCall('itemPublicTokenExchange', true, {
      itemId: result.item_id
    });

    ResponseUtils.success(res, {
      message: 'Token exchanged successfully',
      item_id: result.item_id,
      access_token: result.access_token
    });

  } catch (error) {
    plaidLogger.plaidCall('itemPublicTokenExchange', false, { error: error.message });
    throw ErrorService.createPlaidError('Failed to exchange token');
  }
}));

// Set access token directly
router.post('/api/set-token', ErrorService.asyncHandler(async (req, res) => {
  const { access_token } = req.body;

  ValidationUtils.validateRequired(req.body, ['access_token']);

  const plaidService = new PlaidService(req);

  try {
    // Validate the token
    await plaidService.validateAccessToken(access_token);
    
    accessToken = access_token;

    plaidLogger.info('Access token set successfully', { 
      clientId: req.plaidClientId 
    });

    ResponseUtils.success(res, {
      message: 'Access token set successfully',
      access_token: accessToken
    });

  } catch (error) {
    plaidLogger.error('Invalid access token provided', error);
    throw ErrorService.createValidationError('Invalid access token');
  }
}));

// Get available accounts
router.post('/api/get-accounts', ErrorService.asyncHandler(async (req, res) => {
  if (!accessToken) {
    throw ErrorService.createValidationError('No access token available. Please exchange a public token first.');
  }

  const plaidService = new PlaidService(req);

  try {
    const accounts = await plaidService.getAccounts(accessToken);
    
    plaidLogger.plaidCall('accountsGet', true, { 
      accountCount: accounts.length 
    });

    ResponseUtils.success(res, { accounts });

  } catch (error) {
    plaidLogger.plaidCall('accountsGet', false, { error: error.message });
    throw ErrorService.createPlaidError('Failed to get accounts');
  }
}));

// Test Identity endpoints
router.post('/api/test-identity', ErrorService.asyncHandler(async (req, res) => {
  if (!accessToken) {
    throw ErrorService.createValidationError('No access token available. Please exchange a public token first.');
  }

  const { name, email, phone, address, account_index } = req.body;
  
  if (email && !ValidationUtils.validateEmail(email)) {
    throw ErrorService.createValidationError('Invalid email format', 'email');
  }

  if (phone && !ValidationUtils.validatePhone(phone)) {
    throw ErrorService.createValidationError('Invalid phone format', 'phone');
  }

  const validatedAddress = (address && Object.keys(address).length > 0 && Object.values(address).some(val => val && val.trim())) ? ValidationUtils.validateAddress(address) : undefined;

  const plaidService = new PlaidService(req);
  const accountIndex = parseInt(account_index) || 0;

  try {
    // Build params object with only defined and non-null values
    const params = {};
    if (name != null) params.name = name;
    if (email != null) params.email = email;
    if (phone != null) params.phone = phone;
    if (validatedAddress != null) params.address = validatedAddress;

    const result = await plaidService.testIdentity(accessToken, params, accountIndex);

    plaidLogger.plaidCall('identityGet/identityMatch', true, {
      accountIndex,
      hasMatches: Object.values(result.match).some(score => score !== null)
    });

    ResponseUtils.success(res, result);

  } catch (error) {
    plaidLogger.plaidCall('identityGet/identityMatch', false, { error: error.message });
    throw ErrorService.createPlaidError('Failed to test identity endpoints');
  }
}));

// Test Auth endpoints
router.post('/api/test-auth', ErrorService.asyncHandler(async (req, res) => {
  if (!accessToken) {
    throw ErrorService.createValidationError('No access token available. Please exchange a public token first.');
  }

  const { account_index } = req.body;
  const accountIndex = parseInt(account_index) || 0;

  const plaidService = new PlaidService(req);

  try {
    const result = await plaidService.testAuth(accessToken, accountIndex);

    plaidLogger.plaidCall('authGet', true, { accountIndex });

    ResponseUtils.success(res, result);

  } catch (error) {
    plaidLogger.plaidCall('authGet', false, { error: error.message });
    throw ErrorService.createPlaidError('Failed to test auth endpoint');
  }
}));

// Test Balance endpoints
router.post('/api/test-balance', ErrorService.asyncHandler(async (req, res) => {
  if (!accessToken) {
    throw ErrorService.createValidationError('No access token available. Please exchange a public token first.');
  }

  const { account_index } = req.body;
  const accountIndex = parseInt(account_index) || 0;

  const plaidService = new PlaidService(req);

  try {
    const result = await plaidService.testBalance(accessToken, accountIndex);

    plaidLogger.plaidCall('accountsBalanceGet', true, { accountIndex });

    ResponseUtils.success(res, result);

  } catch (error) {
    plaidLogger.plaidCall('accountsBalanceGet', false, { error: error.message });
    throw ErrorService.createPlaidError('Failed to test balance endpoint');
  }
}));

// Clear access token
router.post('/api/clear-token', ErrorService.asyncHandler(async (req, res) => {
  accessToken = null;
  
  plaidLogger.info('Access token cleared', { 
    clientId: req.plaidClientId 
  });

  ResponseUtils.success(res, {}, 'Access token cleared successfully');
}));

// Set custom link configuration
router.post('/api/set-link-config', ErrorService.asyncHandler(async (req, res) => {
  const { config } = req.body;

  ValidationUtils.validateRequired(req.body, ['config']);

  if (!config || typeof config !== 'object') {
    throw ErrorService.createValidationError('Valid configuration object is required');
  }

  // Validate required fields
  const requiredFields = ['client_name', 'products', 'country_codes', 'user'];
  const missingFields = requiredFields.filter(field => !config[field]);

  if (missingFields.length > 0) {
    throw ErrorService.createValidationError(
      `Missing required fields: ${missingFields.join(', ')}`,
      null,
      missingFields
    );
  }

  // Validate products array
  if (!Array.isArray(config.products) || config.products.length === 0) {
    throw ErrorService.createValidationError('Products must be a non-empty array');
  }

  // Validate country codes
  if (!Array.isArray(config.country_codes) || config.country_codes.length === 0) {
    throw ErrorService.createValidationError('Country codes must be a non-empty array');
  }

  customLinkConfig = config;

  plaidLogger.info('Link configuration saved', { 
    clientId: req.plaidClientId,
    products: config.products,
    countryCodes: config.country_codes
  });

  ResponseUtils.success(res, { config: customLinkConfig }, 'Link token configuration saved successfully');
}));

// Get current link configuration
router.get('/api/get-link-config', ErrorService.asyncHandler(async (req, res) => {
  ResponseUtils.success(res, {
    config: customLinkConfig || null,
    has_custom_config: !!customLinkConfig
  });
}));

// Clear custom link configuration
router.post('/api/clear-link-config', ErrorService.asyncHandler(async (req, res) => {
  customLinkConfig = null;

  plaidLogger.info('Link configuration cleared', { 
    clientId: req.plaidClientId 
  });

  ResponseUtils.success(res, {}, 'Link token configuration cleared successfully');
}));

// Get item ID from access token
router.post('/api/get-item', ErrorService.asyncHandler(async (req, res) => {
  const { access_token } = req.body;

  ValidationUtils.validateRequired(req.body, ['access_token']);

  const plaidService = new PlaidService(req);

  try {
    const response = await plaidService.client.itemGet({ access_token });
    
    plaidLogger.plaidCall('itemGet', true, {
      itemId: response.data.item.item_id
    });

    ResponseUtils.success(res, { 
      item_id: response.data.item.item_id 
    });

  } catch (error) {
    plaidLogger.plaidCall('itemGet', false, { error: error.message });
    throw ErrorService.createPlaidError('Failed to get item');
  }
}));

// Set item ID for webhook organization
router.post('/api/set-item-id', ErrorService.asyncHandler(async (req, res) => {
  const { item_id } = req.body;

  ValidationUtils.validateRequired(req.body, ['item_id']);

  if (!itemStore.has(item_id)) {
    itemStore.set(item_id, {
      clientId: req.plaidClientId,
      secret: req.plaidSecret,
      environment: req.plaidEnvironment
    });

    plaidLogger.info('Item ID stored for webhook organization', {
      itemId: item_id,
      clientId: req.plaidClientId
    });
  } else {
    plaidLogger.info('Item ID already exists in store', {
      itemId: item_id,
      clientId: req.plaidClientId
    });
  }

  ResponseUtils.success(res, { item_id }, 'Item ID stored successfully');
}));

module.exports = router;