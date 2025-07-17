// public/js/layer-manager.js

class LayerManager {
    constructor() {
        this.layerHandler = null;
        this.linkToken = null;  // This will store the link_token for SDK
        this.isSessionCreated = false;
        this.currentPhoneNumber = null;
        this.hasReceivedLayerEvent = false; // Track if any Layer events are received
        this.hasReceivedEligibilityEvent = false; // Track LAYER_READY or LAYER_NOT_AVAILABLE
    }

    /**
     * Initialize Layer session token
     * @param {string} templateId - Layer template ID
     * @param {string} clientUserId - Internal client user ID
     */
    async initializeSession(templateId, clientUserId) {
        // Check if session already exists
        if (this.isSessionCreated && this.linkToken) {
            console.log('Layer session already created, skipping initialization');
            return true;
        }

        console.log('Initializing Layer session from Layer Manager with template ID:', templateId, 'and client user ID:', clientUserId);

        if (!templateId || !clientUserId) {
            throw new Error('Template ID and client user ID are required to create Layer session');
        }

        try {
            console.log('Creating Layer session token...');
            
            const response = await window.apiClient.request('/api/session/token/create', {
                method: 'POST',
                body: JSON.stringify({
                    template_id: templateId,
                    client_user_id: clientUserId
                })
            });

            console.log('Full API response:', response);

            if (response.success) {
                // Handle the nested response structure from Plaid Layer API
                const responseData = response.data || response;
                
                // Extract tokens from the nested structure
                if (responseData.link && responseData.link.link_token) {
                    this.linkToken = responseData.link.link_token;
                    this.isSessionCreated = true;
                    
                    console.log('Layer session token created successfully');
                    console.log('Link token:', this.linkToken);
                    console.log('Token expiration:', responseData.link.expiration);
                    
                    return true;
                } else {
                    console.error('Unexpected response format:', responseData);
                    throw new Error('Invalid response format - missing link.link_token');
                }
            } else {
                throw new Error(response.error || 'Failed to create Layer session');
            }
        } catch (error) {
            console.error('Layer session initialization failed:', error);
            UIUtils.showStatus('layerStatus', `Failed to initialize Layer: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Create Layer instance using the SDK
     */
    async createLayerInstance() {
        if (!this.linkToken) {
            throw new Error('No session token available - please initialize session first');
        }

        try {
            // Check if Plaid Layer SDK is available
            if (!window.Plaid || typeof window.Plaid.create !== 'function') {
                throw new Error('Plaid SDK not available - make sure Link script is loaded');
            }

            console.log('Creating Layer instance with token:', this.linkToken);
            
            // Use Plaid.create for Layer sessions
            this.layerHandler = window.Plaid.create({
                token: this.linkToken,
                onSuccess: (publicToken, metadata) => {
                    console.log('🎉 Layer onSuccess called - Layer flow completed!', { publicToken, metadata });
                    // This is where we get the public_token for successful Layer completion
                    this.handleLayerSuccess({ publicToken, metadata });
                },
                onExit: (err, metadata) => this.handleLayerExit(err, metadata),
                onEvent: (eventName, metadata) => {
                    console.log('🎯 LAYER EVENT CAPTURED:', { eventName, metadata });
                    this.handleLayerEvent(eventName, metadata);
                },
                onLoad: () => {
                    console.log('📱 Layer SDK loaded successfully');
                    this.handleLayerLoad();
                }
            });

            console.log('Layer instance created successfully');
            console.log('Layer handler methods:', Object.getOwnPropertyNames(this.layerHandler));
            return this.layerHandler;
        } catch (error) {
            console.error('Failed to create Layer instance:', error);
            throw error;
        }
    }

    /**
     * Submit phone number to Layer
     * @param {string} phoneNumber - Phone number to submit
     */
    async submitPhoneNumber(phoneNumber) {
        if (!phoneNumber || phoneNumber.trim() === '') {
            throw new Error('Phone number is required');
        }

        // Clean and format phone number
        const cleanedPhone = this.cleanPhoneNumber(phoneNumber);
        this.currentPhoneNumber = cleanedPhone;

        try {
            // Ensure Layer handler is created and ready
            if (!this.layerHandler) {
                console.log('Creating Layer instance...');
                UIUtils.showStatus('layerStatus', 'Initializing Layer...', 'info');
                await this.createLayerInstance();
                
                // Wait a moment for Layer to fully initialize
                console.log('Waiting for Layer initialization...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log('Submitting phone number to Layer:', cleanedPhone);
            console.log('Layer handler available methods:', Object.getOwnPropertyNames(this.layerHandler));
            
            // Check if submit method exists
            if (typeof this.layerHandler.submit !== 'function') {
                throw new Error('Layer handler does not have submit method');
            }
            
            // Reset eligibility event tracking
            this.hasReceivedEligibilityEvent = false;
            
            // Submit phone number - Layer will respond with LAYER_READY or LAYER_NOT_AVAILABLE
            const result = this.layerHandler.submit({
                phone_number: cleanedPhone
            });

            console.log('📱 Layer submit call completed, result:', result);
            UIUtils.showStatus('layerStatus', 'Phone number submitted to Layer - checking eligibility...', 'info');
            
            // Set up timeout to check for Layer response
            setTimeout(() => {
                console.log('⏱️ 8 seconds after submit - checking for Layer eligibility response...');
                if (!this.hasReceivedEligibilityEvent) {
                    console.warn('⚠️ No Layer eligibility response received after 8 seconds');
                    UIUtils.showStatus('layerStatus', 'No response from Layer - this phone number may not be supported', 'warning');
                }
            }, 8000);
            
            return { 
                success: true, 
                phone_number: cleanedPhone,
                note: 'Phone number submitted to Layer - waiting for LAYER_READY or LAYER_NOT_AVAILABLE'
            };
            
        } catch (error) {
            console.error('Layer phone submission failed:', error);
            throw error;
        }
    }

    /**
     * Open Layer session
     */
    async openLayerSession() {
        if (!this.layerHandler) {
            throw new Error('Layer instance not created');
        }

        try {
            console.log('Opening Layer session...');
            await this.layerHandler.open();
            console.log('Layer session opened successfully');
        } catch (error) {
            console.error('Failed to open Layer session:', error);
            throw error;
        }
    }

    /**
     * Destroy Layer session
     */
    destroyLayerSession() {
        if (this.layerHandler && typeof this.layerHandler.destroy === 'function') {
            console.log('Destroying Layer session...');
            this.layerHandler.destroy();
            this.layerHandler = null;
        }
    }

    /**
     * Clean and format phone number
     * @param {string} phoneNumber - Raw phone number input
     * @returns {string} Cleaned phone number
     */
    cleanPhoneNumber(phoneNumber) {
        // Remove all non-digit characters
        const digits = phoneNumber.replace(/\D/g, '');
        
        // Add country code if missing (assume US +1)
        if (digits.length === 10) {
            return `+1${digits}`;
        } else if (digits.length === 11 && digits.startsWith('1')) {
            return `+${digits}`;
        } else if (digits.length > 10) {
            return `+${digits}`;
        }
        
        return phoneNumber; // Return as-is if can't determine format
    }

    /**
     * Handle Layer events
     * @param {string} eventName - Event name
     * @param {Object} metadata - Event metadata
     */
    handleLayerEvent(eventName, metadata) {
        console.log('🎯 Layer event received:', { eventName, metadata });
        this.hasReceivedLayerEvent = true;
        
        // Handle Layer-specific events (only LAYER_READY and LAYER_NOT_AVAILABLE per docs)
        switch (eventName) {
            case 'LAYER_READY':
                console.log('✅ Layer is ready - Layer flow should start automatically');
                this.hasReceivedEligibilityEvent = true;
                UIUtils.showStatus('layerStatus', 'Layer is ready! The Layer flow should start automatically...', 'success');
                UIUtils.showNotification('Layer is available for your phone number! Loading the Layer UI now...', 'success');
                
                // Note: According to docs, we don't need to call open() - Layer flow starts automatically
                // But if no UI appears, we might need to call open() manually
                console.log('🔍 Checking if Layer UI appears automatically...');
                setTimeout(() => {
                    console.log('⏰ 3 seconds after LAYER_READY - checking if we need to manually open Layer...');
                    // If no UI has appeared, try opening manually
                    if (this.layerHandler && typeof this.layerHandler.open === 'function') {
                        console.log('🚀 Manually opening Layer session...');
                        this.layerHandler.open();
                        UIUtils.showStatus('layerStatus', 'Opening Layer session manually...', 'info');
                    }
                }, 3000);
                break;
                
            case 'LAYER_NOT_AVAILABLE':
                console.log('❌ Layer is not available for this phone number');
                this.hasReceivedEligibilityEvent = true;
                UIUtils.showStatus('layerStatus', 'Layer is not available for this phone number', 'warning');
                UIUtils.showNotification('Layer is not available for this phone number. Please try another Link option.', 'warning', 6000);
                this.destroyLayerSession();
                break;
                
            // General Link events
            case 'OPEN':
                console.log('🔗 Layer Link session opened');
                UIUtils.showStatus('layerStatus', 'Layer session is starting...', 'info');
                break;
                
            case 'EXIT':
                console.log('🚪 Layer Link session exited');
                UIUtils.showStatus('layerStatus', 'Layer session was cancelled', 'info');
                break;
                
            case 'ERROR':
                console.error('💥 Link error in Layer session:', metadata);
                UIUtils.showStatus('layerStatus', `Layer error: ${metadata.error_message || 'Unknown error'}`, 'error');
                break;
                
            // Debug: Log all other events to see what's happening
            default:
                console.log(`🔍 Other Layer/Link event: ${eventName}`, metadata);
        }
    }

    /**
     * Handle Layer exit
     * @param {Object} err - Error object (if any)
     * @param {Object} metadata - Exit metadata
     */
    handleLayerExit(err, metadata) {
        console.log('Layer exit:', { err, metadata });
        
        if (err) {
            UIUtils.showStatus('layerStatus', `Layer session ended with error: ${err.error_message || err.message}`, 'error');
        } else {
            UIUtils.showStatus('layerStatus', 'Layer session was cancelled by user', 'info');
        }
        
        this.destroyLayerSession();
    }

    /**
     * Handle Layer load
     */
    handleLayerLoad() {
        console.log('Layer loaded successfully');
        UIUtils.showStatus('layerStatus', 'Layer SDK loaded successfully', 'success');
    }

    /**
     * Handle successful Layer completion
     * @param {Object} data - Success data containing publicToken and metadata
     */
    async handleLayerSuccess(data) {
        try {
            console.log('🎉 Processing Layer success:', data);
            
            const { publicToken, metadata } = data;
            
            if (!publicToken) {
                console.error('No public token in Layer success data');
                UIUtils.showStatus('layerStatus', 'Layer completed but no token received', 'error');
                return;
            }
            
            UIUtils.showStatus('layerStatus', 'Layer completed successfully! Retrieving user data...', 'success');
            
            // For Layer, we might need to use the publicToken instead of the session token
            console.log('🔍 Trying to get session results with public token:', publicToken);
            
            // Try with the public token first (Layer might return a different token type)
            const results = await this.getSessionResultsWithToken(publicToken);
            
            // Show success section (reuse existing pattern)
            if (window.startPage && typeof window.startPage.showLayerSuccess === 'function') {
                window.startPage.showLayerSuccess(results, { 
                    ...metadata, 
                    publicToken,
                    auth_type: 'layer' 
                });
            } else {
                console.log('Layer completion results:', results);
                UIUtils.showNotification('Layer session completed successfully!', 'success');
            }
        } catch (error) {
            console.error('Error handling Layer success:', error);
            UIUtils.showStatus('layerStatus', `Failed to retrieve session results: ${error.message}`, 'error');
        }
    }

    /**
     * Get Layer session results with a specific token
     */
    async getSessionResultsWithToken(token) {
        try {
            console.log('Retrieving Layer session results with public_token:', token);
            
            const response = await window.apiClient.request('/api/user_account/session/get', {
                method: 'POST',
                body: JSON.stringify({
                    public_token: token  // Layer uses public_token, not session_token
                })
            });

            if (response.success) {
                console.log('Layer session results retrieved:', response);
                return response;
            } else {
                throw new Error(response.error || 'Failed to retrieve session results');
            }
        } catch (error) {
            console.error('Failed to get Layer session results:', error);
            throw error;
        }
    }

    /**
     * Reset Layer state
     */
    reset() {
        this.destroyLayerSession();
        this.linkToken = null;
        this.isSessionCreated = false;
        this.currentPhoneNumber = null;
    }
}

// Create and export singleton
window.layerManager = new LayerManager();