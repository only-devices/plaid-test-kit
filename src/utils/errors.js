// src/utils/errors.js

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

module.exports = {
  getErrorMessage
};