// src/services/plaidService.js
const { createPlaidClient } = require('../config/plaid');
const { BASE_URL } = require('../config/environment');

class PlaidService {
  constructor(req) {
    this.client = createPlaidClient(req);
    this.req = req;
  }

  /**
   * Create a link token with customizable configuration
   */
  async createLinkToken(options = {}) {
    const {
      update_mode,
      access_token,
      custom_config,
      hosted_link,
      ...requestOverrides
    } = options;

    // Start with default configuration
    let linkTokenConfig = {
      user: {
        client_user_id: 'test-kit-user-' + Date.now(),
      },
      client_name: 'Plaid Test Kit',
      products: ['auth'],
      country_codes: ['US'],
      language: 'en',
    };

    // Apply custom configuration if provided
    if (custom_config) {
      const userClientId = linkTokenConfig.user.client_user_id;
      linkTokenConfig = { ...linkTokenConfig, ...custom_config };

      if (!linkTokenConfig.user) {
        linkTokenConfig.user = { client_user_id: userClientId };
      } else if (!linkTokenConfig.user.client_user_id) {
        linkTokenConfig.user.client_user_id = userClientId;
      }
    }

    // Apply request-level overrides
    linkTokenConfig = { ...linkTokenConfig, ...requestOverrides };

    // Add OAuth redirect URI
    linkTokenConfig.redirect_uri = `${BASE_URL}/oauth-redirect`;

    // Handle hosted link mode
    if (hosted_link) {
      linkTokenConfig.hosted_link = hosted_link;
      if (!linkTokenConfig.hosted_link.completion_redirect_uri) {
        linkTokenConfig.hosted_link.completion_redirect_uri = `${BASE_URL}/hosted-link-complete`;
      }
    }

    // Handle update mode
    if (update_mode && access_token) {
      linkTokenConfig.access_token = access_token;
      linkTokenConfig.update = {
        account_selection_enabled: true
      };
    }

    try {
      const response = await this.client.linkTokenCreate(linkTokenConfig);

      return {
        link_token: response.data.link_token,
        hosted_link_url: response.data.hosted_link_url || null,
        configuration_used: linkTokenConfig
      };
    } catch (error) {
      console.error('Plaid linkTokenCreate error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: linkTokenConfig
      });
      throw error;
    }
  }

  /**
   * Exchange public token for access token
   */
  async exchangePublicToken(publicToken) {
    const response = await this.client.itemPublicTokenExchange({
      public_token: publicToken,
    });

    return {
      access_token: response.data.access_token,
      item_id: response.data.item_id
    };
  }

  /**
   * Get account information
   */
  async getAccounts(accessToken) {
    const response = await this.client.accountsGet({
      access_token: accessToken,
    });

    return response.data.accounts.map((account, index) => ({
      account_id: account.account_id,
      name: account.name,
      official_name: account.official_name,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      index: index
    }));
  }

  /**
   * Test identity endpoints for a specific account
   */
  async testIdentity(accessToken, userData, accountIndex = 0) {
    // Get all accounts first
    const accountsResponse = await this.client.accountsGet({
      access_token: accessToken,
    });

    if (!accountsResponse.data.accounts || accountsResponse.data.accounts.length === 0) {
      throw new Error('No accounts found');
    }

    if (accountIndex >= accountsResponse.data.accounts.length) {
      throw new Error(`Selected account index ${accountIndex} is out of range`);
    }

    const selectedAccount = accountsResponse.data.accounts[accountIndex];
    const selectedAccountId = selectedAccount.account_id;

    // Prepare user data for matching
    const matchingUserData = {};
    
    if (userData.name) matchingUserData.legal_name = userData.name;
    if (userData.email) matchingUserData.email_address = userData.email;
    if (userData.phone) matchingUserData.phone_number = userData.phone;
    
    if (userData.address) {
      matchingUserData.address = {
        street: userData.address.street,
        city: userData.address.city,
        region: userData.address.state,
        postal_code: userData.address.zip,
        country: userData.address.country || 'US'
      };
    }

    // Call both endpoints with account filtering
    const [getResponse, matchResponse] = await Promise.all([
      this.client.identityGet({
        access_token: accessToken,
        options: {
          account_ids: [selectedAccountId]
        }
      }),
      this.client.identityMatch({
        access_token: accessToken,
        user: matchingUserData,
        options: {
          account_ids: [selectedAccountId]
        }
      })
    ]);

    if (!getResponse.data.accounts || getResponse.data.accounts.length === 0) {
      throw new Error('No accounts found in identity/get response');
    }

    if (!matchResponse.data.accounts || matchResponse.data.accounts.length === 0) {
      throw new Error('No accounts found in identity/match response');
    }

    const identityAccount = getResponse.data.accounts[0];
    const matchData = matchResponse.data.accounts[0];
    const identityData = identityAccount?.owners?.[0] || {};

    return {
      selected_account: {
        index: accountIndex,
        name: selectedAccount.name,
        official_name: selectedAccount.official_name,
        account_id: selectedAccount.account_id
      },
      account: {
        id: identityAccount.account_id || '',
        name: identityAccount.name || '',
        mask: identityAccount.mask || ''
      },
      identity: {
        name: identityData.names?.[0] || '',
        email: identityData.emails?.[0]?.data || '',
        phone: identityData.phone_numbers?.[0]?.data || '',
        address: {
          street: identityData.addresses?.[0]?.data?.street || '',
          city: identityData.addresses?.[0]?.data?.city || '',
          region: identityData.addresses?.[0]?.data?.region || '',
          postal_code: identityData.addresses?.[0]?.data?.postal_code || '',
          country: identityData.addresses?.[0]?.data?.country || ''
        }
      },
      match: {
        name_score: matchData.legal_name?.score ?? null,
        email_score: matchData.email_address?.score ?? null,
        phone_score: matchData.phone_number?.score ?? null,
        address_score: matchData.address?.score ?? null,
        is_postal_code_match: matchData.address?.is_postal_code_match || false,
        is_nickname_match: matchData.legal_name?.is_nickname_match || false,
        is_first_name_or_last_name_match: matchData.legal_name?.is_first_name_or_last_name_match || false,
        is_business_name_detected: matchData.legal_name?.is_business_name_detected || false
      },
      raw_response: {
        identity_get: getResponse.data,
        identity_match: matchResponse.data
      }
    };
  }

  /**
   * Test auth endpoint for a specific account
   */
  async testAuth(accessToken, accountIndex = 0) {
    // Get all accounts first
    const accountsResponse = await this.client.accountsGet({
      access_token: accessToken,
    });

    if (!accountsResponse.data.accounts || accountsResponse.data.accounts.length === 0) {
      throw new Error('No accounts found');
    }

    if (accountIndex >= accountsResponse.data.accounts.length) {
      throw new Error(`Selected account index ${accountIndex} is out of range`);
    }

    const selectedAccount = accountsResponse.data.accounts[accountIndex];
    const selectedAccountId = selectedAccount.account_id;

    // Call Auth API with account filtering
    const authResponse = await this.client.authGet({
      access_token: accessToken,
      options: {
        account_ids: [selectedAccountId]
      }
    });

    if (!authResponse.data.accounts || authResponse.data.accounts.length === 0) {
      throw new Error('No accounts found in auth/get response');
    }

    const authAccountType = 'ach';
    const authAccount = authResponse.data.accounts[0];
    const authData = authResponse.data.numbers || {};

    return {
      selected_account: {
        index: accountIndex,
        name: selectedAccount.name,
        official_name: selectedAccount.official_name,
        account_id: selectedAccount.account_id,
        mask: selectedAccount.mask
      },
      auth_data: {
        account_number: authData[authAccountType]?.[0].account || null,
        routing_number: authData[authAccountType]?.[0].routing || null,
        wire_routing_number: authData[authAccountType]?.[0].wire_routing || null,
        account_type: authAccount.type || null,
        account_subtype: authAccount.subtype || null
      },
      balance_data: {
        available: authAccount.balances?.available || null,
        current: authAccount.balances?.current || null,
        iso_currency_code: authAccount.balances?.iso_currency_code || null,
        unofficial_currency_code: authAccount.balances?.unofficial_currency_code || null
      },
      item_id: authResponse.data.item?.item_id || null,
      request_id: authResponse.data.request_id,
      raw_response: authResponse.data
    };
  }

  /**
   * Test balance endpoint for a specific account
   */
  async testBalance(accessToken, accountIndex = 0) {
    // Get all accounts first
    const accountsResponse = await this.client.accountsGet({
      access_token: accessToken,
    });

    if (!accountsResponse.data.accounts || accountsResponse.data.accounts.length === 0) {
      throw new Error('No accounts found');
    }

    if (accountIndex >= accountsResponse.data.accounts.length) {
      throw new Error(`Selected account index ${accountIndex} is out of range`);
    }

    const selectedAccount = accountsResponse.data.accounts[accountIndex];
    const selectedAccountId = selectedAccount.account_id;

    // Call Balance API with account filtering
    const balanceResponse = await this.client.accountsBalanceGet({
      access_token: accessToken,
      options: {
        account_ids: [selectedAccountId]
      }
    });

    if (!balanceResponse.data.accounts || balanceResponse.data.accounts.length === 0) {
      throw new Error('No accounts found in balance/get response');
    }

    const balanceAccount = balanceResponse.data.accounts[0];

    return {
      selected_account: {
        index: accountIndex,
        name: selectedAccount.name,
        official_name: selectedAccount.official_name,
        account_id: selectedAccount.account_id,
        type: selectedAccount.type,
        subtype: selectedAccount.subtype
      },
      balance_data: {
        available: balanceAccount.balances?.available || null,
        current: balanceAccount.balances?.current || null,
        limit: balanceAccount.balances?.limit || null,
        iso_currency_code: balanceAccount.balances?.iso_currency_code || null,
        unofficial_currency_code: balanceAccount.balances?.unofficial_currency_code || null,
        last_updated_datetime: balanceAccount.balances?.last_updated_datetime || null
      },
      item_id: balanceResponse.data.item?.item_id || null,
      request_id: balanceResponse.data.request_id,
      raw_response: balanceResponse.data
    };
  }

  /**
   * Validate credentials by creating a test link token
   */
  async validateCredentials(clientId, secret, environment) {
    const { PlaidApi, PlaidEnvironments, Configuration } = require('plaid');
    
    const plaidEnvironments = {
      'sandbox': PlaidEnvironments.sandbox
    };

    const testConfig = new Configuration({
      basePath: plaidEnvironments[environment],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    });

    const testClient = new PlaidApi(testConfig);

    // Try creating a link token to validate credentials
    await testClient.linkTokenCreate({
      user: { client_user_id: 'validation-test-' + Date.now() },
      client_name: 'Plaid Test Kit - Validation',
      products: ['auth'],
      country_codes: ['US'],
      language: 'en'
    });

    return true; // If we get here, credentials are valid
  }

  /**
   * Validate access token by making a simple API call
   */
  async validateAccessToken(accessToken) {
    await this.client.accountsGet({
      access_token: accessToken,
    });
    return true; // If we get here, token is valid
  }
}

module.exports = PlaidService;