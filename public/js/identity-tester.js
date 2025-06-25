// public/js/identity-tester.js

class IdentityTester {
    constructor() {
        this.hasAccessToken = false;
        this.currentToken = null;
        this.rawResponseData = null;
        this.init();
    }

    init() {
        // Set up form handler
        document.getElementById('identityForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.testIdentityAPIs();
        });

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
            UIUtils.showStatus('tokenStatus', 'Please enter an access token to begin testing', 'info');
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

        UIUtils.showStatus('tokenStatus', 'Access token set - ready to test APIs', 'success');
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
            UIUtils.toggleElement('currentTokenDisplay', false);
            UIUtils.showStatus('tokenStatus', 'Access token cleared. Please enter a new token or connect via Link.', 'info');
            
            // Clear accounts and results
            const accountSelect = document.getElementById('accountSelect');
            UIUtils.populateSelect(accountSelect, [], 'Load accounts first...');
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

    async testIdentityAPIs() {
        if (!this.hasAccessToken) {
            UIUtils.showStatus('apiStatus', 'Please set an access token first', 'error');
            return;
        }

        const formData = new FormData(document.getElementById('identityForm'));
        const userData = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            address: {
                street: formData.get('street'),
                city: formData.get('city'),
                state: formData.get('state'),
                zip: formData.get('zip'),
                country: formData.get('country')
            },
            account_index: formData.get('account_index')
        };

        // Validate at least some data is provided
        if (!userData.name && !userData.email && !userData.phone) {
            UIUtils.showStatus('apiStatus', '⚠️ Please enter at least one piece of information to test', 'error');
            return;
        }

        try {
            const submitButton = document.querySelector('#identityForm button[type="submit"]');
            UIUtils.setButtonLoading(submitButton, true, 'Testing APIs...');
            
            const response = await window.apiClient.testIdentity(userData);
            
            if (response.success) {
                this.updateResults(response);
                this.rawResponseData = response.raw_response;
                
                const accountInfo = response.selected_account ? 
                    ` (Account: ${response.selected_account.name || response.selected_account.official_name})` : '';
                UIUtils.showStatus('apiStatus', `Identity APIs called successfully!${accountInfo}`, 'success');
                
                // Populate raw response sections
                document.getElementById('rawIdentityGetResponse').innerHTML = UIUtils.syntaxHighlight(this.rawResponseData.identity_get || '{"message": "Raw response not available. Poorly written code most likely cause."}');
                document.getElementById('rawIdentityMatchResponse').innerHTML = UIUtils.syntaxHighlight(this.rawResponseData.identity_match || '{"message": "Raw response not available. Poorly written code most likely cause."}');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            UIUtils.showStatus('apiStatus', `Error: ${error.message}`, 'error');
            this.rawResponseData = { error: error.message };
            document.getElementById('rawIdentityGetResponse').innerHTML = UIUtils.syntaxHighlight(this.rawResponseData);
            document.getElementById('rawIdentityMatchResponse').innerHTML = UIUtils.syntaxHighlight(this.rawResponseData);
        } finally {
            const submitButton = document.querySelector('#identityForm button[type="submit"]');
            UIUtils.setButtonLoading(submitButton, false);
        }
    }

