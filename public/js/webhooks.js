// public/js/webhooks.js

class WebhooksManager {
    constructor() {
        this.webhooks = [];
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.pollInterval = null;
        this.lastPollTime = null;
        this.init();
    }

    async init() {
        // Display webhook URL
        this.displayWebhookUrl();
        
        // Load existing webhooks
        await this.loadWebhooks();
        
        // Start polling for new webhooks
        this.startPolling();
        
        // Update statistics
        this.updateStatistics();

        // Check and display existing access token if present
        window.accountManager.checkExistingToken();
    }

    displayWebhookUrl() {
        const webhookUrlElement = document.getElementById('webhookUrl');
        if (webhookUrlElement && document.location.origin) {
            webhookUrlElement.textContent = `${document.location.origin}/webhook`;
        }
    }

    async loadWebhooks() {
        try {
            const response = await window.apiClient.request('/api/webhooks', {
                method: 'GET'
            });

            if (response.success) {
                this.webhooks = response.webhooks || [];
                this.renderWebhooks();
                this.updateStatistics();
            }
        } catch (error) {
            console.error('Failed to load webhooks:', error);
            UIUtils.showStatus('webhookStatus', 'Failed to load webhook history', 'error');
        }
    }

    startPolling() {
        // Poll every 5 seconds for new webhooks
        this.pollInterval = setInterval(() => {
            this.loadWebhooks();
        }, 5000);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    renderWebhooks() {
        const logContainer = document.getElementById('webhookLog');
        const filteredWebhooks = this.getFilteredWebhooks();
        
        // Update counts
        document.getElementById('visibleCount').textContent = filteredWebhooks.length;
        document.getElementById('totalCount').textContent = this.webhooks.length;

        if (filteredWebhooks.length === 0) {
            if (this.webhooks.length === 0) {
                logContainer.innerHTML = `
                    <div style="text-align: center; color: #64748b; padding: 40px;">
                        No webhooks received... yet. Do some stuff or fire some Sandbox webhooks to see them here.
                    </div>
                `;
            } else {
                logContainer.innerHTML = `
                    <div style="text-align: center; color: #64748b; padding: 40px;">
                        No webhooks match your current filter/search criteria.
                    </div>
                `;
            }
            return;
        }

        // Sort by timestamp (newest first)
        const sortedWebhooks = filteredWebhooks.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        logContainer.innerHTML = sortedWebhooks.map(webhook => 
            this.renderWebhookEntry(webhook)
        ).join('');
    }

    renderWebhookEntry(webhook) {
        // Highlight search terms
            let dataStr = webhook.data ? JSON.stringify(webhook.data, null, 2) : '{}';        if (this.searchTerm) {
            const regex = new RegExp(`(${this.escapeRegex(this.searchTerm)})`, 'gi');
            dataStr = dataStr.replace(regex, '<span class="webhook-highlight">$1</span>');
        }

        // Apply syntax highlighting
        const highlightedData = UIUtils.syntaxHighlight(dataStr);

        return `
            <div class="webhook-entry">
                <div class="webhook-type">${webhook.timestamp} - ${webhook.webhook_type || 'Unknown Type'}</div>
                <div class="json-block">${highlightedData}</div>
            </div>
        `;
    }

    getFilteredWebhooks() {
        let filtered = this.webhooks;

        // Apply type filter
        if (this.currentFilter !== 'all') {
            // Filter by webhook type prefix
            filtered = filtered.filter(w => {
                const type = (w.webhook_type || '').toLowerCase();
                return type.startsWith(this.currentFilter.toLowerCase());
            });
        }

        // Apply search filter
        if (this.searchTerm) {
            const searchLower = this.searchTerm.toLowerCase();
            filtered = filtered.filter(w => {
                const dataStr = JSON.stringify(w).toLowerCase();
                return dataStr.includes(searchLower);
            });
        }

        return filtered;
    }

    searchWebhooks() {
        const searchInput = document.getElementById('webhookSearch');
        this.searchTerm = searchInput.value.trim();
        this.renderWebhooks();
    }

    filterWebhooks(filter) {
        this.currentFilter = filter;
        
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        this.renderWebhooks();
    }

    updateStatistics() {
        // Total webhooks
        document.getElementById('totalWebhooks').textContent = this.webhooks.length;
        
        // Unique webhook types
        const uniqueTypes = new Set(this.webhooks.map(w => w.webhook_type)).size;
        document.getElementById('uniqueTypes').textContent = uniqueTypes;
        
        // Webhooks in last hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const lastHourCount = this.webhooks.filter(w => 
            new Date(w.timestamp) > oneHourAgo
        ).length;
        document.getElementById('lastHour').textContent = lastHourCount;
    }

    async clearWebhooks() {
        if (!confirm('Are you sure you want to clear all webhook logs?')) {
            return;
        }

        try {
            const response = await window.apiClient.request('/api/webhooks/clear', {
                method: 'POST'
            });

            if (response.success) {
                this.webhooks = [];
                this.renderWebhooks();
                this.updateStatistics();
                UIUtils.showNotification('Webhook logs cleared', 'success');
            }
        } catch (error) {
            UIUtils.showNotification('Failed to clear webhook logs', 'error');
        }
    }

    exportWebhooks() {
        const dataStr = JSON.stringify(this.webhooks, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `plaid-webhooks-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        UIUtils.showNotification('Webhooks exported', 'success');
    }

    async copyWebhookUrl() {
        const webhookUrlElement = document.getElementById('webhookUrl');
        const copyWebhookUrlBtn = document.getElementById('copyWebhookUrlBtn');
        const originalText = copyWebhookUrlBtn.textContent;

        if (!webhookUrlElement) {
            console.error('Webhook URL element not found');
            return;
        }

        const webhookUrl = webhookUrlElement.textContent.trim();

        try {
            // Copy to clipboard
            await navigator.clipboard.writeText(webhookUrl);

            // Update button to show success
            copyWebhookUrlBtn.textContent = 'Copied!';
            copyWebhookUrlBtn.classList.add('copied');

            // Show notification
            UIUtils.showNotification('OAuth redirect URI copied to clipboard!', 'success');

            // Reset button after 2 seconds
            setTimeout(() => {
                copyWebhookUrlBtn.textContent = originalText;
                copyWebhookUrlBtn.classList.remove('copied');
            }, 2000);

        } catch (error) {
            console.error('Failed to copy URL:', error);

            // Fallback: select the text for manual copying
            const range = document.createRange();
            range.selectNode(baseUrlElement);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);

            // Update button to show fallback
            copyWebhookUrlBtn.textContent = 'Selected - Press Ctrl+C';

            UIUtils.showNotification('Please use Ctrl+C to copy the selected URL', 'warning');

            // Reset button after 3 seconds
            setTimeout(() => {
                window.getSelection().removeAllRanges();
                copyWebhookUrlBtn.textContent = originalText;
            }, 3000);
        }
    }

    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    destroy() {
        this.stopPolling();
    }
}

// Global functions for onclick handlers
function searchWebhooks() {
    window.webhooksManager.searchWebhooks();
}

function filterWebhooks(filter) {
    window.webhooksManager.filterWebhooks(filter);
}

function clearWebhooks() {
    window.webhooksManager.clearWebhooks();
}

function exportWebhooks() {
    window.webhooksManager.exportWebhooks();
}

function copyWebhookUrl() {
    window.webhooksManager.copyWebhookUrl();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.webhooksManager = new WebhooksManager();
    
    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        if (window.webhooksManager) {
            window.webhooksManager.destroy();
        }
    });
});