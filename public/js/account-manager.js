// public/js/account-manager.js

class AccountManager {
    constructor() {
        this.hasAccessToken = false;
        this.currentToken = null;
        this.accounts = [];
    }

    async checkExistingToken() {
        try {
            const health = await window.apiClient.getStatus();
            if (health.hasAccessToken) {
                this.hasAccessToken = true;
                this.currentToken = health.access_token || '(server token)';
                this.showExistingTokenBanner();
                
                // Auto-load accounts
                await this.loadAccounts();
                return true;
            } else {
                UIUtils.showStatus('tokenStatus', 'No access token available. Please enter one or connect via Link.', 'info');
                return false;
            }
        } catch (error) {
            console.log('Health check failed:', error);
            UIUtils.showStatus('tokenStatus', 'Please enter an access token to begin testing', 'info');
            return false;
        }
    }

    showExistingTokenBanner() {
        // Create or update existing token banner
        let banner = document.getElementById('existingTokenBanner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'existingTokenBanner';
            banner.className = 'card';
            banner.style.backgroundColor = '#e3f2fd';
            banner.style.borderLeft = '4px solid #2196f3';
            
            // Insert after navbar
            const navbar = document.querySelector('.navbar');
            if (navbar && navbar.parentNode) {
                navbar.parentNode.insertBefore(banner, navbar.nextSibling);
            } else {
                // Fallback: prepend to body
                document.body.prepend(banner);
            }
        }

        banner.innerHTML = `
            <div class="grid grid-2">
                <div>
                    <h4 style="margin: 0;">An access token has been set</h4>
                    <p style="margin: 5px 0 0 0; color: #666;">Ready to test. Or, start over with a new connection.</p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; justify-content: flex-end;">
                    <button class="btn btn-outline" onclick="copyExistingToken()">Copy Token</button>
                    <button class="btn btn-secondary" onclick="startOver()">Start Over</button>
                </div>
            </div>
        `;

        UIUtils.showStatus('tokenStatus', 'Access token set - ready to test APIs', 'success');
    }

    async setAccessToken(accessToken) {
        if (!accessToken) {
            UIUtils.showStatus('tokenStatus', 'Please enter an access token', 'error');
            return false;
        }

        try {
            const response = await window.apiClient.setAccessToken(accessToken);
            
            if (response.success) {
                this.hasAccessToken = true;
                this.currentToken = accessToken;

                // Fetch item_id and set it in itemStore
                const itemResponse = await window.apiClient.getItem(accessToken);
                if (itemResponse.success && itemResponse.item_id) {
                    // Send item_id to backend to store in itemStore
                    await window.apiClient.setItemId({ access_token: accessToken, item_id: itemResponse.item_id });
                }
                
                UIUtils.showStatus('tokenStatus', 'Access token set successfully!', 'success');
                
                // Auto-load accounts
                await this.loadAccounts();
                // Display existing token banner
                this.showExistingTokenBanner();
                return true;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            UIUtils.showStatus('tokenStatus', `Error: ${error.message}`, 'error');
            return false;
        }
    }

    async loadAccounts() {
        if (!this.hasAccessToken) {
            UIUtils.showStatus('apiStatus', 'Please set an access token first', 'error');
            return false;
        }

        try {
            const response = await window.apiClient.getAccounts();
            
            if (response.success) {
                this.accounts = response.accounts;
                this.populateAccountSelect(response.accounts);
                
                const count = response.accounts.length;
                UIUtils.showStatus('apiStatus', `✅ Loaded ${count} account${count !== 1 ? 's' : ''}`, 'success');

                // Update button text if it exists
                const setTokenButton = document.getElementById('setTokenButton');
                if (setTokenButton) {
                    UIUtils.setButtonLoading(setTokenButton, true, 'Token Set & Accounts Loaded');
                }
                
                return true;
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            UIUtils.showStatus('apiStatus', `❌ Error loading accounts: ${error.message}`, 'error');
            return false;
        }
    }

    populateAccountSelect(accounts) {
        const accountSelect = document.getElementById('accountSelect');
        
        if (!accounts || accounts.length === 0) {
            UIUtils.populateSelect(accountSelect, [], 'No accounts found');
            return;
        }

        const options = accounts.map(account => ({
            value: account.index,
            text: UIUtils.formatAccountName(account)
        }));

        UIUtils.populateSelect(accountSelect, options, 'Select an account...');
    }

    getSelectedAccount() {
        const accountSelect = document.getElementById('accountSelect');
        const selectedIndex = accountSelect.value;

        if (!selectedIndex && selectedIndex !== '0') {
            return null;
        }

        const index = parseInt(selectedIndex);
        return this.accounts[index] || null;
    }

    async copyExistingToken() {
        try {
            const health = await window.apiClient.getStatus();
            if (health.access_token) {
                const success = await UIUtils.copyToClipboard(health.access_token);
                if (success) {
                    UIUtils.showNotification('Access token copied to clipboard!', 'success');
                } else {
                    UIUtils.showNotification('Failed to copy token', 'error');
                }
            } else {
                UIUtils.showNotification('No token available', 'error');
            }
        } catch (error) {
            UIUtils.showNotification('Failed to retrieve token', 'error');
            console.error('Copy token error:', error);
        }
    }

    async startOver() {
        try {
            // Clear token on server
            await window.apiClient.clearToken();
            
            // Remove the banner
            const banner = document.getElementById('existingTokenBanner');
            if (banner) {
                banner.remove();
            }
            
            // Reset local state
            this.hasAccessToken = false;
            this.currentToken = null;
            this.accounts = [];
            
            // Clear UI elements
            UIUtils.showStatus('tokenStatus', 'Access token cleared. Please enter a new token or connect via Link.', 'info');
            
            // Clear accounts
            const accountSelect = document.getElementById('accountSelect');
            UIUtils.populateSelect(accountSelect, [], '🚫 Accounts not loaded yet!');
            
            // Clear any results if clearResults method exists on the page-specific tester
            if (window.pageTester && typeof window.pageTester.clearResults === 'function') {
                window.pageTester.clearResults();
            }
            
            UIUtils.showNotification('Access token cleared!', 'success');
            
        } catch (error) {
            UIUtils.showNotification('Failed to clear token', 'error');
            console.error('Clear token error:', error);
        }
    }
}

// Create and export singleton
window.accountManager = new AccountManager();

// Global functions for onclick handlers
function setAccessToken() {
    const tokenInput = document.getElementById('accessTokenInput');
    const accessToken = tokenInput.value.trim();
    window.accountManager.setAccessToken(accessToken);
}

function copyExistingToken() {
    window.accountManager.copyExistingToken();
}

function startOver() {
    window.accountManager.startOver();
}