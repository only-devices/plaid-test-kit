// src/utils/crypto.js
const crypto = require('crypto');

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

module.exports = {
  encryptCredentials,
  decryptCredentials,
  getEncryptionKey
};