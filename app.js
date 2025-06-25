// app.js
require('dotenv').config();
const express = require('express');
const { PlaidApi, PlaidEnvironments, Configuration, CountryCode } = require('plaid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving with proper MIME types
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Plaid configuration
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments.sandbox, // Using sandbox environment
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfig);

// Store access token (in production, use proper database/session storage)
let accessToken = null;

// Store custom link token configuration
let customLinkConfig = null;

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/identity-tester.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'identity-tester.html'));
});

app.get('/auth-tester.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth-tester.html'));
});

app.get('/link-config.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'link-config.html'));
});

// Create link token for Plaid Link with custom configuration support
app.post('/api/create-link-token', async (req, res) => {
  try {
    const { 
      update_mode, 
      access_token, 
      custom_config,
      ...requestOverrides 
    } = req.body;
    
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
      // Merge custom config, preserving user.client_user_id if not specified
      const userClientId = linkTokenConfig.user.client_user_id;
      linkTokenConfig = { ...linkTokenConfig, ...custom_config };
      
      // Ensure user object exists and preserve client_user_id if not overridden
      if (!linkTokenConfig.user) {
        linkTokenConfig.user = { client_user_id: userClientId };
      } else if (!linkTokenConfig.user.client_user_id) {
        linkTokenConfig.user.client_user_id = userClientId;
      }
    }

    // Apply any request-level overrides
    linkTokenConfig = { ...linkTokenConfig, ...requestOverrides };

    // Add OAuth redirect URI for OAuth support
    linkTokenConfig.redirect_uri = `http://localhost:${PORT}/oauth-redirect`;

    // Handle update mode
    if (update_mode && access_token) {
      linkTokenConfig.access_token = access_token;
      linkTokenConfig.update = {
        account_selection_enabled: true
      };
    }

    console.log('Creating link token with config:', JSON.stringify(linkTokenConfig, null, 2));

    const response = await plaidClient.linkTokenCreate(linkTokenConfig);
    
    res.json({
      success: true,
      link_token: response.data.link_token,
      configuration_used: linkTokenConfig
    });
  } catch (error) {
    console.error('Link token creation error:', error);
    res.status(500).json({
      error: 'Failed to create link token',
      details: error.response?.data || error.message
    });
  }
});

