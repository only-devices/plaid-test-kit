// public/js/identity-tester.js

class IdentityTester {
    constructor() {
        this.rawResponseData = null;
        this.init();
    }

    init() {
        // Set up form handler
        document.getElementById('identityForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.testIdentityAPIs();
        });

        // Check if server has existing token and load accounts
        window.accountManager.checkExistingToken();
    }

    async testIdentityAPIs() {
        if (!window.accountManager.hasAccessToken) {
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
function copyRawResponse() {
    window.identityTester.copyRawResponse();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.identityTester = new IdentityTester();
    window.pageTester = window.identityTester; // For account manager integration
    
    // Add keyboard shortcut for sample data (Ctrl+D)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            window.identityTester.fillSampleData();
            UIUtils.showNotification('Sample data filled!', 'info');
        }
    });
});