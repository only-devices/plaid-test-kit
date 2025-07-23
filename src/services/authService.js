// src/services/authService.js
const { encryptCredentials, decryptCredentials } = require('../utils/crypto');
const PlaidService = require('./plaidService');

class AuthService {
  /**
   * Validate Plaid credentials
   */
  static async validateCredentials(clientId, secret, environment) {
    // Create a temporary request object for PlaidService
    const tempReq = {
      plaidClientId: clientId,
      plaidSecret: secret,
      plaidEnvironment: environment
    };

    const plaidService = new PlaidService(tempReq);
    return await plaidService.validateCredentials(clientId, secret, environment);
  }

  /**
   * Store credentials securely in session and optionally in cookies
   */
  static storeCredentials(req, res, credentials, remember = false) {
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

    console.log(`User authenticated successfully with ${credentials.environment} environment`);
  }

  /**
   * Get credentials from session or cookies
   */
  static getCredentials(req) {
    const encryptedCreds = req.session?.plaidCredentials || req.cookies?.plaidCredentials;
    
    if (!encryptedCreds) {
      return null;
    }

    try {
      return decryptCredentials(encryptedCreds);
    } catch (error) {
      console.error('Failed to decrypt credentials:', error.message);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(req) {
    return !!(req.plaidClientId && req.plaidSecret);
  }

  /**
   * Get current authentication status
   */
  static getAuthStatus(req) {
    const hasSession = !!req.session?.plaidCredentials;
    const hasCookie = !!req.cookies?.plaidCredentials;
    const isAuthenticated = this.isAuthenticated(req);

    return {
      authenticated: isAuthenticated,
      has_session: hasSession,
      has_cookie: hasCookie,
      environment: req.plaidEnvironment || 'unknown',
      client_id_present: !!req.plaidClientId,
      will_redirect: !isAuthenticated
    };
  }

  /**
   * Logout user by clearing session and cookies
   */
  static logout(req, res) {
    // Complete cleanup
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });
    }

    // Clear all possible cookies
    res.clearCookie('plaidCredentials');
    res.clearCookie('connect.sid'); // Default session cookie

    console.log('User logged out, credentials cleared');
  }

  /**
   * Force reauthentication by clearing all stored data
   */
  static forceReauth(req, res) {
    this.logout(req, res);
    console.log('Forced reauthentication requested');
  }

  /**
   * Restore credentials from cookie to session
   */
  static restoreCredentialsToSession(req) {
    if (!req.session?.plaidCredentials && req.cookies?.plaidCredentials) {
      req.session.plaidCredentials = req.cookies.plaidCredentials;
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
  }

  /**
   * Validate and set credentials in request object
   */
  static setRequestCredentials(req, encryptedCreds) {
    try {
      const credentials = decryptCredentials(encryptedCreds);

      // Ensure we have both required credentials
      if (!credentials.clientId || !credentials.secret) {
        throw new Error('Incomplete credentials');
      }

      // Store decrypted credentials for this request
      req.plaidClientId = credentials.clientId;
      req.plaidSecret = credentials.secret;
      req.plaidEnvironment = credentials.environment || 'sandbox';

      return true;
    } catch (error) {
      console.error('Failed to set request credentials:', error.message);
      return false;
    }
  }

  /**
   * Handle authentication errors
   */
  static handleAuthError(req, res, error, redirectPath = '/auth') {
    console.log(`❌ Authentication error: ${error.message}`);

    // Clean up corrupted data
    this.logout(req, res);

    if (req.accepts('html')) {
      return res.redirect(`${redirectPath}?error=session_invalid`);
    }
    return res.status(401).json({ error: 'Session invalid, please re-authenticate' });
  }

  /**
   * Generate auth page HTML with error handling
   */
  static generateAuthPageHTML(error = null) {
    const { getErrorMessage } = require('../utils/errors');
    
    return `
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
            <input type="text" name="clientId" id="clientId" autocomplete="clientID" placeholder="Enter your Plaid Client ID" 
                   required 
                   style="font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 14px;">
          </div>
          
          <div class="form-group">
            <label>Plaid Secret:</label>
            <input type="password" name="secret" id="secret" autocomplete="secret" placeholder="Enter your Plaid Secret" 
                   required autocomplete="new-password"
                   style="font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 14px;">
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
    `;
  }
}

module.exports = AuthService;