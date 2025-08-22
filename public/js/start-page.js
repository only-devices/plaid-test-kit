class StartPage {
    constructor() {
        this.currentAccessToken = null;
        this.currentMode = null;
        this.customConfig = null;
        this.hostedLinkData = null; // Store hosted link session data
        this.init();
    }

    async init() {
        // Check if we have an existing token and configuration
        window.accountManager.checkExistingToken();

        // Check if we're returning from a hosted link session
        this.checkHostedLinkCompletion();

        // Check for custom configuration
        await this.checkCustomConfiguration();
    }

    checkHostedLinkCompletion() {
        // Check if we're returning from a hosted link session
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('hosted_complete') === 'true') {
            // Check for stored hosted link session data
            const storedData = localStorage.getItem('plaid_hosted_link_session');
            if (storedData) {
                try {
                    this.hostedLinkData = JSON.parse(storedData);
                    this.processHostedLinkCompletion();
                } catch (error) {
                    console.error('Failed to parse stored hosted link data:', error);
                    UIUtils.showStatus('globalStatus', 'Error processing hosted link completion', 'error');
                }
            } else {
                UIUtils.showStatus('globalStatus', 'Hosted link session completed, but no session data found', 'warning');
            }

            // Clean up URL
            window.history.replaceState({}, document.title, '/');
        }
    }

    async copyBaseUrl() {
        const baseUrlElement = document.getElementById('baseUrl');
        const copyBaseUrlBtn = document.getElementById('copyBaseUrlBtn');
        const originalText = copyBaseUrlBtn.textContent;

        if (!baseUrlElement) {
            console.error('Base URL element not found');
            return;
        }

        const baseUrl = baseUrlElement.textContent.trim();

        try {
            // Copy to clipboard
            await navigator.clipboard.writeText(baseUrl);

            // Update button to show success
            copyBaseUrlBtn.textContent = 'Copied!';
            copyBaseUrlBtn.classList.add('copied');

            // Show notification
            UIUtils.showNotification('OAuth redirect URI copied to clipboard!', 'success');

            // Reset button after 2 seconds
            setTimeout(() => {
                copyBaseUrlBtn.textContent = originalText;
                copyBaseUrlBtn.classList.remove('copied');
            }, 2000);

        } catch (error) {
            console.error('Failed to copy URL:', error);

            // Fallback: select the text for manual copying
            const range = document.createRange();
            range.selectNode(baseUrlElement);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);

            // Update button to show fallback
            copyBaseUrlBtn.textContent = 'Selected - Press Ctrl+C';

            UIUtils.showNotification('Please use Ctrl+C to copy the selected URL', 'warning');

            // Reset button after 3 seconds
            setTimeout(() => {
                window.getSelection().removeAllRanges();
                copyBaseUrlBtn.textContent = originalText;
            }, 3000);
        }
    }

    async processHostedLinkCompletion() {
        try {
            UIUtils.showStatus('globalStatus', 'Processing hosted link completion...', 'info');

            if (!this.hostedLinkData || !this.hostedLinkData.link_token) {
                throw new Error('No link token found in session data');
            }

            // Get the link token details to retrieve the public token
            const response = await window.apiClient.getLinkToken(this.hostedLinkData.link_token);

            if (response.success && response.has_completed_session && response.public_token) {
                // Exchange the public token for an access token
                const exchangeResponse = await window.apiClient.exchangePublicToken(response.public_token);

                if (exchangeResponse.success) {
                    this.currentAccessToken = exchangeResponse.access_token;

                    // Show success with hosted link specific messaging
                    const metadata = response.metadata || {};
                    metadata.auth_type = 'hosted'; // Mark as hosted link

                    this.showSuccessSection(metadata, 'Hosted Link');

                    UIUtils.showNotification('Hosted Link connection successful!', 'success');
                } else {
                    throw new Error(exchangeResponse.error);
                }
            } else if (!response.has_completed_session) {
                UIUtils.showStatus('globalStatus', 'Hosted link session was not completed successfully', 'warning');
            } else {
                throw new Error('No public token found in completed session');
            }
        } catch (error) {
            console.error('Hosted link completion error:', error);
            UIUtils.showStatus('globalStatus', `Failed to process hosted link completion: ${error.message}`, 'error');
        } finally {
            // Clean up stored session data
            localStorage.removeItem('plaid_hosted_link_session');
            this.hostedLinkData = null;
        }
    }

    async checkCustomConfiguration() {
        try {
            // First check localStorage for saved configuration
            const storedConfig = this.getStoredConfiguration();
            if (storedConfig) {
                this.customConfig = storedConfig;
                this.showConfigurationBanner();
                this.updateConfigStatus();
                return;
            }

            // Then check server for custom configuration
            const health = await window.apiClient.getStatus();
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

    showConfigurationBanner() {
        const banner = document.getElementById('configBanner');
        if (banner && this.customConfig) {
            banner.classList.remove('hidden');

            // Update summary
            const summary = document.getElementById('configSummary');
            const productCount = this.customConfig.products ? this.customConfig.products.length : 0;
            const countryCount = this.customConfig.country_codes ? this.customConfig.country_codes.length : 0;

            // NEW: Include additional consented products in summary
            const additionalConsentedCount = this.customConfig.additional_consented_products ? this.customConfig.additional_consented_products.length : 0;
            const additionalText = additionalConsentedCount > 0 ? ` + ${additionalConsentedCount} additional consented` : '';

            // Check if this is from localStorage
            const storedConfig = this.getStoredConfiguration();
            const configName = storedConfig ? this.getStoredConfigurationName() : 'Server Configuration';

            summary.textContent = `${configName} - ${productCount} product(s)${additionalText} and ${countryCount} country code(s)`;
        }
    }

    updateConfigStatus() {
        const statusEl = document.getElementById('configStatus');
        if (!statusEl) return;

        // Check for localStorage configurations first
        const storedConfig = this.getStoredConfiguration();
        const displayConfig = storedConfig || this.customConfig;
        const formattedConfig = UIUtils.syntaxHighlight(displayConfig);

        if (displayConfig) {
            statusEl.innerHTML = `<div class="json-block json-editor">${formattedConfig}</div>`;
            
        } else {
            // Default configuration display
            statusEl.innerHTML = `<div class="json-editor json-block">
{
    <span class="key">"products"</span>: [
    <span class="string">"auth"</span>
    ],
    <span class="key">"client_name"</span>: <span class="string">"Plaid Test Kit"</span>,
    <span class="key">"country_codes"</span>: [
    <span class="string">"US"</span>
    ],
    <span class="key">"language"</span>: <span class="string">"en"</span>,
    <span class="key">"user"</span>: {
    <span class="key">"client_user_id"</span>: <span class="string">"clever_fox_24"</span>
    }
}</div>`;
        }
    }

    getStoredConfiguration() {
        try {
            const storedConfig = localStorage.getItem('plaid_link_config');
            return storedConfig ? JSON.parse(storedConfig) : null;
        } catch (error) {
            console.error('Failed to parse stored configuration:', error);
            return null;
        }
    }

    getStoredConfigurationName() {
        try {
            const configName = localStorage.getItem('plaid_link_config_name');
            return configName || 'Saved Configuration';
        } catch (error) {
            console.error('Failed to get stored configuration name:', error);
            return 'Saved Configuration';
        }
    }

    setStoredConfiguration(config, name = 'Custom Configuration') {
        try {
            localStorage.setItem('plaid_link_config', JSON.stringify(config));
            localStorage.setItem('plaid_link_config_name', name);
            this.customConfig = config;
            this.updateConfigStatus();
            this.showConfigurationBanner();
        } catch (error) {
            console.error('Failed to store configuration:', error);
        }
    }

    clearStoredConfiguration() {
        try {
            localStorage.removeItem('plaid_link_config');
            localStorage.removeItem('plaid_link_config_name');
            this.customConfig = null;
            this.updateConfigStatus();

            // Hide banner if it exists
            const banner = document.getElementById('configBanner');
            if (banner) {
                banner.classList.add('hidden');
            }
        } catch (error) {
            console.error('Failed to clear stored configuration:', error);
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
                window.plaidLinkManager.destroy();
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
                window.plaidLinkManager.destroy();
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

    async startHostedLink() {
        try {
            this.currentMode = 'hosted';
            UIUtils.showStatus('globalStatus', 'Creating Hosted Link session...', 'info');

            // Create link token for hosted mode with custom config
            const tokenResponse = await window.plaidLinkManager.createLinkToken({
                mode: 'hosted',
                custom_config: this.customConfig
            });

            if (!tokenResponse.success) {
                window.plaidLinkManager.destroy();
                throw new Error(tokenResponse.error);
            }

            if (!tokenResponse.hosted_link_url) {
                throw new Error('No hosted link URL returned from server');
            }

            // Store session data for completion handling
            this.hostedLinkData = {
                link_token: tokenResponse.link_token,
                hosted_link_url: tokenResponse.hosted_link_url,
                created_at: new Date().toISOString()
            };

            // Store in localStorage to persist across page refreshes
            localStorage.setItem('plaid_hosted_link_session', JSON.stringify(this.hostedLinkData));

            // Show hosted link section
            UIUtils.toggleElement('hostedLinkCard', true);

            // Update the hosted link info
            const hostedLinkInfo = document.getElementById('hostedLinkInfo');
            hostedLinkInfo.innerHTML = `
                <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <p style="margin: 0 0 8px 0;"><strong>✅ Hosted Link session created successfully!</strong></p>
                    <p style="margin: 0; font-size: 14px; color: #166534;">Click "Open Hosted Link" to start the connection process in a new tab.</p>
                </div>
                <div style="background: #fef3c7; padding: 12px; border-radius: 8px; font-size: 13px; color: #92400e;">
                    <strong>Note:</strong> After completing the connection in the new tab, you'll be redirected back here automatically.
                </div>
            `;

            // Store the URL in the button for easy access
            document.getElementById('openHostedLink').dataset.url = tokenResponse.hosted_link_url;

            // Scroll to hosted link section
            document.getElementById('hostedLinkCard').scrollIntoView({
                behavior: 'smooth'
            });

            UIUtils.showStatus('globalStatus', 'Hosted Link session ready! Click "Open Hosted Link" to continue.', 'success');

        } catch (error) {
            UIUtils.showStatus('globalStatus', `Failed to start Hosted Link: ${error.message}`, 'error');
        }
    }

    openHostedLinkUrl() {
        if (this.hostedLinkData && this.hostedLinkData.hosted_link_url) {
            // Open in new tab
            window.open(this.hostedLinkData.hosted_link_url, '_blank');

            UIUtils.showStatus('hostedLinkStatus', 'Hosted Link opened in new tab. Complete the connection there and you\'ll be redirected back here.', 'info');

            // Start polling for completion (optional - the redirect will handle it)
            this.startHostedLinkPolling();
        } else {
            UIUtils.showStatus('hostedLinkStatus', 'No hosted link URL available', 'error');
        }
    }

    async checkHostedLinkStatus() {
        if (!this.hostedLinkData || !this.hostedLinkData.link_token) {
            UIUtils.showStatus('hostedLinkStatus', 'No active hosted link session', 'error');
            return;
        }

        try {
            UIUtils.setButtonLoading(event.target, true, 'Checking...');

            const response = await window.apiClient.getLinkToken(this.hostedLinkData.link_token);

            if (response.success) {
                if (response.has_completed_session && response.public_token) {
                    UIUtils.showStatus('hostedLinkStatus', 'Session completed! Processing connection...', 'success');

                    // Process the completion
                    await this.processHostedLinkCompletion();
                } else {
                    const sessionCount = response.link_sessions ? response.link_sessions.length : 0;
                    UIUtils.showStatus('hostedLinkStatus', `Session active. ${sessionCount} session(s) found. No completion yet.`, 'info');
                }
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            UIUtils.showStatus('hostedLinkStatus', `Failed to check status: ${error.message}`, 'error');
        } finally {
            UIUtils.setButtonLoading(event.target, false);
        }
    }

    startHostedLinkPolling() {
        // Poll every 5 seconds for completion (optional fallback)
        if (this.hostedLinkPollingInterval) {
            clearInterval(this.hostedLinkPollingInterval);
        }

        this.hostedLinkPollingInterval = setInterval(() => {
            try {
                const response = window.apiClient.getLinkToken(this.hostedLinkData.link_token);

                if (response.success && response.has_completed_session && response.public_token) {
                    clearInterval(this.hostedLinkPollingInterval);
                    this.hostedLinkPollingInterval = null;

                    // Don't auto-process here - let the redirect handle it
                    console.log('Hosted link completion detected via polling');
                }
            } catch (error) {
                console.log('Polling error (expected):', error.message);
            }
        }, 5000);
    }

    cancelHostedLink() {
        // Clean up hosted link session
        if (this.hostedLinkPollingInterval) {
            clearInterval(this.hostedLinkPollingInterval);
            this.hostedLinkPollingInterval = null;
        }

        localStorage.removeItem('plaid_hosted_link_session');
        this.hostedLinkData = null;

        // Hide hosted link section
        UIUtils.toggleElement('hostedLinkCard', false);

        // Clear status
        UIUtils.clearStatus('globalStatus');
        UIUtils.clearStatus('hostedLinkStatus');

        UIUtils.showNotification('Hosted Link session cancelled', 'info');
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
    viewConfiguration() {
        window.location.href = '/link-config.html';
    }

    async clearConfiguration() {
        try {
            // Clear both server and localStorage configurations
            await window.apiClient.request('/api/clear-link-config', {
                method: 'POST'
            });

            this.clearStoredConfiguration();

            UIUtils.showNotification('Configuration cleared - using defaults', 'success');
        } catch (error) {
            // Even if server fails, still clear localStorage
            this.clearStoredConfiguration();
            UIUtils.showNotification('Local configuration cleared (server may have failed)', 'warning');
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
            'ABI': {
                products: ['transactions', 'identity', 'auth'],
                client_name: 'Plaid Test Kit - ABI (Auth, Balance, Identity)',
                country_codes: ['US'],
                language: 'en'
                // NEW: Example of adding additional consented products to a preset
                // additional_consented_products: ['assets', 'income']
            }
        };

        const config = presets[presetType];
        if (!config) {
            UIUtils.showNotification(`Preset "${presetType}" not found`, 'error');
            return;
        }

        try {
            // Save to localStorage with preset name
            const presetName = `${presetType.toUpperCase()} Preset`;
            this.setStoredConfiguration(config, presetName);

            // Also save to server
            const response = await window.apiClient.request('/api/set-link-config', {
                method: 'POST',
                body: JSON.stringify({ config })
            });

            if (response.success) {
                UIUtils.showNotification(`Loaded "${presetName}" configuration`, 'success');
            } else {
                // If server fails, still keep localStorage version
                console.warn('Failed to save to server, but localStorage config is active');
                UIUtils.showNotification(`Loaded "${presetName}" configuration (local only)`, 'warning');
            }
        } catch (error) {
            UIUtils.showNotification(`Failed to load preset: ${error.message}`, 'error');
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

    /**
     * Initialize Layer session token
     */
    async initializeLayerSession() {
        const templateInput = document.getElementById('layerTemplateIdInput');
        const templateId = templateInput.value.trim();

        const userIdInput = document.getElementById('layerUserIdInput');
        const userId = userIdInput.value.trim();

        if (!templateId) {
            UIUtils.showStatus('layerStatus', 'Please enter your Layer template ID', 'error');
            templateInput.focus();
            return;
        }

        if (!userId) {
            UIUtils.showStatus('layerStatus', 'Please enter a client user ID', 'error');
            userIdInput.focus();
            return;
        }

        console.log('Initializing Layer session from Start Page with template ID:', templateId, 'and user ID:', userId);

        try {
            const initButton = document.getElementById('layerInitButton');
            UIUtils.setButtonLoading(initButton, true, 'Checking eligibility...');

            UIUtils.showStatus('layerStatus', 'Initializing Layer with the provided parameters...', 'info');

            // Submit template ID and user ID to Layer
            const result = await window.layerManager.initializeSession(templateId, userId);

            console.log('Layer submit result:', result);

            // Update status to indicate we're waiting for Layer events
            UIUtils.showStatus('layerStatus', 'Layer initilized, now submit a phone number...', 'info');
            // Make step two of the instructions visible
            UIUtils.toggleElement('layerStepTwo', true);

        } catch (error) {
            UIUtils.showStatus('layerStatus', `Error: ${error.message}`, 'error');
            console.error('Layer init error:', error);
        } finally {
            const initButton = document.getElementById('layerInitButton');
            UIUtils.setButtonLoading(initButton, false);
        }
    }

    /**
     * Start Layer flow
     */
    async startLayer() {
        try {
            this.currentMode = 'layer';

            // Show Layer section
            UIUtils.toggleElement('layerContainer', true);

            // Scroll to Layer section
            document.getElementById('layerContainer').scrollIntoView({
                behavior: 'smooth'
            });

            // Focus on template ID input
            document.getElementById('layerTemplateIdInput').focus();

            UIUtils.showStatus('layerStatus', 'Provide the required parameters to launch Layer', 'info');

        } catch (error) {
            UIUtils.showStatus('layerStatus', `Failed to start Layer: ${error.message}`, 'error');
        }
    }

    /**
     * Submit phone number to Layer
     */
    async submitLayerPhone() {
        const phoneInput = document.getElementById('layerPhoneInput');
        const phoneNumber = phoneInput.value.trim();

        if (!phoneNumber) {
            UIUtils.showStatus('layerStatus', 'Please enter a phone number', 'error');
            phoneInput.focus();
            return;
        }

        try {
            const submitButton = document.getElementById('layerSubmitButton');
            UIUtils.setButtonLoading(submitButton, true, 'Checking eligibility...');

            UIUtils.showStatus('layerStatus', 'Submitting phone number to Layer...', 'info');

            // Submit phone number to Layer
            const result = await window.layerManager.submitPhoneNumber(phoneNumber);

            console.log('Layer submit result:', result);

            // Update status to indicate we're waiting for Layer events
            UIUtils.showStatus('layerStatus', 'Phone number submitted. Checking Layer eligibility...', 'info');

            // The Layer SDK will handle the response and trigger appropriate events
            // through the LayerManager event handlers - no need to process result here

        } catch (error) {
            UIUtils.showStatus('layerStatus', `Error: ${error.message}`, 'error');
            console.error('Layer phone submission error:', error);
        } finally {
            const submitButton = document.getElementById('layerSubmitButton');
            UIUtils.setButtonLoading(submitButton, false);
        }
    }

    /**
     * Show Layer success results
     * @param {Object} results - Layer session results
     * @param {Object} metadata - Success metadata
     */
    showLayerSuccess(results, metadata) {
        // Hide other sections
        UIUtils.toggleElement('layerContainer', false);
        UIUtils.toggleElement('embeddedContainer', false);
        UIUtils.toggleElement('updateModeCard', false);
        UIUtils.toggleElement('hostedLinkCard', false);

        // Show success section
        UIUtils.toggleElement('successSection', true);

        // Extract Layer-specific data
        const identity = results.identity || {};
        const items = results.items || [];
        const accessTokens = results.access_tokens || [];

        // If we have access tokens, set the first one for use in other modules
        if (accessTokens.length > 0) {
            this.currentAccessToken = accessTokens[0];
            console.log('🔑 Access token available for other modules:', this.currentAccessToken);

            // Set the access token on the server for use in other test modules
            window.apiClient.setAccessToken(this.currentAccessToken).then(() => {
                console.log('✅ Access token set on server for other modules');
            }).catch(error => {
                console.warn('⚠️ Failed to set access token on server:', error);
            });
        }

        // Update connection info for Layer
        const connectionInfo = document.getElementById('connectionInfo');

        connectionInfo.innerHTML = `
            <div class="grid grid-2">
                <div>
                    <strong>Connection Type:</strong> Plaid Layer
                </div>
                <div>
                    <strong>Phone Number:</strong> ${window.layerManager.currentPhoneNumber || identity.phone_number || 'Unknown'}
                </div>
                <div>
                    <strong>User Name:</strong> ${identity.name ? `${identity.name.first_name} ${identity.name.last_name}` : 'Available'}
                </div>
                <div>
                    <strong>Email:</strong> ${identity.email || 'Available'}
                </div>
                <div>
                    <strong>Items Connected:</strong> ${items.length}
                </div>
                <div>
                    <strong>Access Tokens:</strong> ${accessTokens.length}
                </div>
            </div>
        `;

        // Display Layer results (identity + items info)
        const tokenDisplay = document.getElementById('tokenDisplay');
        const displayData = {
            identity: identity,
            items: items,
            access_tokens: accessTokens,
            layer_public_token: metadata.publicToken
        };
        tokenDisplay.textContent = JSON.stringify(displayData, null, 2);

        // Update copy button behavior for Layer results
        const copyButton = document.querySelector('button[onclick="copyAccessToken()"]');
        if (copyButton) {
            copyButton.textContent = 'Copy Layer Results';
            copyButton.onclick = () => this.copyLayerResults();
        }

        // Scroll to success section
        document.getElementById('successSection').scrollIntoView({
            behavior: 'smooth'
        });

        // Clear other status messages
        UIUtils.clearStatus('globalStatus');
        UIUtils.clearStatus('layerStatus');
        UIUtils.clearStatus('embeddedStatus');
        UIUtils.clearStatus('updateStatus');
        UIUtils.clearStatus('hostedLinkStatus');

        // Show notification with next steps
        UIUtils.showNotification('Layer completed! You can now test other API modules with the connected account.', 'success', 6000);
    }

    /**
     * Copy Layer results to clipboard
     */
    async copyLayerResults() {
        try {
            const results = await window.layerManager.getSessionResults();
            const resultsText = JSON.stringify(results.data || {}, null, 2);

            const success = await UIUtils.copyToClipboard(resultsText);
            if (success) {
                UIUtils.showNotification('Layer results copied to clipboard!', 'success');
            } else {
                UIUtils.showNotification('Failed to copy results', 'error');
            }
        } catch (error) {
            UIUtils.showNotification('Failed to copy results', 'error');
            console.error('Copy Layer results error:', error);
        }
    }

    showSuccessSection(metadata, authMethod) {
        // Hide other sections
        UIUtils.toggleElement('embeddedContainer', false);
        UIUtils.toggleElement('updateModeCard', false);
        UIUtils.toggleElement('hostedLinkCard', false);

        // Show success section
        UIUtils.toggleElement('successSection', true);

        // Update connection info
        const connectionInfo = document.getElementById('connectionInfo');
        const configUsed = this.customConfig ? 'Custom' : 'Default';

        // NEW: Display additional consented products if present
        const mainProducts = this.customConfig?.products?.join(', ') || 'auth';
        const additionalProducts = this.customConfig?.additional_consented_products;
        const productsDisplay = additionalProducts && additionalProducts.length > 0
            ? `${mainProducts} + ${additionalProducts.join(', ')} (additional)`
            : mainProducts;

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
                    <strong>Products:</strong> ${productsDisplay}
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
        UIUtils.clearStatus('hostedLinkStatus');
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

    startPageStartOver() {
        // Hide all sections
        UIUtils.toggleElement('embeddedContainer', false);
        UIUtils.toggleElement('updateModeCard', false);
        UIUtils.toggleElement('successSection', false);
        UIUtils.toggleElement('layerContainer', false); // Add Layer container

        // Clear all status messages
        UIUtils.clearStatus('globalStatus');
        UIUtils.clearStatus('embeddedStatus');
        UIUtils.clearStatus('updateStatus');
        UIUtils.clearStatus('layerStatus'); // Add Layer status

        // Reset embedded container
        const container = document.getElementById('linkContainer');
        if (container) {
            container.innerHTML = `
            <div class="link-container-placeholder">
                <p><strong>Embedded Link will appear here</strong></p>
                <p>Click "Start Embedded Link" above to begin</p>
            </div>
        `;
            container.style.background = '#f8f9fa';
        }

        // Reset Layer container
        const layerPhoneInput = document.getElementById('layerPhoneInput');
        if (layerPhoneInput) {
            layerPhoneInput.value = '';
        }

        // Destroy any existing Link or Layer instances
        window.plaidLinkManager.destroy();
        window.layerManager.reset();

        // Reset state
        this.currentAccessToken = null;
        this.currentMode = null;

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// Global functions for onclick handlers
function copyBaseUrl() {
    window.startPage.copyBaseUrl();
}

function startStandardLink() {
    window.startPage.startStandardLink();
}

function startEmbeddedLink() {
    window.startPage.startEmbeddedLink();
}

function startHostedLink() {
    window.startPage.startHostedLink();
}

function openHostedLinkUrl() {
    window.startPage.openHostedLinkUrl();
}

function checkHostedLinkStatus() {
    window.startPage.checkHostedLinkStatus();
}

function cancelHostedLink() {
    window.startPage.cancelHostedLink();
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

function setDirectAccessToken() {
    window.startPage.setDirectAccessToken();
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

function startLayer() {
    window.startPage.startLayer();
}

function initializeLayerSession() {
    window.startPage.initializeLayerSession();
}

function submitLayerPhone() {
    window.startPage.submitLayerPhone();
}

function copyLayerResults() {
    window.startPage.copyLayerResults();
}

function startPageStartOver() {
    window.startPage.startPageStartOver();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.startPage = new StartPage();
});