// Set custom link token configuration
app.post('/api/set-link-config', async (req, res) => {
  try {
    const { config } = req.body;
    
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Valid configuration object is required' });
    }

    // Validate required fields
    const requiredFields = ['client_name', 'products', 'country_codes'];
    const missingFields = requiredFields.filter(field => !config[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Validate products array
    if (!Array.isArray(config.products) || config.products.length === 0) {
      return res.status(400).json({ 
        error: 'Products must be a non-empty array' 
      });
    }

    // Validate country codes
    if (!Array.isArray(config.country_codes) || config.country_codes.length === 0) {
      return res.status(400).json({ 
        error: 'Country codes must be a non-empty array' 
      });
    }

    customLinkConfig = config;
    
    res.json({ 
      success: true, 
      message: 'Link token configuration saved successfully',
      config: customLinkConfig
    });
  } catch (error) {
    console.error('Set link config error:', error);
    res.status(500).json({ 
      error: 'Failed to set link configuration', 
      details: error.message 
    });
  }
});

// Get current link token configuration
app.get('/api/get-link-config', async (req, res) => {
  try {
    res.json({ 
      success: true, 
      config: customLinkConfig || null,
      has_custom_config: !!customLinkConfig
    });
  } catch (error) {
    console.error('Get link config error:', error);
    res.status(500).json({ 
      error: 'Failed to get link configuration', 
      details: error.message 
    });
  }
});

// Clear custom link token configuration
app.post('/api/clear-link-config', async (req, res) => {
  try {
    customLinkConfig = null;
    
    res.json({ 
      success: true, 
      message: 'Link token configuration cleared successfully'
    });
  } catch (error) {
    console.error('Clear link config error:', error);
    res.status(500).json({ 
      error: 'Failed to clear link configuration', 
      details: error.message 
    });
  }
});

// OAuth redirect handler
app.get('/oauth-redirect', async (req, res) => {
  try {
    const { oauth_state_id, institution_id } = req.query;
    
    console.log('OAuth redirect received:', {
      oauth_state_id,
      institution_id,
      query: req.query
    });
    
    // Return a simple page that will be handled by Link
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Redirect</title>
      </head>
      <body>
        <script>
          // This script allows Plaid Link to handle the OAuth redirect
          if (window.opener) {
            // Send message to parent window (Link)
            window.opener.postMessage({
              type: 'plaid_oauth_redirect',
              url: window.location.href
            }, '*');
            window.close();
          } else {
            // Fallback if no opener (shouldn't happen in normal flow)
            document.body.innerHTML = '<h3>OAuth flow completed. Please return to the application.</h3>';
          }
        </script>
        <h3>Processing OAuth response...</h3>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth redirect error:', error);
    res.status(500).send('OAuth redirect failed');
  }
});

// Exchange public_token for access_token
app.post('/api/exchange-token', async (req, res) => {
  try {
    const { public_token } = req.body;
    
    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    accessToken = response.data.access_token;
    
    res.json({ 
      success: true, 
      message: 'Token exchanged successfully',
      item_id: response.data.item_id,
      access_token: accessToken
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ 
      error: 'Failed to exchange token', 
      details: error.response?.data || error.message 
    });
  }
});

// Set access token directly
app.post('/api/set-token', async (req, res) => {
  try {
    const { access_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({ error: 'access_token is required' });
    }

    // Test the token by making a simple API call
    try {
      await plaidClient.accountsGet({
        access_token: access_token,
      });
      
      accessToken = access_token;
      
      res.json({ 
        success: true, 
        message: 'Access token set successfully',
        access_token: accessToken
      });
    } catch (tokenError) {
      res.status(400).json({ 
        error: 'Invalid access token', 
        details: tokenError.response?.data || tokenError.message 
      });
    }
  } catch (error) {
    console.error('Set token error:', error);
    res.status(500).json({ 
      error: 'Failed to set token', 
      details: error.response?.data || error.message 
    });
  }
});

// Get available accounts for selection
app.post('/api/get-accounts', async (req, res) => {
  try {
    if (!accessToken) {
      return res.status(400).json({ error: 'No access token available. Please exchange a public token first.' });
    }

    const response = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accounts = response.data.accounts.map((account, index) => ({
      account_id: account.account_id,
      name: account.name,
      official_name: account.official_name,
      type: account.type,
      subtype: account.subtype,
      mask: account.mask,
      index: index
    }));

    res.json({
      success: true,
      accounts: accounts
    });

  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ 
      error: 'Failed to get accounts', 
      details: error.response?.data || error.message 
    });
  }
});

// Test Identity endpoints
app.post('/api/test-identity', async (req, res) => {
  try {
    if (!accessToken) {
      return res.status(400).json({ error: 'No access token available. Please exchange a public token first.' });
    }

    const { name, email, phone, address, account_index } = req.body;

    // First, get all accounts to find the selected account ID
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    if (!accountsResponse.data.accounts || accountsResponse.data.accounts.length === 0) {
      throw new Error('No accounts found');
    }

    // Use the selected account index, default to 0 if not provided
    const selectedIndex = account_index !== undefined ? parseInt(account_index) : 0;
    
    if (selectedIndex >= accountsResponse.data.accounts.length) {
      throw new Error(`Selected account index ${selectedIndex} is out of range`);
    }

    const selectedAccount = accountsResponse.data.accounts[selectedIndex];
    const selectedAccountId = selectedAccount.account_id;

    // Prepare user data for matching
    const userData = {
      legal_name: name,
      email_address: email,
      phone_number: phone,
      address: {
        street: address.street,
        city: address.city,
        region: address.state,
        postal_code: address.zip,
        country: address.country || 'US'
      }
    };

    // Call both endpoints with account filtering
    const [getResponse, matchResponse] = await Promise.all([
      // Get identity data for specific account
      plaidClient.identityGet({
        access_token: accessToken,
        options: {
          account_ids: [selectedAccountId]
        }
      }),
      
      // Match identity data for specific account
      plaidClient.identityMatch({
        access_token: accessToken,
        user: userData,
        options: {
          account_ids: [selectedAccountId]
        }
      })
    ]);

    // Check if accounts exist in responses
    if (!getResponse.data.accounts || getResponse.data.accounts.length === 0) {
      throw new Error('No accounts found in identity/get response');
    }

    if (!matchResponse.data.accounts || matchResponse.data.accounts.length === 0) {
      throw new Error('No accounts found in identity/match response');
    }

    // Since we filtered by account ID, we should only have one account in each response
    const identityAccount = getResponse.data.accounts[0];
    const matchData = matchResponse.data.accounts[0];
    const identityData = identityAccount?.owners?.[0] || {};

    res.json({
      success: true,
      selected_account: {
        index: selectedIndex,
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
      }
    });

  } catch (error) {
    console.error('Identity API error:', error);
    res.status(500).json({ 
      error: 'Failed to test identity endpoints', 
      details: error.response?.data || error.message 
    });
  }
});

