// src/config/environment.js
require('dotenv').config();

// Railway-specific HOST configuration
const getBaseUrl = () => {
  if (process.env.RAILWAY_ENVIRONMENT) {
    // Railway sets this environment variable
    console.log('Railway environment detected, setting base URL accordingly');
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL}`;
  } else {
    // Development
    const HOST = process.env.HOST || 'localhost';
    const PORT = process.env.PORT || 3000;
    return `http://${HOST}:${PORT}`;
  }
};

const BASE_URL = getBaseUrl();
const PORT = process.env.PORT || 3000;

// Check for required environment variables
function validateEnvironment() {
  if (!process.env.SESSION_SECRET) {
    console.error('❌ FATAL ERROR: SESSION_SECRET environment variable is required for security');
    console.error('   Generate one with: openssl rand -base64 32');
    console.error('   Then set it in your environment or .env file');
    process.exit(1);
  }
}

console.log(`🌍 Base URL configured as: ${BASE_URL}`);

module.exports = {
  BASE_URL,
  PORT,
  validateEnvironment,
  getBaseUrl
};