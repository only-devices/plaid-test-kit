// app.js
require('dotenv').config();
const express = require('express');
const { PlaidApi, PlaidEnvironments, Configuration, CountryCode } = require('plaid');

// 🔐 NEW: Security middleware dependencies
const session = require('express-session');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Railway-specific HOST configuration
// In production (Railway), use the provided domain without port
// In development, use localhost with port
const getBaseUrl = () => {
  if (process.env.RAILWAY_ENVIRONMENT) {
    // Railway sets this environment variable
    console.log('Railway environment detected, setting base URL accordingly');
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL}`;
  } else {
    // Development
    const HOST = process.env.HOST || 'localhost';
    return `http://${HOST}:${PORT}`;
  }
};

const BASE_URL = getBaseUrl();
console.log(`🌍 Base URL configured as: ${BASE_URL}`);

// Check for required environment variables
if (!process.env.SESSION_SECRET) {
  console.error('❌ FATAL ERROR: SESSION_SECRET environment variable is required for security');
  console.error('   Generate one with: openssl rand -base64 32');
  console.error('   Then set it in your environment or .env file');
  process.exit(1);
}

// 1. BASIC MIDDLEWARE
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Enhanced session configuration with debugging
const sessionConfig = {
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Reset expiration on activity
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax'
  },
  name: 'plaid-test-kit-session'
};

// Use FileStore in production, MemoryStore in development
if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
  const FileStore = require('session-file-store')(session);
  sessionConfig.store = new FileStore({
    path: path.join(__dirname, 'sessions'),
    ttl: 86400, // 24 hours in seconds
    retries: 0,
    logFn: function () { }, // Disable file store logging
    // Automatic cleanup options
    reapInterval: 3600, // Clean up every hour (in seconds)
    reapAsync: true,    // Don't block the event loop during cleanup
    reapSyncFallback: false // Disable sync fallback for better performance
  });
  console.log('📁 Using FileStore for sessions (production)');
} else {
  console.log('🧠 Using MemoryStore for sessions (development)');
}

app.use(session(sessionConfig));

// 2. UTILITY FUNCTIONS
// 🔐 FIXED: Modern encryption utilities for storing credentials securely
const crypto = require('crypto');
const fs = require('fs');

// Generate a consistent encryption key from your ENCRYPTION_KEY env var
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY || 'default-key-change-this-in-production';
  // Create a 32-byte key from the environment variable
  return crypto.createHash('sha256').update(key).digest();
}

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16

function encryptCredentials(credentials) {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

    let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV + encrypted data (separated by :)
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt credentials');
  }
}

function decryptCredentials(encryptedData) {
  try {
    const textParts = encryptedData.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = textParts.join(':');

    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt credentials - session may be corrupted');
  }
}

// Helper function for error messages
function getErrorMessage(error) {
  const messages = {
    'invalid': 'Invalid credentials or authentication failed',
    'session_invalid': 'Session expired or corrupted. Please login again.',
    'validation_failed': 'Unable to validate credentials with Plaid servers',
    'format_error': 'Credential format is incorrect'
  };
  return messages[error] || 'Authentication failed';
}

// 🔐 UPDATED: Dynamic Plaid client creation with user's credentials
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

// 🚀 NEW: Navbar generation function
function generateNavbar(config = {}) {
  const {
    title = 'Test Kit',
    subtitle = 'Welcome. Now go and test all the things!',
    activeItem = 'home',
    logoSrc = '/assets/symbol-holo.png'
  } = config;

  const navItems = [
    { href: '/', text: 'Home', id: 'home' },
    { href: '/link-config.html', text: 'Link Config', id: 'link-config' },
    { href: '/auth-tester.html', text: 'Auth', id: 'auth' },
    { href: '/identity-tester.html', text: 'Identity', id: 'identity' },
    { href: '/balance-tester.html', text: 'Balance', id: 'balance' }
  ];

  const navItemsHTML = navItems.map(item => {
    const activeClass = item.id === activeItem ? ' active' : '';
    return `<a href="${item.href}" class="nav-link${activeClass}">${item.text}</a>`;
  }).join('');

  return `
    <div class="navbar" id="appNavbar">
      <a href="/" class="navbar-brand">
        <img src="${logoSrc}" alt="Plaid logo">
        <div>
          <div class="navbar-title">${title}</div>
          <div class="navbar-subtitle">${subtitle}</div>
        </div>
      </a>
      <nav class="navbar-nav" id="navbarItems">
        ${navItemsHTML}
        <button class="nav-link nav-logout" onclick="UIUtils.logout()">
          Logout
        </button>
      </nav>
    </div>
  `;
}