    updateResults(data) {
        // Debug: Log the actual values
        console.log('Identity API results:', data);

        // Update match scores - use nullish coalescing operator (??) for proper handling of 0 values
        document.getElementById('nameScore').textContent = data.match.name_score ?? '-';
        document.getElementById('emailScore').textContent = data.match.email_score ?? '-';
        document.getElementById('phoneScore').textContent = data.match.phone_score ?? '-';
        document.getElementById('addressScore').textContent = data.match.address_score ?? '-';
        
        // Update boolean fields
        UIUtils.updateBooleanField('isNicknameMatch', 'Nickname', data.match.is_nickname_match);
        UIUtils.updateBooleanField('isFirstLastMatch', 'First/Last', data.match.is_first_name_or_last_name_match);
        UIUtils.updateBooleanField('isBusinessName', 'Business', data.match.is_business_name_detected);
        UIUtils.updateBooleanField('isPostalCodeMatch', 'Postal Code', data.match.is_postal_code_match);
        
        // Update account info
        const accountInfo = document.getElementById('accountInfo');
        if (data.account && data.account.id) {
            accountInfo.innerHTML = `
                <div><strong>ID:</strong> ${data.account.id}</div>
                <div><strong>Name:</strong> ${data.account.name || '-'}</div>
                <div><strong>Ending in:</strong> ${data.account.mask || '-'}</div>
            `;
        } else {
            accountInfo.textContent = 'No account information available';
        }
        
        // Update retrieved identity data
        document.getElementById('retrievedName').textContent = data.identity.name || '-';
        document.getElementById('retrievedEmail').textContent = data.identity.email || '-';
        document.getElementById('retrievedPhone').textContent = data.identity.phone || '-';
        document.getElementById('retrievedStreet').textContent = data.identity.address.street || '-';
        document.getElementById('retrievedCity').textContent = data.identity.address.city || '-';
        document.getElementById('retrievedState').textContent = data.identity.address.region || '-';
        document.getElementById('retrievedZip').textContent = data.identity.address.postal_code || '-';
        document.getElementById('retrievedCountry').textContent = data.identity.address.country || '-';

        // Show notification
        UIUtils.showNotification('Identity API test completed!', 'success');
    }

    // Helper method to clear all results
    clearResults() {
        // Clear match scores
        document.getElementById('nameScore').textContent = '-';
        document.getElementById('emailScore').textContent = '-';
        document.getElementById('phoneScore').textContent = '-';
        document.getElementById('addressScore').textContent = '-';
        
        // Clear boolean fields
        const booleanFields = ['isNicknameMatch', 'isFirstLastMatch', 'isBusinessName', 'isPostalCodeMatch'];
        booleanFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            element.textContent = element.textContent.split(':')[0] + ': -';
            element.className = 'boolean-field';
        });
        
        // Clear account info
        document.getElementById('accountInfo').textContent = '-';
        
        // Clear retrieved data
        const retrievedFields = [
            'retrievedName', 'retrievedEmail', 'retrievedPhone', 'retrievedStreet',
            'retrievedCity', 'retrievedState', 'retrievedZip', 'retrievedCountry'
        ];
        retrievedFields.forEach(fieldId => {
            document.getElementById(fieldId).textContent = '-';
        });
    }

async copyRawResponse(key) {
    if (this.rawResponseData) {
        let dataToCopy = this.rawResponseData;
        if (key && this.rawResponseData.hasOwnProperty(key)) {
            dataToCopy = this.rawResponseData[key];
        }
        const success = await UIUtils.copyToClipboard(JSON.stringify(dataToCopy, null, 2));
        if (success) {
            UIUtils.showNotification('Response copied to clipboard!', 'success');
        } else {
            UIUtils.showNotification('Failed to copy response', 'error');
        }
    } else {
        UIUtils.showNotification('No response data available', 'error');
    }
}

    // Helper method to pre-fill form with sample data
    fillSampleData() {
        document.getElementById('name').value = 'John Doe';
        document.getElementById('email').value = 'john.doe@example.com';
        document.getElementById('phone').value = '+1234567890';
        document.getElementById('street').value = '123 Main St';
        document.getElementById('city').value = 'San Francisco';
        document.getElementById('state').value = 'CA';
        document.getElementById('zip').value = '94105';
        document.getElementById('country').value = 'US';
    }
}

// Global functions for onclick handlers
function setAccessToken() {
    window.identityTester.setAccessToken();
}

function loadAccounts() {
    window.identityTester.loadAccounts();
}

function copyExistingToken() {
    window.identityTester.copyExistingToken();
}

function copyRawResponse() {
    window.identityTester.copyRawResponse();
}

function clearTokenAndStartOver() {
    window.identityTester.clearTokenAndStartOver();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.identityTester = new IdentityTester();
    
    // Add keyboard shortcut for sample data (Ctrl+D)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            window.identityTester.fillSampleData();
            UIUtils.showNotification('Sample data filled!', 'info');
        }
    });
});