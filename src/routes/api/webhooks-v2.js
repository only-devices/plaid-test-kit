// src/routes/api/webhooks-v2.js - Service-based webhook routes
const express = require('express');
const router = express.Router();
const webhookService = require('../../services/webhookService');
const { ErrorService } = require('../../services/errorService');
const ResponseUtils = require('../../utils/response');
const ValidationUtils = require('../../utils/validation');
const { rateLimiter } = require('../../middleware/rateLimiter');
const { webhook: webhookLogger } = require('../../utils/logger');

// Webhook ingestion endpoint (public)
router.post('/webhooks', rateLimiter, express.text({ type: '*/*' }), ErrorService.asyncHandler(async (req, res) => {
  const senderIP = req.ip;
  const rawBody = req.body;

  webhookLogger.info('Webhook received', { 
    ip: senderIP, 
    bodySize: rawBody?.length || 0 
  });

  try {
    const webhookData = webhookService.processWebhook(senderIP, rawBody);
    
    webhookLogger.webhook(
      webhookData.webhook_type,
      webhookData.item_id,
      true
    );

    ResponseUtils.success(res, {}, 'Webhook processed successfully');

  } catch (error) {
    webhookLogger.error('Webhook processing failed', error);
    
    // Return appropriate status code based on error
    const statusCode = error.status || 500;
    return ResponseUtils.error(res, error, statusCode);
  }
}));

// Get webhooks (auth-protected)
router.get('/api/webhooks', ErrorService.asyncHandler(async (req, res) => {
  const { 
    webhook_type, 
    item_id, 
    client_id,
    after, 
    before, 
    limit,
    page 
  } = req.query;

  // If query parameters provided, use search functionality
  if (webhook_type || item_id || client_id || after || before) {
    const criteria = {};
    
    if (webhook_type) criteria.webhook_type = webhook_type;
    if (item_id) criteria.item_id = item_id;
    if (client_id) criteria.clientId = client_id;
    if (after) criteria.after = after;
    if (before) criteria.before = before;
    if (limit) criteria.limit = parseInt(limit) || 50;

    const webhooks = webhookService.searchWebhooks(criteria);
    
    webhookLogger.debug('Webhook search performed', { 
      criteria, 
      resultCount: webhooks.length 
    });

    return ResponseUtils.success(res, { webhooks, criteria });
  }

  // Pagination support
  const { page: currentPage, limit: pageLimit } = ValidationUtils.validatePagination(req.query);
  const webhooks = webhookService.getWebhooks();
  
  // Paginate results
  const startIndex = (currentPage - 1) * pageLimit;
  const endIndex = startIndex + pageLimit;
  const paginatedWebhooks = webhooks.slice(startIndex, endIndex);

  return ResponseUtils.paginated(res, paginatedWebhooks, webhooks.length, currentPage, pageLimit);
}));

// Clear webhooks (auth-protected)
router.post('/api/webhooks/clear', ErrorService.asyncHandler(async (req, res) => {
  const beforeClear = webhookService.getWebhooks().length;
  
  webhookService.clearWebhooks();
  
  webhookLogger.info('Webhooks cleared', { 
    clearedCount: beforeClear,
    clientId: req.plaidClientId 
  });

  ResponseUtils.success(res, { cleared_count: beforeClear }, 'Webhook logs cleared');
}));

// Get webhook statistics (auth-protected)
router.get('/api/webhooks/stats', ErrorService.asyncHandler(async (req, res) => {
  const stats = webhookService.getWebhookStats();
  
  webhookLogger.debug('Webhook stats requested', { 
    totalWebhooks: stats.total 
  });

  ResponseUtils.success(res, { stats });
}));

// Get webhooks for specific item (auth-protected)
router.get('/api/webhooks/item/:item_id', ErrorService.asyncHandler(async (req, res) => {
  const { item_id } = req.params;
  
  if (!item_id) {
    throw ErrorService.createValidationError('Item ID is required');
  }

  const webhooks = webhookService.getWebhooksForItem(item_id);
  
  webhookLogger.debug('Item webhooks requested', { 
    itemId: item_id,
    webhookCount: webhooks.length 
  });

  ResponseUtils.success(res, { webhooks, item_id });
}));

// Get webhooks for current client (auth-protected)
router.get('/api/webhooks/my-webhooks', ErrorService.asyncHandler(async (req, res) => {
  const clientId = req.plaidClientId;
  
  if (!clientId) {
    throw ErrorService.createAuthError('Client ID not available');
  }

  const webhooks = webhookService.getWebhooksForClient(clientId);
  
  webhookLogger.debug('Client webhooks requested', { 
    clientId,
    webhookCount: webhooks.length 
  });

  ResponseUtils.success(res, { webhooks, client_id: clientId });
}));

// Get webhooks by type (auth-protected)
router.get('/api/webhooks/type/:webhook_type', ErrorService.asyncHandler(async (req, res) => {
  const { webhook_type } = req.params;
  
  if (!webhook_type) {
    throw ErrorService.createValidationError('Webhook type is required');
  }

  const webhooks = webhookService.getWebhooksByType(webhook_type);
  
  webhookLogger.debug('Webhook type filter requested', { 
    webhookType: webhook_type,
    webhookCount: webhooks.length 
  });

  ResponseUtils.success(res, { webhooks, webhook_type });
}));

// Export webhooks (auth-protected)
router.get('/api/webhooks/export', ErrorService.asyncHandler(async (req, res) => {
  const { format = 'json' } = req.query;

  if (!['json', 'csv'].includes(format)) {
    throw ErrorService.createValidationError('Format must be either "json" or "csv"');
  }

  try {
    const exportData = webhookService.exportWebhooks(format);
    
    webhookLogger.info('Webhook export requested', { 
      format,
      clientId: req.plaidClientId 
    });

    const contentType = format === 'json' ? 'application/json' : 'text/csv';
    const filename = `webhooks-${new Date().toISOString().split('T')[0]}.${format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    res.send(exportData);

  } catch (error) {
    throw ErrorService.createError('Failed to export webhooks', 'EXPORT_ERROR');
  }
}));

// Manual webhook cleanup (auth-protected)
router.post('/api/webhooks/cleanup', ErrorService.asyncHandler(async (req, res) => {
  const beforeCleanup = webhookService.getWebhooks().length;
  
  webhookService.purgeOldWebhooks();
  
  const afterCleanup = webhookService.getWebhooks().length;
  const cleanedCount = beforeCleanup - afterCleanup;

  webhookLogger.info('Manual webhook cleanup performed', { 
    cleanedCount,
    clientId: req.plaidClientId 
  });

  ResponseUtils.success(res, { 
    cleaned_count: cleanedCount,
    remaining_count: afterCleanup 
  }, 'Webhook cleanup completed');
}));

// Get webhook health status (public)
router.get('/api/webhooks/health', ErrorService.asyncHandler(async (req, res) => {
  const stats = webhookService.getWebhookStats();
  
  const health = {
    status: 'healthy',
    total_webhooks: stats.total,
    recent_webhooks: stats.lastHour,
    unique_types: stats.uniqueTypes,
    last_webhook: stats.newestWebhook,
    storage_health: stats.total < 10000 ? 'good' : 'warning', // Example threshold
    timestamp: new Date().toISOString()
  };

  // Determine overall health
  if (stats.total > 50000) {
    health.status = 'degraded';
    health.warning = 'High webhook volume detected';
  }

  ResponseUtils.health(res, health);
}));

module.exports = router;