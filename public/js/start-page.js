// public/js/start-page.js

class StartPage {
    constructor() {
        this.currentAccessToken = null;
        this.currentMode = null;
        this.customConfig = null;
        this.init();
    }

    init() {
        // Check if we have an existing token and configuration
        this.checkExistingToken();
        this.checkCustomConfiguration();
    }

    async checkExistingToken() {
        try {
            const health = await window.apiClient.getHealth();
            if (health.hasAccessToken) {
                this.currentAccessToken = health.access_token || '(server token)';
                this.showExistingTokenBanner();
            }
        } catch (error) {
            console.log('Health check failed:', error);
        }
    }

    async checkCustomConfiguration() {
        try {
            const health = await window.apiClient.getHealth();
            if (health.has_custom_link_config && health.custom_link_config) {
                this.customConfig = health.custom_link_config;
                this.showConfigurationBanner();
                this.updateConfigStatus();
            } else {
                this.updateConfigStatus();
            }
        } catch (error) {
            console.log('Config check failed:', error);
            this.updateConfigStatus();
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
                    <h4 style="margin: 0;">An access token is already available</h4>
                    <p style="margin: 5px 0 0 0; color: #666;">You can continue testing or start over with a new connection.</p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; justify-content: flex-end;">
                    <button class="btn btn-outline" onclick="copyExistingToken()">Copy Token</button>
                    <button class="btn btn-secondary" onclick="clearTokenAndStartOver()">Start Over</button>
                </div>
            </div>
        `;
    }

    showConfigurationBanner() {
        const banner = document.getElementById('configBanner');
        if (banner && this.customConfig) {
            banner.classList.remove('hidden');
            
            // Update summary
            const summary = document.getElementById('configSummary');
            const productCount = this.customConfig.products ? this.customConfig.products.length : 0;
            const countryCount = this.customConfig.country_codes ? this.customConfig.country_codes.length : 0;
            
            summary.textContent = `Using ${productCount} product(s) and ${countryCount} country code(s)`;
        }
    }

    updateConfigStatus() {
        const statusEl = document.getElementById('configStatus');
        if (!statusEl) return;

        if (this.customConfig) {
            const productsList = this.customConfig.products ? this.customConfig.products.join(', ') : 'none';
            const countriesList = this.customConfig.country_codes ? this.customConfig.country_codes.join(', ') : 'none';
            
            statusEl.innerHTML = `
                <div style="padding: 12px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; border-left: 3px solid #10b981;">
                    <div style="font-size: 13px; color: #047857;">
                        <div><strong>Products:</strong> ${productsList}</div>
                        <div><strong>Countries:</strong> ${countriesList}</div>
                        <div><strong>Client:</strong> ${this.customConfig.client_name || 'Plaid Test Kit'}</div>
                    </div>
                </div>
            `;;
        }
    }

    async copyExistingToken() {
        try {
            const health = await window.apiClient.getHealth();
            console.log('Health response:', health); // Debug log
            
            if (health.access_token) {
                const success = await UIUtils.copyToClipboard(health.access_token);
                if (success) {
                    UIUtils.showNotification('Access token copied to clipboard!', 'success');
                } else {
                    UIUtils.showNotification('Failed to copy token', 'error');
                }
            } else {
                console.error('No access_token in health response:', health);
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
            this.currentAccessToken = null;
            
            // Clear direct token status
            UIUtils.clearStatus('directTokenStatus');
            
            // Call existing start over functionality
            this.startOver();
            
            UIUtils.showNotification('Access token cleared successfully', 'success');
        } catch (error) {
            UIUtils.showNotification('Failed to clear token', 'error');
            console.error('Clear token error:', error);
        }
    }

    async startStandardLink() {
        try {
            this.currentMode = 'standard';
            UIUtils.showStatus('globalStatus', 'Creating Link token...', 'info');

            // Create link token with custom config
            const tokenResponse = await window.plaidLinkManager.createLinkToken({
                mode: 'standard',
                custom_config: this.customConfig
            });

            if (!tokenResponse.success) {
                throw new Error(tokenResponse.error);
            }

            UIUtils.showStatus('globalStatus', 'Opening Plaid Link...', 'info');

            // Initialize Link
            await window.plaidLinkManager.initialize({
                mode: 'standard',
                linkToken: tokenResponse.link_token,
                onSuccess: (publicToken, metadata) => this.handleLinkSuccess(publicToken, metadata),
                onExit: (err, metadata) => this.handleLinkExit(err, metadata),
                onEvent: (eventName, metadata) => this.handleLinkEvent(eventName, metadata),
                onLoad: () => this.handleLinkLoad()
            });

        } catch (error) {
            UIUtils.showStatus('globalStatus', `Failed to start Standard Link: ${error.message}`, 'error');
        }
    }

    async startEmbeddedLink() {
        try {
            this.currentMode = 'embedded';
            
            // Show embedded container
            UIUtils.toggleElement('embeddedContainer', true);
            
            // Scroll to embedded container
            document.getElementById('embeddedContainer').scrollIntoView({ 
                behavior: 'smooth' 
            });

            UIUtils.showStatus('embeddedStatus', 'Creating Link token...', 'info');

            // Create link token with custom config
            const tokenResponse = await window.plaidLinkManager.createLinkToken({
                mode: 'embedded',
                custom_config: this.customConfig
            });

            if (!tokenResponse.success) {
                throw new Error(tokenResponse.error);
            }

            UIUtils.showStatus('embeddedStatus', 'Initializing Embedded Link...', 'info');

            // Get container element
            const container = document.getElementById('linkContainer');

            // Initialize embedded Link
            await window.plaidLinkManager.initialize({
                mode: 'embedded',
                linkToken: tokenResponse.link_token,
                container: container,
                onSuccess: (publicToken, metadata) => this.handleLinkSuccess(publicToken, metadata),
                onExit: (err, metadata) => this.handleLinkExit(err, metadata),
                onEvent: (eventName, metadata) => this.handleLinkEvent(eventName, metadata),
                onLoad: () => {
                    // Clear placeholder content when Link loads
                    const placeholders = container.querySelectorAll('.link-container-placeholder');
                    placeholders.forEach(placeholder => placeholder.remove());
                    
                    // Ensure container styling is correct for iframe
                    container.style.background = 'transparent';
                    container.style.padding = '0';
                    
                    // Find and style the iframe if it exists
                    setTimeout(() => {
                        const iframe = container.querySelector('iframe');
                        if (iframe) {
                            iframe.style.width = '100%';
                            iframe.style.height = '100%';
                            iframe.style.border = 'none';
                            iframe.style.display = 'block';
                            console.log('Embedded Link iframe found and styled');
                        } else {
                            console.warn('No iframe found in embedded Link container');
                        }
                    }, 100);
                    
                    UIUtils.showStatus('embeddedStatus', 'Embedded Link loaded! Select an institution above.', 'success');
                },
                onEvent: (eventName, metadata) => {
                    console.log('Embedded Link event:', eventName, metadata);
                    
                    // Handle error events specifically
                    if (eventName === 'ERROR') {
                        console.error('Embedded Link ERROR:', metadata);
                        UIUtils.showStatus('embeddedStatus', `Link error: ${metadata.error_message || 'Unknown error'}`, 'error');
                        
                        // Show error in container
                        container.innerHTML = `
                            <div class="link-container-placeholder" style="color: #dc3545;">
                                <h4>Link Error</h4>
                                <p>${metadata.error_message || 'An error occurred'}</p>
                                <p style="font-size: 12px;">${metadata.error_code || ''}</p>
                                <button class="btn btn-outline" onclick="startEmbeddedLink()">Try Again</button>
                            </div>
                        `;
                    } else if (eventName === 'LOADED') {
                        // Link has successfully loaded
                        container.style.background = 'transparent';
                        UIUtils.showStatus('embeddedStatus', 'Embedded Link ready!', 'success');
                    }
                    
                    // Call the shared event handler
                    this.handleLinkEvent(eventName, metadata);
                }
            });

        } catch (error) {
            UIUtils.showStatus('embeddedStatus', `Failed to start Embedded Link: ${error.message}`, 'error');
        }
    }

    showUpdateMode() {
        UIUtils.toggleElement('updateModeCard', true);
        document.getElementById('updateModeCard').scrollIntoView({ 
            behavior: 'smooth' 
        });
        document.getElementById('updateAccessToken').focus();
    }

    hideUpdateMode() {
        UIUtils.toggleElement('updateModeCard', false);
        UIUtils.clearStatus('updateStatus');
    }

    async startUpdateMode() {
        try {
            const accessToken = document.getElementById('updateAccessToken').value.trim();
            
            if (!accessToken) {
                UIUtils.showStatus('updateStatus', 'Please enter an access token', 'error');
                return;
            }

            this.currentMode = 'update';
            UIUtils.showStatus('updateStatus', 'Creating Link token for update mode...', 'info');

            // Create link token for update mode with custom config
            const tokenResponse = await window.plaidLinkManager.createLinkToken({
                mode: 'update',
                accessToken: accessToken,
                custom_config: this.customConfig
            });

            if (!tokenResponse.success) {
                throw new Error(tokenResponse.error);
            }

            UIUtils.showStatus('updateStatus', 'Opening Link in update mode...', 'info');

            // Initialize Link in update mode
            await window.plaidLinkManager.initialize({
                mode: 'update',
                linkToken: tokenResponse.link_token,
                onSuccess: (publicToken, metadata) => this.handleLinkSuccess(publicToken, metadata),
                onExit: (err, metadata) => this.handleLinkExit(err, metadata),
                onEvent: (eventName, metadata) => this.handleLinkEvent(eventName, metadata),
                onLoad: () => this.handleLinkLoad()
            });

        } catch (error) {
            UIUtils.showStatus('updateStatus', `Failed to start Update Mode: ${error.message}`, 'error');
        }
    }

    async setDirectAccessToken() {
        const accessToken = document.getElementById('directAccessToken').value.trim();
        
        if (!accessToken) {
            UIUtils.showStatus('directTokenStatus', 'Please enter an access token', 'error');
            return;
        }

        try {
            UIUtils.setButtonLoading(event.target, true, 'Validating...');
            
            const response = await window.apiClient.setAccessToken(accessToken);
            
            if (response.success) {
                this.currentAccessToken = accessToken;
                UIUtils.showStatus('directTokenStatus', 'Access token set successfully! You can now test APIs or start over.', 'success');
                
                // Show success section
                this.showSuccessSection({ institution: { name: 'Direct Token' } }, 'Direct');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            UIUtils.showStatus('directTokenStatus', `Error: ${error.message}`, 'error');
        } finally {
            UIUtils.setButtonLoading(event.target, false);
        }
    }

    // Configuration management functions
    async viewConfiguration() {
        window.location.href = '/link-config.html';
    }

    async clearConfiguration() {
        try {
            await window.apiClient.request('/api/clear-link-config', {
                method: 'POST'
            });
            
            this.customConfig = null;
            
            // Hide banner
            const banner = document.getElementById('configBanner');
            if (banner) {
                banner.classList.add('hidden');
            }
            
            // Update status
            this.updateConfigStatus();
            
            UIUtils.showNotification('Configuration cleared - using defaults', 'success');
        } catch (error) {
            UIUtils.showNotification(`Failed to clear configuration: ${error.message}`, 'error');
        }
    }

    async loadPresetConfig(presetType) {
        const presets = {
            'identity': {
                products: ['identity'],
                client_name: 'Plaid Test Kit - Identity Only',
                country_codes: ['US'],
                language: 'en'
            },
            'transactions': {
                products: ['transactions'],
                client_name: 'Plaid Test Kit - Transactions',
                country_codes: ['US'],
                language: 'en'
            },
            'auth': {
                products: ['auth'],
                client_name: 'Plaid Test Kit - Auth',
                country_codes: ['US'],
                language: 'en'
            },
            'multi-product': {
                products: ['transactions', 'identity', 'auth'],
                client_name: 'Plaid Test Kit - Multi Product',
                country_codes: ['US'],
                language: 'en'
            }
        };

        const config = presets[presetType];
        if (!config) {
            UIUtils.showNotification(`Preset "${presetType}" not found`, 'error');
            return;
        }

        try {
            const response = await window.apiClient.request('/api/set-link-config', {
                method: 'POST',
                body: JSON.stringify({ config })
            });
            
            if (response.success) {
                this.customConfig = config;
                this.showConfigurationBanner();
                this.updateConfigStatus();
                UIUtils.showNotification(`✅ Loaded "${presetType}" configuration`, 'success');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            UIUtils.showNotification(`❌ Failed to load preset: ${error.message}`, 'error');
        } finally {
            UIUtils.setButtonLoading(event.target, false);
        }
    }

    async handleLinkSuccess(publicToken, metadata) {
        try {
            const authMethod = metadata.auth_type === 'oauth' ? 'OAuth' : 'credentials';
            const statusMessage = `Bank connected via ${authMethod}! Exchanging token...`;
            
            // Show status in appropriate location
            if (this.currentMode === 'embedded') {
                UIUtils.showStatus('embeddedStatus', statusMessage, 'success');
                // Also update the container
                const container = document.getElementById('linkContainer');
                container.innerHTML = `
                    <div class="link-container-placeholder">
                        <h4 style="color: #28a745;">✓ Connection Successful!</h4>
                        <p>Bank connected via ${authMethod}</p>
                        <p>Processing token exchange...</p>
                    </div>
                `;
            } else {
                UIUtils.showStatus('globalStatus', statusMessage, 'success');
            }

            // Exchange public token for access token
            const exchangeResponse = await window.apiClient.exchangePublicToken(publicToken);
            
            if (exchangeResponse.success) {
                this.currentAccessToken = exchangeResponse.access_token;
                this.showSuccessSection(metadata, authMethod);
            } else {
                throw new Error(exchangeResponse.error);
            }

        } catch (error) {
            const errorMessage = `Token exchange failed: ${error.message}`;
            if (this.currentMode === 'embedded') {
                UIUtils.showStatus('embeddedStatus', errorMessage, 'error');
            } else {
                UIUtils.showStatus('globalStatus', errorMessage, 'error');
            }
        }
    }

    handleLinkExit(err, metadata) {
        if (err) {
            const errorMessage = `Link error: ${err.error_message || err.message || 'Unknown error'}`;
            
            if (this.currentMode === 'embedded') {
                UIUtils.showStatus('embeddedStatus', errorMessage, 'error');
                // Update container to show error
                const container = document.getElementById('linkContainer');
                container.innerHTML = `
                    <div class="link-container-placeholder" style="color: #dc3545;">
                        <h4>Connection Failed</h4>
                        <p>${err.error_message || err.message || 'Unknown error'}</p>
                        <p>Please try again</p>
                    </div>
                `;
            } else {
                UIUtils.showStatus('globalStatus', errorMessage, 'error');
            }
        } else {
            // User cancelled
            const cancelMessage = 'Connection cancelled by user';
            
            if (this.currentMode === 'embedded') {
                UIUtils.showStatus('embeddedStatus', cancelMessage, 'info');
                // Reset container
                const container = document.getElementById('linkContainer');
                container.innerHTML = `
                    <div class="link-container-placeholder">
                        <p>Connection cancelled</p>
                        <p>Click "Start Embedded Link" to try again</p>
                    </div>
                `;
            } else {
                UIUtils.showStatus('globalStatus', cancelMessage, 'info');
            }
        }
    }

    handleLinkEvent(eventName, metadata) {
        console.log('Link event:', { eventName, metadata, mode: this.currentMode });
        
        // Handle specific events for user feedback
        if (eventName === 'SEARCH_INSTITUTION') {
            const message = 'Institution search performed...';
            if (this.currentMode === 'embedded') {
                UIUtils.showStatus('embeddedStatus', message, 'info');
            }
        } else if (eventName === 'SELECT_INSTITUTION') {
            const institutionName = metadata.institution_name || 'Selected institution';
            const message = `Selected: ${institutionName}`;
            if (this.currentMode === 'embedded') {
                UIUtils.showStatus('embeddedStatus', message, 'info');
            } else {
                UIUtils.showStatus('globalStatus', message, 'info');
            }
        } else if (eventName === 'HANDOFF') {
            const message = 'Redirecting to bank for OAuth authentication...';
            if (this.currentMode === 'embedded') {
                UIUtils.showStatus('embeddedStatus', message, 'info');
            } else {
                UIUtils.showStatus('globalStatus', message, 'info');
            }
        } else if (eventName === 'HANDOFF_COMPLETE') {
            const message = 'OAuth authentication completed, returning to Link...';
            if (this.currentMode === 'embedded') {
                UIUtils.showStatus('embeddedStatus', message, 'info');
            } else {
                UIUtils.showStatus('globalStatus', message, 'info');
            }
        }
    }

    handleLinkLoad() {
        console.log('Link loaded for mode:', this.currentMode);
    }

    showSuccessSection(metadata, authMethod) {
        // Hide other sections
        UIUtils.toggleElement('embeddedContainer', false);
        UIUtils.toggleElement('updateModeCard', false);
        
        // Show success section
        UIUtils.toggleElement('successSection', true);
        
        // Update connection info
        const connectionInfo = document.getElementById('connectionInfo');
        const configUsed = this.customConfig ? 'Custom' : 'Default';
        
        connectionInfo.innerHTML = `
            <div class="grid grid-2">
                <div>
                    <strong>Institution:</strong> ${metadata.institution?.name || 'Unknown'}
                </div>
                <div>
                    <strong>Auth Method:</strong> ${authMethod}
                </div>
                <div>
                    <strong>Link Mode:</strong> ${this.currentMode}
                </div>
                <div>
                    <strong>Configuration:</strong> ${configUsed}
                </div>
                <div>
                    <strong>Accounts:</strong> ${metadata.accounts?.length || 0} connected
                </div>
                <div>
                    <strong>Products:</strong> ${this.customConfig?.products?.join(', ') || 'identity'}
                </div>
            </div>
        `;
        
        // Display token
        const tokenDisplay = document.getElementById('tokenDisplay');
        tokenDisplay.textContent = this.currentAccessToken;
        
        // Scroll to success section
        document.getElementById('successSection').scrollIntoView({ 
            behavior: 'smooth' 
        });
        
        // Clear other status messages
        UIUtils.clearStatus('globalStatus');
        UIUtils.clearStatus('embeddedStatus');
        UIUtils.clearStatus('updateStatus');
    }

    async copyAccessToken() {
        if (this.currentAccessToken) {
            const success = await UIUtils.copyToClipboard(this.currentAccessToken);
            if (success) {
                UIUtils.showNotification('Access token copied to clipboard!', 'success');
            } else {
                UIUtils.showNotification('Failed to copy token', 'error');
            }
        }
    }

    startOver() {
        // Hide all sections
        UIUtils.toggleElement('embeddedContainer', false);
        UIUtils.toggleElement('updateModeCard', false);
        UIUtils.toggleElement('successSection', false);
        
        // Clear all status messages
        UIUtils.clearStatus('globalStatus');
        UIUtils.clearStatus('embeddedStatus');
        UIUtils.clearStatus('updateStatus');
        
        // Reset embedded container
        const container = document.getElementById('linkContainer');
        container.innerHTML = `
            <div class="link-container-placeholder">
                <p><strong>Embedded Link will appear here</strong></p>
                <p>Click "Start Embedded Link" above to begin</p>
            </div>
        `;
        container.style.background = '#f8f9fa';
        
        // Destroy any existing Link instance
        window.plaidLinkManager.destroy();
        
        // Reset state
        this.currentAccessToken = null;
        this.currentMode = null;
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Global functions for onclick handlers
function startStandardLink() {
    window.startPage.startStandardLink();
}

function startEmbeddedLink() {
    window.startPage.startEmbeddedLink();
}

function showUpdateMode() {
    window.startPage.showUpdateMode();
}

function hideUpdateMode() {
    window.startPage.hideUpdateMode();
}

function startUpdateMode() {
    window.startPage.startUpdateMode();
}

function copyAccessToken() {
    window.startPage.copyAccessToken();
}

function copyExistingToken() {
    window.startPage.copyExistingToken();
}

function clearTokenAndStartOver() {
    window.startPage.clearTokenAndStartOver();
}

function setDirectAccessToken() {
    window.startPage.setDirectAccessToken();
}

function startOver() {
    window.startPage.startOver();
}

function viewConfiguration() {
    window.startPage.viewConfiguration();
}

function clearConfiguration() {
    window.startPage.clearConfiguration();
}

function loadPresetConfig(presetType) {
    window.startPage.loadPresetConfig(presetType);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.startPage = new StartPage();
});