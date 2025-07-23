// src/config/plaid.js
const { PlaidApi, PlaidEnvironments, Configuration } = require('plaid');
const { decryptCredentials } = require('../utils/crypto');

// Create dynamic Plaid client with user's credentials
const createPlaidClient = (req) => {
  if (!req.plaidClientId || !req.plaidSecret) {
    throw new Error('User credentials not available');
  }

  // Map environment string to Plaid environment
  const plaidEnvironments = {
    'sandbox': PlaidEnvironments.sandbox
  };

  // Determine environment from stored credentials
  const encryptedCreds = req.session?.plaidCredentials || req.cookies?.plaidCredentials;
  let environment = 'sandbox'; // default

  if (encryptedCreds) {
    try {
      const credentials = decryptCredentials(encryptedCreds);
      environment = credentials.environment || 'sandbox';
    } catch (e) {
      console.warn('Could not determine environment, using sandbox');
    }
  }

  const plaidConfig = new Configuration({
    basePath: plaidEnvironments[environment],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': req.plaidClientId,
        'PLAID-SECRET': req.plaidSecret,
      },
    },
  });

  return new PlaidApi(plaidConfig);
};

module.exports = {
  createPlaidClient,
  PlaidApi,
  PlaidEnvironments,
  Configuration
};