// 🚀 NEW: Enhanced page serving with navbar injection
function sendPageWithNavbar(res, filePath, navbarConfig = {}) {
  try {
    // Read the HTML file
    let htmlContent = fs.readFileSync(filePath, 'utf8');

    // Generate navbar HTML
    const navbarHTML = generateNavbar(navbarConfig);

    // Insert navbar after <body> tag
    htmlContent = htmlContent.replace(
      /<body[^>]*>/i,
      `$&\n    ${navbarHTML}`
    );

    res.send(htmlContent);
  } catch (error) {
    console.error('Error serving page with navbar:', error);
    res.status(500).send('Internal Server Error');
  }
}

// 3. SECURITY MIDDLEWARE
// Enhanced validateApiKey middleware with debugging
const validateApiKey = (req, res, next) => {
  // Skip validation for static assets and auth endpoints
  if (req.path.includes('/css/') ||
    req.path.includes('/js/') ||
    req.path.includes('/assets/') ||
    req.path === '/auth' ||
    req.path === '/api/validate-key' ||
    req.path === '/api/logout') {
    return next();
  }

  console.log(`🔍 Validating access to ${req.path}`);
  console.log(`   Session ID: ${req.sessionID || 'none'}`);
  console.log(`   Session exists: ${!!req.session}`);
  console.log(`   Session has credentials: ${!!req.session?.plaidCredentials}`);
  console.log(`   Cookie has credentials: ${!!req.cookies?.plaidCredentials}`);

  // Check for encrypted credentials in session OR cookies
  const encryptedCreds = req.session?.plaidCredentials || req.cookies?.plaidCredentials;

  // 🔐 FORCE REDIRECT: No valid credentials found
  if (!encryptedCreds) {
    console.log(`❌ Access denied to ${req.path} - no credentials found, redirecting to /auth`);

    if (req.accepts('html')) {
      return res.redirect('/auth');
    }
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Decrypt and validate credentials
    const credentials = decryptCredentials(encryptedCreds);

    // Ensure we have both required credentials
    if (!credentials.clientId || !credentials.secret) {
      throw new Error('Incomplete credentials');
    }

    // Store decrypted credentials for this request
    req.plaidClientId = credentials.clientId;
    req.plaidSecret = credentials.secret;
    req.plaidEnvironment = credentials.environment || 'sandbox';

    // If credentials came from cookie but not session, restore to session
    if (!req.session?.plaidCredentials && req.cookies?.plaidCredentials) {
      req.session.plaidCredentials = encryptedCreds;
      console.log('✅ Restored credentials from cookie to session');

      // Save session explicitly
      req.session.save((err) => {
        if (err) {
          console.error('❌ Failed to save session:', err);
        } else {
          console.log('✅ Session saved successfully');
        }
      });
    }

    console.log(`✅ Access granted to ${req.path}`);
    next();

  } catch (error) {
    // 🔐 FORCE REDIRECT: Invalid or corrupted credentials
    console.log(`❌ Access denied to ${req.path} - invalid credentials:`, error.message);

    // Clean up corrupted data
    if (req.session) {
      req.session.destroy((err) => {
        if (err) console.error('Session destruction error:', err);
      });
    }
    res.clearCookie('plaidCredentials');

    if (req.accepts('html')) {
      return res.redirect('/auth?error=session_invalid');
    }
    return res.status(401).json({ error: 'Session invalid, please re-authenticate' });
  }
};

app.use(validateApiKey);

