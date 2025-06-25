// public/js/auth-tester.js

class AuthTester {
    constructor() {
        this.hasAccessToken = false;
        this.currentToken = null;
        this.rawResponseData = null;
        this.init();
    }

    init() {
        // Check if server has existing token
        this.checkExistingToken();
    }

    async checkExistingToken() {
        try {
            const health = await window.apiClient.getHealth();
            if (health.hasAccessToken) {
                this.hasAccessToken = true;
                this.currentToken = health.access_token || '(server token)';
                this.showExistingTokenBanner();
                
                // Auto-load accounts
                this.loadAccounts();
            } else {
                UIUtils.showStatus('tokenStatus', 'No access token available. Please enter one or connect via Link.', 'info');
            }
        } catch (error) {
            console.log('Health check failed:', error);
            UIUtils.showStatus('tokenStatus', 'Please enter an access token to begin testing???', 'info');
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
            
            // Insert after header
            const header = document.querySelector('.header');
            if (header && header.parentNode) {
                header.parentNode.insertBefore(banner, header.nextSibling);
            } else {
                // Fallback: append to body or another container
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
                    <button class="btn btn-secondary" onclick="clearTokenAndStartOver()">Start Over</button>
                </div>
            </div>
        `;

        UIUtils.showStatus('tokenStatus', 'Access token set - ready to test Auth APIs', 'success');
    }

    async copyExistingToken() {
        try {
            const health = await window.apiClient.getHealth();
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

    async clearTokenAndStartOver() {
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
            this.rawResponseData = null;
            
            // Clear UI elements
            UIUtils.showStatus('tokenStatus', 'Access token cleared. Please enter a new token or connect via Link.', 'info');
            
            // Clear accounts and results
            const accountSelect = document.getElementById('accountSelect');
            UIUtils.populateSelect(accountSelect, [], '🚫 Accounts not loaded yet!');
            this.clearResults();
            
            UIUtils.showNotification('Access token cleared - redirecting to start page...', 'success');
            
            // Redirect to start page after a short delay
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);
            
        } catch (error) {
            UIUtils.showNotification('Failed to clear token', 'error');
            console.error('Clear token error:', error);
        }
    }

    async setAccessToken() {
        const tokenInput = document.getElementById('accessTokenInput');
        const accessToken = tokenInput.value.trim();
        
        if (!accessToken) {
            UIUtils.showStatus('tokenStatus', 'Please enter an access token', 'error');
            return;
        }

        try {            
            const response = await window.apiClient.setAccessToken(accessToken);
            
            if (response.success) {
                this.hasAccessToken = true;
                this.currentToken = accessToken;
                
                UIUtils.showStatus('tokenStatus', 'Access token set successfully!', 'success');
                
                // Auto-load accounts
                this.loadAccounts();
                // Display existing token banner
                this.showExistingTokenBanner();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            UIUtils.showStatus('tokenStatus', `Error: ${error.message}`, 'error');
        }
    }


    async loadAccounts(event) {
        if (!this.hasAccessToken) {
            UIUtils.showStatus('apiStatus', 'Please set an access token first', 'error');
            return;
        }

        try {            
            const response = await window.apiClient.getAccounts();
            
            if (response.success) {
                this.populateAccountSelect(response.accounts);
                
                const count = response.accounts.length;
                UIUtils.showStatus('apiStatus', `✅ Loaded ${count} account${count !== 1 ? 's' : ''}`, 'success');

                if (document.getElementById('setTokenButton')) {

                    UIUtils.setButtonLoading(document.getElementById('setTokenButton'), true, 'Token Set & Accounts Loaded');
                }
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            UIUtils.showStatus('apiStatus', `❌ Error loading accounts: ${error.message}`, 'error');
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

    async testAuthGet() {
        if (!this.hasAccessToken) {
            UIUtils.showStatus('apiStatus', 'Please set an access token first', 'error');
            return;
        }

        const accountSelect = document.getElementById('accountSelect');
        const selectedIndex = accountSelect.value;

        if (!selectedIndex && selectedIndex !== '0') {
            UIUtils.showStatus('apiStatus', 'Please select an account first', 'error');
            return;
        }

        try {
            const submitButton = event.target;
            UIUtils.setButtonLoading(submitButton, true, 'Testing Auth API...');
            
            const response = await window.apiClient.request('/api/test-auth', {
                method: 'POST',
                body: JSON.stringify({ account_index: parseInt(selectedIndex) })
            });
            
            if (response.success) {
                this.updateAuthResults(response);
                this.rawResponseData = response.raw_response;
                document.getElementById('rawResponse').innerHTML = UIUtils.syntaxHighlight(this.rawResponseData || '{}');
                
                const accountInfo = response.selected_account ? 
                    ` (Account: ${response.selected_account.name || response.selected_account.official_name})` : '';
                UIUtils.showStatus('apiStatus', `Auth API called successfully!${accountInfo}`, 'success');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            UIUtils.showStatus('apiStatus', `Error: ${error.message}`, 'error');
            this.rawResponseData = { error: error.message };
            document.getElementById('rawResponse').textContent = JSON.stringify(this.rawResponseData, null, 2);
        } finally {
            const submitButton = document.querySelector('button[onclick="testAuthGet()"]');
            UIUtils.setButtonLoading(submitButton, false);
        }
    }

    updateAuthResults(data) {
        console.log('Auth API results:', data);

        // Update auth data
        if (data.auth_data) {
            document.getElementById('accountId').textContent = data.selected_account.account_id || '-';
            document.getElementById('accountName').textContent = data.selected_account.name || data.selected_account.official_name || '-';
            document.getElementById('accountMask').textContent = data.selected_account.mask || '-';
            document.getElementById('accountNumber').textContent = data.auth_data.account_number || '-';
            document.getElementById('routingNumber').textContent = data.auth_data.routing_number || '-';
            document.getElementById('wireRoutingNumber').textContent = data.auth_data.wire_routing_number || '-';
            document.getElementById('accountType').textContent = data.auth_data.account_type || '-';
            document.getElementById('accountSubtype').textContent = data.auth_data.account_subtype || '-';
        }

        // Update balance information
        if (data.balance_data) {
            const formatCurrency = (amount, currency = 'USD') => {
                if (amount === null || amount === undefined) return '-';
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: currency
                }).format(amount);
            };

            document.getElementById('availableBalance').textContent = 
                formatCurrency(data.balance_data.available, data.balance_data.iso_currency_code);
            document.getElementById('currentBalance').textContent = 
                formatCurrency(data.balance_data.current, data.balance_data.iso_currency_code);
        } else {
            document.getElementById('availableBalance').textContent = '-';
            document.getElementById('currentBalance').textContent = '-';
        }

        UIUtils.showNotification('Auth API test completed!', 'success');
    }

    async copyRawResponse() {
        if (this.rawResponseData) {
            const success = await UIUtils.copyToClipboard(JSON.stringify(this.rawResponseData, null, 2));
            if (success) {
                UIUtils.showNotification('Response copied to clipboard!', 'success');
            } else {
                UIUtils.showNotification('Failed to copy response', 'error');
            }
        } else {
            UIUtils.showNotification('No response data available', 'error');
        }
    }

    // Helper method to clear all results
    clearResults() {        
        // Clear auth data
        document.getElementById('accountId').textContent = '-';
        document.getElementById('accountName').textContent = '-';
        document.getElementById('accountMask').textContent = '-';
        document.getElementById('accountNumber').textContent = 'Click "Get Account & Routing Numbers" to retrieve';
        document.getElementById('routingNumber').textContent = '-';
        document.getElementById('wireRoutingNumber').textContent = '-';
        document.getElementById('accountType').textContent = '-';
        document.getElementById('accountSubtype').textContent = '-';
        document.getElementById('availableBalance').textContent = '-';
        document.getElementById('currentBalance').textContent = '-';
        
        // Clear raw response
        document.getElementById('rawResponse').textContent = '// API response will appear here after testing';
        this.rawResponseData = null;
    }
}

// Global functions for onclick handlers
function setAccessToken() {
    window.authTester.setAccessToken();
}

function loadAccounts() {
    window.authTester.loadAccounts();
}

function testAuthGet() {
    window.authTester.testAuthGet();
}

function copyRawResponse() {
    window.authTester.copyRawResponse();
}

function copyExistingToken() {
    window.authTester.copyExistingToken();
}

function clearTokenAndStartOver() {
    window.authTester.clearTokenAndStartOver();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.authTester = new AuthTester();
    
    // Add keyboard shortcut for easy testing (Ctrl+T)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 't') {
            e.preventDefault();
            testAuthGet();
            UIUtils.showNotification('Auth test triggered!', 'info');
        }
    });
});