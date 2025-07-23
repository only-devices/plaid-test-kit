// src/storage/itemStore.js
const NodeCache = require('node-cache');

// Create itemStore with 24h TTL and hourly cleanup
const itemStore = new NodeCache({ stdTTL: 24 * 60 * 60, checkperiod: 3600 });

// Create testing itemStore
function seedItemStore() {
  if (process.env.NODE_ENV !== 'development') return;

  const testItemId = process.env.TEST_ITEM_ID || 'ZndmkWwDbvhEM1rZpeAgFLmLEX6mMWFgnWP3K';
  const testClientId = process.env.TEST_CLIENT_ID || 'your-client-id-here';
  const testSecret = process.env.TEST_SECRET || 'your-secret-here';
  const testEnv = process.env.TEST_ENV || 'sandbox';

  itemStore.set(testItemId, {
    clientId: testClientId,
    secret: testSecret,
    environment: testEnv
  });

  console.log(`🧪 itemStore seeded with test item_id: ${testItemId}`);
}

// Initialize store
seedItemStore();

// Make itemStore globally available for backward compatibility
global.itemStore = itemStore;

module.exports = {
  itemStore,
  seedItemStore
};