// 4. AUTH ROUTES (before static files)
// 🔐 UPDATED: More secure auth page with better UX
app.get('/auth', (req, res) => {
  const error = req.query.error;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Plaid Test Kit - Secure Authentication</title>
      <link rel="stylesheet" href="/css/styles.css">
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
      <div class="card" style="max-width: 600px; margin: 50px auto;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1>🧪 Plaid Test Kit</h1>
          <p style="color: #64748b;">Enter your Plaid API credentials below to get started</p>
        </div>
        
        <div style="margin-top: 24px; padding: 16px; background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; font-size: 13px;">
          <div style="color: #0369a1; margin-bottom: 8px;"><strong>🛡️ Security Features:</strong></div>
          <ul style="margin: 0; padding-left: 16px; color: #0369a1; line-height: 1.6;">
            <li><strong>Encrypted Storage:</strong> Credentials are encrypted using AES-256</li>
            <li><strong>Validation:</strong> Keys are verified against Plaid servers before storage</li>
            <li><strong>Session Security:</strong> Data is tied to your browser session only</li>
            <li><strong>Auto-Expire:</strong> Credentials automatically expire after 24 hours</li>
            <li><strong>Zero Persistence:</strong> No long-term storage of your credentials</li>
          </ul>
        </div>
        <br>
        
        ${error ? `<div class="status status-error">
          ${getErrorMessage(error)}
        </div>` : ''}
        
        <form method="POST" action="/api/validate-key" id="authForm">
          <div class="form-group">
            <label>Plaid Client ID:</label>
            <input type="text" name="clientId" id="clientId" placeholder="Enter your Plaid Client ID" 
                   required 
                   style="font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 14px;">
            <small style="color: #666; font-size: 12px;">24-character hexadecimal string</small>
          </div>
          
          <div class="form-group">
            <label>Plaid Secret:</label>
            <input type="password" name="secret" id="secret" placeholder="Enter your Plaid Secret" 
                   required autocomplete="new-password"
                   style="font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 14px;">
            <small style="color: #666; font-size: 12px;">40-character hexadecimal string</small>
          </div>
          
          <div class="form-group">
            <label>Environment:</label>
            <select name="environment" required style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <option value="sandbox">Sandbox</option>
            </select>
            <small style="color: #666; font-size: 12px;">Choose your Plaid environment</small>
          </div>
          
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; text-transform: none; letter-spacing: normal;">
              <input type="checkbox" name="remember" value="1"> 
              Remember credentials for this session (24 hours max)
            </label>
          </div>
          
          <button type="submit" class="btn btn-primary btn-full" id="submitBtn">
            🔐 Access the Test Kit
          </button>
        </form>
        
        <div style="margin-top: 16px; padding: 16px; background: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; font-size: 13px;">
          <div style="color: #991b1b; margin-bottom: 8px;"><strong>⚠️ Important Security Notes:</strong></div>
          <ul style="margin: 0; padding-left: 16px; color: #991b1b; line-height: 1.6;">
            <li>Only Plaid Sandbox environment and credentials are currently supported</li>
            <li>This tool does not store your credentials permanently</li>
            <li>Use the logout button to clear session data stored in your browser</li>
          </ul>
        </div>
      </div>
      
      <script>
        // Add visual feedback during form submission
        document.getElementById('authForm').addEventListener('submit', function() {
          const submitBtn = document.getElementById('submitBtn');
          submitBtn.textContent = '🔄 Validating credentials...';
          submitBtn.disabled = true;
        });
        
        // Auto-format credential inputs
        function formatHexInput(input, expectedLength) {
          input.addEventListener('input', function() {
            // Remove any non-hex characters
            this.value = this.value.replace(/[^a-f0-9]/gi, '').toLowerCase();
            
            // Visual feedback for length
            if (this.value.length === expectedLength) {
              this.style.borderColor = '#10b981';
              this.style.backgroundColor = '#f0fdf4';
            } else {
              this.style.borderColor = '#e2e8f0';
              this.style.backgroundColor = '#ffffff';
            }
          });
        }
        
        formatHexInput(document.getElementById('clientId'), 24);
        formatHexInput(document.getElementById('secret'), 40);
      </script>
    </body>
    </html>
  `);
});

app.post('/api/validate-key', async (req, res) => {
  const { clientId, secret, environment, remember } = req.body;

  try {
    // Map environment to Plaid environment
    const plaidEnvironments = {
      'sandbox': PlaidEnvironments.sandbox
    };

    // Test the credentials by making a minimal Plaid API call
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

    // If we get here, credentials are valid
    const credentials = { clientId, secret, environment };
    const encryptedCreds = encryptCredentials(credentials);

    // Store encrypted credentials in session
    req.session.plaidCredentials = encryptedCreds;

    // Optionally store in cookie for persistence
    if (remember) {
      res.cookie('plaidCredentials', encryptedCreds, {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
    }

    console.log(`User authenticated successfully with ${environment} environment`);
    res.redirect('/');

  } catch (error) {
    console.error('Credential validation failed:', error.response?.data || error.message);
    res.redirect('/auth?error=validation_failed');
  }
});

// 🔐 ENHANCED: Logout with better cleanup and redirect options
app.post('/api/logout', (req, res) => {
  const returnUrl = req.body.returnUrl || req.query.returnUrl || '/auth';

  // Complete cleanup
  req.session?.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
  });

  // Clear all possible cookies
  res.clearCookie('plaidCredentials');
  res.clearCookie('connect.sid'); // Default session cookie

  console.log('User logged out, credentials cleared');

  if (req.accepts('html')) {
    res.redirect(`${returnUrl}?message=logged_out`);
  } else {
    res.json({ success: true, message: 'Logged out successfully', redirect: returnUrl });
  }
});

// 5. PAGE ROUTES with navbar injection (before static files)
app.get('/', (req, res) => {
  sendPageWithNavbar(res, path.join(__dirname, 'public', 'index.html'), {
    title: 'Test Kit',
    subtitle: 'Welcome. Now go and test all the things!',
    activeItem: 'home'
  });
});

app.get('/identity-tester.html', (req, res) => {
  sendPageWithNavbar(res, path.join(__dirname, 'public', 'identity-tester.html'), {
    title: 'Identity',
    subtitle: 'Test the /identity/get and /identity/match endpoints',
    activeItem: 'identity'
  });
});

app.get('/auth-tester.html', (req, res) => {
  sendPageWithNavbar(res, path.join(__dirname, 'public', 'auth-tester.html'), {
    title: 'Auth',
    subtitle: 'Test the /auth/get endpoint',
    activeItem: 'auth'
  });
});

app.get('/balance-tester.html', (req, res) => {
  sendPageWithNavbar(res, path.join(__dirname, 'public', 'balance-tester.html'), {
    title: 'Balance',
    subtitle: 'Test the /accounts/balance/get endpoint',
    activeItem: 'balance'
  });
});

app.get('/link-config.html', (req, res) => {
  sendPageWithNavbar(res, path.join(__dirname, 'public', 'link-config.html'), {
    title: 'Link Configuration',
    subtitle: 'Customize Link token parameters',
    activeItem: 'link-config'
  });
});

// 6. OTHER GET ROUTES (OAuth, hosted link, etc.)
// Helper endpoint to return BASE_URL variable
app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.BASE_URL = "${process.env.BASE_URL || `http://localhost:${PORT}`}"`);
});

