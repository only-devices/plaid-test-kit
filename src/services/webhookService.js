// src/services/webhookService.js
const { itemStore } = require('../storage/itemStore');

class WebhookService {
  constructor() {
    this.webhookStore = [];
    this.PLAID_ALLOWED_IPS = ['52.21.26.131', '52.21.47.157', '52.41.247.19', '52.88.82.239'];
  }

  /**
   * Verify that the webhook is coming from a Plaid IP
   */
  verifyWebhookIP(ip) {
    const cleanIP = ip.replace('::ffff:', '');
    return this.PLAID_ALLOWED_IPS.includes(cleanIP);
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(rawBody) {
    try {
      return typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch (err) {
      throw new Error('Invalid JSON in webhook payload');
    }
  }

  /**
   * Validate webhook payload structure
   */
  validateWebhookPayload(payload) {
    if (!payload.item_id) {
      throw new Error('Missing item_id in webhook payload');
    }

    const itemInfo = itemStore.get(payload.item_id);
    if (!itemInfo) {
      throw new Error(`Unknown item_id: ${payload.item_id}`);
    }

    return itemInfo;
  }

  /**
   * Store webhook data
   */
  storeWebhook(payload, itemInfo) {
    const webhookData = {
      timestamp: new Date().toISOString(),
      webhook_type: payload.webhook_type || 'unknown',
      data: payload,
      item_id: payload.item_id,
      clientId: itemInfo.clientId,
      verified: true
    };

    this.webhookStore.push(webhookData);
    this.purgeOldWebhooks();

    return webhookData;
  }

  /**
   * Process incoming webhook
   */
  processWebhook(ip, rawBody) {
    // Verify IP
    if (!this.verifyWebhookIP(ip)) {
      const error = new Error('Unauthorized IP');
      error.status = 403;
      throw error;
    }

    // Parse payload
    const payload = this.parseWebhookPayload(rawBody);

    // Validate payload and get item info
    const itemInfo = this.validateWebhookPayload(payload);

    // Store webhook
    const webhookData = this.storeWebhook(payload, itemInfo);

    console.log(`✅ Webhook processed: ${payload.webhook_type} for item ${payload.item_id}`);

    return webhookData;
  }

  /**
   * Get all webhooks
   */
  getWebhooks() {
    this.purgeOldWebhooks();
    return this.webhookStore;
  }

  /**
   * Clear all webhooks
   */
  clearWebhooks() {
    this.webhookStore = [];
    console.log('🗑️ All webhooks cleared');
  }

  /**
   * Get webhook statistics
   */
  getWebhookStats() {
    this.purgeOldWebhooks();
    
    const total = this.webhookStore.length;
    const verified = this.webhookStore.filter(w => w.verified).length;
    const lastHour = this.webhookStore.filter(w => 
      new Date(w.timestamp) > Date.now() - 60 * 60 * 1000
    ).length;
    const uniqueTypes = new Set(this.webhookStore.map(w => w.webhook_type)).size;

    // Group by webhook type
    const typeBreakdown = {};
    this.webhookStore.forEach(webhook => {
      const type = webhook.webhook_type || 'unknown';
      typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
    });

    // Recent webhooks (last 5)
    const recentWebhooks = this.webhookStore
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5)
      .map(w => ({
        type: w.webhook_type,
        timestamp: w.timestamp,
        item_id: w.item_id,
        client_id: w.clientId
      }));

    return {
      total,
      verified,
      uniqueTypes,
      lastHour,
      typeBreakdown,
      recentWebhooks,
      oldestWebhook: this.webhookStore.length > 0 ? 
        Math.min(...this.webhookStore.map(w => new Date(w.timestamp).getTime())) : null,
      newestWebhook: this.webhookStore.length > 0 ? 
        Math.max(...this.webhookStore.map(w => new Date(w.timestamp).getTime())) : null
    };
  }

  /**
   * Get webhooks for a specific item
   */
  getWebhooksForItem(itemId) {
    this.purgeOldWebhooks();
    return this.webhookStore.filter(w => w.item_id === itemId);
  }

  /**
   * Get webhooks for a specific client
   */
  getWebhooksForClient(clientId) {
    this.purgeOldWebhooks();
    return this.webhookStore.filter(w => w.clientId === clientId);
  }

  /**
   * Get webhooks by type
   */
  getWebhooksByType(webhookType) {
    this.purgeOldWebhooks();
    return this.webhookStore.filter(w => w.webhook_type === webhookType);
  }

  /**
   * Cleanup webhooks older than 24 hours
   */
  purgeOldWebhooks() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    const initialCount = this.webhookStore.length;
    
    this.webhookStore = this.webhookStore.filter(w => 
      new Date(w.timestamp).getTime() > cutoff
    );

    const purgedCount = initialCount - this.webhookStore.length;
    if (purgedCount > 0) {
      console.log(`🧹 Purged ${purgedCount} old webhooks`);
    }
  }

  /**
   * Export webhooks as JSON
   */
  exportWebhooks(format = 'json') {
    this.purgeOldWebhooks();
    
    if (format === 'json') {
      return JSON.stringify(this.webhookStore, null, 2);
    }
    
    if (format === 'csv') {
      if (this.webhookStore.length === 0) return 'No webhooks to export';
      
      const headers = ['timestamp', 'webhook_type', 'item_id', 'clientId', 'verified'];
      const rows = this.webhookStore.map(w => [
        w.timestamp,
        w.webhook_type,
        w.item_id,
        w.clientId,
        w.verified
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    throw new Error('Unsupported export format. Use "json" or "csv".');
  }

  /**
   * Search webhooks by criteria
   */
  searchWebhooks(criteria = {}) {
    this.purgeOldWebhooks();
    
    let results = [...this.webhookStore];
    
    if (criteria.webhook_type) {
      results = results.filter(w => w.webhook_type === criteria.webhook_type);
    }
    
    if (criteria.item_id) {
      results = results.filter(w => w.item_id === criteria.item_id);
    }
    
    if (criteria.clientId) {
      results = results.filter(w => w.clientId === criteria.clientId);
    }
    
    if (criteria.after) {
      const afterDate = new Date(criteria.after);
      results = results.filter(w => new Date(w.timestamp) > afterDate);
    }
    
    if (criteria.before) {
      const beforeDate = new Date(criteria.before);
      results = results.filter(w => new Date(w.timestamp) < beforeDate);
    }
    
    if (criteria.limit) {
      results = results.slice(0, criteria.limit);
    }
    
    return results;
  }
}

// Create singleton instance
const webhookService = new WebhookService();

module.exports = webhookService;