// Test Auth endpoints
app.post('/api/test-auth', async (req, res) => {
  try {
    if (!accessToken) {
      return res.status(400).json({ error: 'No access token available. Please exchange a public token first.' });
    }

    const { account_index } = req.body;

    // First, get all accounts to find the selected account ID
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    if (!accountsResponse.data.accounts || accountsResponse.data.accounts.length === 0) {
      throw new Error('No accounts found');
    }

    // Use the selected account index, default to 0 if not provided
    const selectedIndex = account_index !== undefined ? parseInt(account_index) : 0;
    
    if (selectedIndex >= accountsResponse.data.accounts.length) {
      throw new Error(`Selected account index ${selectedIndex} is out of range`);
    }

    const selectedAccount = accountsResponse.data.accounts[selectedIndex];
    const selectedAccountId = selectedAccount.account_id;

    // Call Auth API with account filtering
    const authResponse = await plaidClient.authGet({
      access_token: accessToken,
      options: {
        account_ids: [selectedAccountId]
      }
    });

    // Check if accounts exist in response
    if (!authResponse.data.accounts || authResponse.data.accounts.length === 0) {
      throw new Error('No accounts found in auth/get response');
    }
    // TODO: Improve account type handling based on country code
    const authAccountType = 'ach';
    /*if (config.country_codes == 'us') {
      authAccountType = 'ach';
    }*/
    // Since we filtered by account ID, we should only have one account
    const authAccount = authResponse.data.accounts[0];
    const authData = authResponse.data.numbers || {};

    res.json({
      success: true,
      selected_account: {
        index: selectedIndex,
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
      // Include full Plaid API response for display on-screen
      raw_response: authResponse.data
    });

  } catch (error) {
    console.error('Auth API error:', error);
    res.status(500).json({ 
      error: 'Failed to test auth endpoint', 
      details: error.response?.data || error.message 
    });
  }
});

// Clear access token
app.post('/api/clear-token', async (req, res) => {
  try {
    accessToken = null;
    
    res.json({ 
      success: true, 
      message: 'Access token cleared successfully'
    });
  } catch (error) {
    console.error('Clear token error:', error);
    res.status(500).json({ 
      error: 'Failed to clear token', 
      details: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  console.log('Health check - accessToken exists:', !!accessToken, 'Value:', accessToken ? 'present' : 'null');
  
  res.json({ 
    status: 'OK', 
    hasAccessToken: !!accessToken,
    access_token: accessToken || null,
    has_custom_link_config: !!customLinkConfig,
    custom_link_config: customLinkConfig || null,
    environment: 'sandbox',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Plaid Test Kit running on http://localhost:${PORT}`);
  console.log('OAuth redirect URI configured for:', `http://localhost:${PORT}/oauth-redirect`);
  console.log('Make sure to set PLAID_CLIENT_ID and PLAID_SECRET environment variables');
  console.log('');
  console.log('Available routes:');
  console.log('  GET  /                      - Start page (Link selection)');
  console.log('  GET  /identity-tester.html  - Identity API testing page');
  console.log('  GET  /auth-tester.html      - Auth API testing page');
  console.log('  GET  /link-config.html      - Link token configuration page');
  console.log('  POST /api/create-link-token - Create Link token');
  console.log('  POST /api/exchange-token    - Exchange public token');
  console.log('  POST /api/set-token         - Set access token directly');
  console.log('  POST /api/clear-token       - Clear access token');
  console.log('  POST /api/set-link-config   - Set custom Link configuration');
  console.log('  GET  /api/get-link-config   - Get current Link configuration');
  console.log('  POST /api/clear-link-config - Clear Link configuration');
  console.log('  POST /api/get-accounts      - Get available accounts');
  console.log('  POST /api/test-identity     - Test Identity APIs');
  console.log('  POST /api/test-auth         - Test Auth API');
  console.log('  GET  /health               - Health check');
});