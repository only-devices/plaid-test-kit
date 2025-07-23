// src/middleware/auth.js
const { decryptCredentials } = require('../utils/crypto');

// Enhanced validateApiKey middleware with debugging
const validateApiKey = (req, res, next) => {
  // Skip validation for static assets and auth endpoints
  if (req.path.includes('/css/') ||
    req.path.includes('/js/') ||
    req.path.includes('/assets/') ||
    req.path === '/health' ||
    req.path === '/webhooks' ||
    req.path === '/auth' ||
    req.path === '/api/validate-key' ||
    req.path === '/api/logout') {
    return next();
  }

  // Check for encrypted credentials in session OR cookies
  const encryptedCreds = req.session?.plaidCredentials || req.cookies?.plaidCredentials;

  // Force redirect: No valid credentials found
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

    next();

  } catch (error) {
    // Force redirect: Invalid or corrupted credentials
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

module.exports = {
  validateApiKey
};