// Hosted Link completion handler
app.get('/hosted-link-complete', async (req, res) => {
  try {
    console.log('Hosted Link completion received');

    // Return a simple page that will handle the completion
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Link Complete</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            text-align: center; 
            padding: 40px; 
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          }
          .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .spinner {
            display: inline-block;
            animation: spin 1s linear infinite;
            font-size: 24px;
            margin-bottom: 16px;
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner">⟳</div>
          <h3>Processing your connection...</h3>
          <p>Please wait while we finalize your bank connection.</p>
          <p><small>You will be redirected automatically.</small></p>
        </div>
        <script>
          // Auto-redirect to main page after a short delay
          setTimeout(() => {
            window.location.href = '/?hosted_complete=true';
          }, 2000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Hosted Link completion error:', error);
    res.status(500).send('Hosted Link completion failed');
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

// 🔐 OPTIONAL: Add a route to manually check auth status
app.get('/api/auth-status', (req, res) => {
  const hasSession = !!req.session?.plaidCredentials;
  const hasCookie = !!req.cookies?.plaidCredentials;
  const isAuthenticated = !!(req.plaidClientId && req.plaidSecret);

  res.json({
    authenticated: isAuthenticated,
    has_session: hasSession,
    has_cookie: hasCookie,
    environment: req.plaidEnvironment || 'unknown',
    client_id_present: !!req.plaidClientId,
    will_redirect: !isAuthenticated
  });
});

// 🔐 ENHANCED: Add route to force re-authentication
app.post('/api/force-reauth', (req, res) => {
  req.session?.destroy();
  res.clearCookie('plaidCredentials');

  if (req.accepts('html')) {
    res.redirect('/auth?message=reauth_requested');
  } else {
    res.json({ success: true, message: 'Please re-authenticate' });
  }
});

// 🔐 OPTIONAL: Add a "login required" page for better UX
app.get('/login-required', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login Required - Plaid Test Kit</title>
      <link rel="stylesheet" href="/css/styles.css">
    </head>
    <body>
      <div class="card" style="max-width: 500px; margin: 100px auto; text-align: center;">
        <h2>🔐 Authentication Required</h2>
        <p>You need to be logged in to access this page.</p>
        <a href="/auth" class="btn btn-primary">Login with Plaid Credentials</a>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
          Your session may have expired or you haven't logged in yet.
        </p>
      </div>
    </body>
    </html>
  `);
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

// 7. STATIC FILES LAST (after all GET routes)
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Store access token (in production, use proper database/session storage)
let accessToken = null;

// Store custom link token configuration
let customLinkConfig = null;

// 8. API POST ROUTES (order doesn't matter for these)
// Create link token for Plaid Link with custom configuration support
app.post('/api/create-link-token', async (req, res) => {
  try {
    const plaidClient = createPlaidClient(req);

    const {
      update_mode,
      access_token,
      custom_config,
      hosted_link,
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
    linkTokenConfig.redirect_uri = `${BASE_URL}/oauth-redirect`;

    // Handle hosted link mode
    if (hosted_link) {
      linkTokenConfig.hosted_link = hosted_link;
      // For hosted link, also set completion redirect URI to return to our app
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

    console.log('Creating link token with config:', JSON.stringify(linkTokenConfig, null, 2));

    const response = await plaidClient.linkTokenCreate(linkTokenConfig);

    res.json({
      success: true,
      link_token: response.data.link_token,
      hosted_link_url: response.data.hosted_link_url || null,
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

// Get link token details (for hosted link completion)
app.post('/api/get-link-token', async (req, res) => {
  try {
    const plaidClient = createPlaidClient(req);
    const { link_token } = req.body;

    if (!link_token) {
      return res.status(400).json({ error: 'link_token is required' });
    }

    const response = await plaidClient.linkTokenGet({
      link_token: link_token,
    });

    // Extract public token from the most recent successful session
    let publicToken = null;
    let metadata = null;

    if (response.data.link_sessions && response.data.link_sessions.length > 0) {
      // Find the most recent completed session
      const completedSessions = response.data.link_sessions
        .filter(session => session.finished_at && session.results)
        .sort((a, b) => new Date(b.finished_at) - new Date(a.finished_at));

      if (completedSessions.length > 0) {
        const latestSession = completedSessions[0];

        // Check for public token in results (preferred method)
        if (latestSession.results && latestSession.results.item_add_results && latestSession.results.item_add_results.length > 0) {
          publicToken = latestSession.results.item_add_results[0].public_token;
          metadata = {
            institution: latestSession.results.item_add_results[0].institution,
            accounts: latestSession.results.item_add_results[0].accounts,
            link_session_id: latestSession.link_session_id
          };
        }
        // Fallback to on_success object
        else if (latestSession.on_success && latestSession.on_success.public_token) {
          publicToken = latestSession.on_success.public_token;
          metadata = latestSession.on_success.metadata;
        }
      }
    }

    res.json({
      success: true,
      public_token: publicToken,
      metadata: metadata,
      link_sessions: response.data.link_sessions,
      has_completed_session: !!publicToken
    });

  } catch (error) {
    console.error('Get link token error:', error);
    res.status(500).json({
      error: 'Failed to get link token details',
      details: error.response?.data || error.message
    });
  }
});

// Exchange public_token for access_token
app.post('/api/exchange-token', async (req, res) => {
  try {
    const plaidClient = createPlaidClient(req);
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
    const plaidClient = createPlaidClient(req);
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

    const plaidClient = createPlaidClient(req);
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

    const plaidClient = createPlaidClient(req);
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
      },
      raw_response: {
        identity_get: getResponse.data,
        identity_match: matchResponse.data
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

    const plaidClient = createPlaidClient(req);
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

// Test Balance endpoints
app.post('/api/test-balance', async (req, res) => {
  try {
    if (!accessToken) {
      return res.status(400).json({ error: 'No access token available. Please exchange a public token first.' });
    }

    const plaidClient = createPlaidClient(req);
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

    // Call Balance API with account filtering
    const balanceResponse = await plaidClient.accountsBalanceGet({
      access_token: accessToken,
      options: {
        account_ids: [selectedAccountId]
      }
    });

    // Check if accounts exist in response
    if (!balanceResponse.data.accounts || balanceResponse.data.accounts.length === 0) {
      throw new Error('No accounts found in balance/get response');
    }

    // Since we filtered by account ID, we should only have one account
    const balanceAccount = balanceResponse.data.accounts[0];

    res.json({
      success: true,
      selected_account: {
        index: selectedIndex,
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
      // Include full Plaid API response for display on-screen
      raw_response: balanceResponse.data
    });

  } catch (error) {
    console.error('Balance API error:', error);
    res.status(500).json({
      error: 'Failed to test balance endpoint',
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

app.listen(PORT, () => {
  console.log(`🚀 Plaid Test Kit running on ${BASE_URL}`);
});