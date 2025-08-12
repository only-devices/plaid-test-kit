// public/js/plaid-link.js

class PlaidLinkManager {
    constructor() {
        this.linkHandler = null;
        this.currentMode = null;
        this.isEmbedded = false;
    }

    /**
     * Initialize Plaid Link
     * @param {Object} config - Link configuration
     * @param {string} config.mode - 'standard' or 'embedded' or 'update'
     * @param {string} config.linkToken - Link token from server
     * @param {HTMLElement} config.container - Container for embedded mode (optional)
     * @param {Function} config.onSuccess - Success callback
     * @param {Function} config.onExit - Exit callback
     * @param {Function} config.onEvent - Event callback (optional)
     * @param {Function} config.onLoad - Load callback (optional)
     */
    async initialize(config) {
        const {
            mode = 'standard',
            linkToken,
            container,
            onSuccess,
            onExit,
            onEvent,
            onLoad
        } = config;

        this.currentMode = mode;
        this.isEmbedded = mode === 'embedded';

        const linkConfig = {
            token: linkToken,
            onSuccess: (publicToken, metadata) => {
                console.log('Link success:', { mode, metadata });
                if (onSuccess) onSuccess(publicToken, metadata);
            },
            onExit: (err, metadata) => {
                console.log('Link exit:', { mode, err, metadata });
                if (onExit) onExit(err, metadata);
            },
            onEvent: (eventName, metadata) => {
                console.log('Link event:', { mode, eventName, metadata });
                if (onEvent) onEvent(eventName, metadata);
            },
            onLoad: () => {
                console.log('Link loaded:', { mode });
                if (onLoad) onLoad();
            }
        };

        try {
            if (this.isEmbedded) {
                if (!container) {
                    throw new Error('Container element required for embedded mode');
                }
                
                // Clear container and set proper styling
                container.innerHTML = '<div class="link-container-placeholder"><p><strong>Loading Plaid Link...</strong></p><p>Please wait...</p></div>';
                container.style.background = '#f8f9fa';
                container.style.minHeight = '600px';
                container.style.height = '600px';
                container.style.width = '100%';
                container.style.position = 'relative';
                container.style.overflow = 'hidden';
                
                try {
                    // Check if Plaid.createEmbedded exists
                    if (typeof Plaid.createEmbedded !== 'function') {
                        throw new Error('Plaid.createEmbedded is not available');
                    }
                    
                    console.log('Creating embedded Link with config:', {
                        token: linkToken ? 'present' : 'missing',
                        containerElement: container.tagName
                    });
                    
                    this.linkHandler = Plaid.createEmbedded(linkConfig, container);
                    console.log('Embedded Link created successfully');
                    
                    // Give the embedded Link time to initialize
                    setTimeout(() => {
                        if (container.innerHTML.includes('Loading Plaid Link')) {
                            console.log('Embedded Link still loading after 3 seconds');
                        }
                    }, 3000);
                    
                } catch (embeddedError) {
                    console.warn('Embedded Link failed, falling back to standard Link:', embeddedError);
                    
                    // Update container to show fallback message
                    container.innerHTML = `
                        <div class="link-container-placeholder">
                            <p><strong>Embedded mode not supported</strong></p>
                            <p>Opening standard Link instead...</p>
                            <p style="font-size: 12px; color: #666;">Error: ${embeddedError.message}</p>
                        </div>
                    `;
                    
                    // Fallback to standard Link
                    this.linkHandler = Plaid.create(linkConfig);
                    this.linkHandler.open();
                    this.isEmbedded = false;
                    this.currentMode = 'standard';
                }
            } else {
                // Standard or Update mode
                this.linkHandler = Plaid.create(linkConfig);
                this.linkHandler.open();
            }
            
            return this.linkHandler;
            
        } catch (error) {
            console.error('Failed to initialize Plaid Link:', error);
            throw error;
        }
    }

    /**
     * Open Link (for standard mode)
     */
    open() {
        if (this.linkHandler && !this.isEmbedded) {
            this.linkHandler.open();
        }
    }

    /**
     * Destroy current Link instance
     */
    destroy() {
        if (this.linkHandler && typeof this.linkHandler.destroy === 'function') {
            this.linkHandler.destroy();
        }
        this.linkHandler = null;
        this.currentMode = null;
        this.isEmbedded = false;
    }

/**
     * Create link token with custom configuration support
     * @param {Object} options - Token creation options
     * @param {string} options.mode - 'standard', 'embedded', 'hosted', or 'update'
     * @param {string} options.accessToken - Required for update mode
     * @param {Object} options.custom_config - Custom Link token configuration
     */
    async createLinkToken(options = {}) {
        const { mode = 'standard', accessToken, custom_config } = options;
        
        const tokenRequest = {};
        
        // Include custom configuration if provided
        if (custom_config && typeof custom_config === 'object') {
            Object.assign(tokenRequest, custom_config);
        }
        
        // For hosted mode, include hosted_link object
        if (mode === 'hosted') {
            tokenRequest.hosted_link = {};
        }
        
        // For update mode, include access token and account selection
        if (mode === 'update') {
            if (!accessToken) {
                throw new Error('Access token required for update mode');
            }
            tokenRequest.access_token = accessToken;
            tokenRequest.update_mode = true;
        }
        
        console.log('Creating link token with request:', tokenRequest);
        
        return await window.apiClient.createLinkToken(tokenRequest);
    }

    /**
     * Handle OAuth redirect (if applicable)
     */
    handleOAuthRedirect() {
        // This is handled automatically by the Plaid SDK
        // but we can add custom logic here if needed
        console.log('OAuth redirect handling...');
    }
}

// Create and export singleton
window.plaidLinkManager = new PlaidLinkManager();