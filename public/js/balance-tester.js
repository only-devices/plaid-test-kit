class BalanceTester {
    constructor() {
        this.rawResponseData = null;
        this.init();
    }

    async init() {
        // Check if server has existing token and load accounts
        await window.accountManager.checkExistingToken();
    }

    async testBalanceGet() {
        if (!window.accountManager.hasAccessToken) {
            UIUtils.showStatus('apiStatus', 'Please set an access token first', 'error');
            return;
        }

        const selectedAccount = window.accountManager.getSelectedAccount();
        if (!selectedAccount) {
            UIUtils.showStatus('apiStatus', 'Please select an account first', 'error');
            return;
        }

        try {
            const submitButton = event.target;
            UIUtils.setButtonLoading(submitButton, true, 'Testing Balance API...');
            
            const response = await window.apiClient.request('/api/test-balance', {
                method: 'POST',
                body: JSON.stringify({ account_index: selectedAccount.index })
            });
            
            if (response.success) {
                this.updateBalanceResults(response);
                this.rawResponseData = response.raw_response;
                document.getElementById('rawResponse').innerHTML = UIUtils.syntaxHighlight(this.rawResponseData || '{}');
                
                const accountInfo = response.selected_account ? 
                    ` (Account: ${response.selected_account.name || response.selected_account.official_name})` : '';
                UIUtils.showStatus('apiStatus', `Balance API called successfully!${accountInfo}`, 'success');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            UIUtils.showStatus('apiStatus', `Error: ${error.message}`, 'error');
            this.rawResponseData = { error: error.message };
            document.getElementById('rawResponse').textContent = JSON.stringify(this.rawResponseData, null, 2);
        } finally {
            const submitButton = document.querySelector('button[onclick="testBalanceGet()"]');
            UIUtils.setButtonLoading(submitButton, false);
        }
    }

    updateBalanceResults(data) {
        console.log('Balance API results:', data);

        // Update account information
        if (data.selected_account) {
            document.getElementById('accountId').textContent = data.selected_account.account_id || '-';
            document.getElementById('accountName').textContent = data.selected_account.name || data.selected_account.official_name || '-';
            document.getElementById('accountType').textContent = data.selected_account.type || '-';
            document.getElementById('accountSubtype').textContent = data.selected_account.subtype || '-';
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

            const formatDateTime = (dateString) => {
                if (!dateString) return '-';
                try {
                    return new Date(dateString).toLocaleString();
                } catch (error) {
                    return dateString;
                }
            };

            document.getElementById('availableBalance').textContent = 
                formatCurrency(data.balance_data.available, data.balance_data.iso_currency_code);
            document.getElementById('currentBalance').textContent = 
                formatCurrency(data.balance_data.current, data.balance_data.iso_currency_code);
            document.getElementById('creditLimit').textContent = 
                data.balance_data.limit ? formatCurrency(data.balance_data.limit, data.balance_data.iso_currency_code) : '-';
            document.getElementById('currency').textContent = 
                data.balance_data.iso_currency_code || data.balance_data.unofficial_currency_code || '-';
            document.getElementById('lastUpdated').textContent = 
                formatDateTime(data.balance_data.last_updated_datetime);
        } else {
            this.clearBalanceResults();
        }

        UIUtils.showNotification('Balance API test completed!', 'success');
    }

    clearBalanceResults() {
        // Clear balance data
        document.getElementById('availableBalance').textContent = '-';
        document.getElementById('currentBalance').textContent = '-';
        document.getElementById('creditLimit').textContent = '-';
        document.getElementById('currency').textContent = '-';
        document.getElementById('lastUpdated').textContent = '-';
    }

    // Helper method to clear all results
    clearResults() {
        // Clear account info
        document.getElementById('accountId').textContent = 'Click "Get Account Balance" to retrieve';
        document.getElementById('accountName').textContent = '-';
        document.getElementById('accountType').textContent = '-';
        document.getElementById('accountSubtype').textContent = '-';
        
        // Clear balance data
        this.clearBalanceResults();
        
        // Clear raw response
        document.getElementById('rawResponse').textContent = '// API response will appear here after testing';
        this.rawResponseData = null;
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
}

// Global functions for onclick handlers
function testBalanceGet() {
    window.balanceTester.testBalanceGet();
}

function copyRawResponse() {
    window.balanceTester.copyRawResponse();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.balanceTester = new BalanceTester();
    window.pageTester = window.balanceTester; // For account manager integration
    
    // Add keyboard shortcut for easy testing (Ctrl+B)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            testBalanceGet();
            UIUtils.showNotification('Balance test triggered!', 'info');
        }
    });
});