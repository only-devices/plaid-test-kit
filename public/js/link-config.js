// public/js/link-config.js

// Plaid products configuration
const PLAID_PRODUCTS = [
    {
        id: 'auth',
        name: 'Auth',
        description: 'Access to account and routing numbers for ACH'
    },
    {
        id: 'balance',
        name: 'Balance',
        description: 'Access to account balances'
    },
    {
        id: 'identity',
        name: 'Identity',
        description: 'Access to identity information like names, emails, phone numbers, and addresses'
    },
    {
        id: 'transactions',
        name: 'Transactions',
        description: 'Access to account transactions and history'
    },
    {
        id: 'assets',
        name: 'Assets',
        description: 'Access to asset reports for income verification'
    },
    {
        id: 'investments',
        name: 'Investments',
        description: 'Access to investment account data and holdings'
    }
];

class LinkTokenConfig {
    constructor() {
        this.config = this.getDefaultConfig();
        this.isAdvancedMode = false;
        this.init();
    }

    async init() {
        // Display webhook URL
        this.displayWebhookUrl();
        this.renderProductsTable();
        this.setupEventListeners();
        await this.loadExistingConfig();
    }

    getDefaultConfig() {
        return {
            products: ['auth'],
            optional_products: [],
            required_if_supported_products: [],
            additional_consented_products: [],
            client_name: 'Plaid Test Kit',
            link_customization_name: '',
            country_codes: ['US'],
            language: 'en',
            user: {
                client_user_id: 'test-kit-user-' + Date.now(),
                phone_number: '',
            }
        };
    }

    async loadExistingConfig() {
        try {
            // First check localStorage
            const storedConfig = localStorage.getItem('plaid_link_config');
            if (storedConfig) {
                try {
                    const parsedConfig = JSON.parse(storedConfig);
                    this.config = { ...this.getDefaultConfig(), ...parsedConfig };
                    this.updateUIFromConfig();

                    const configName = localStorage.getItem('plaid_link_config_name') || 'Saved Configuration';
                    UIUtils.showStatus('configStatus', `Loaded "${configName}" from local storage`, 'info');
                    return;
                } catch (parseError) {
                    console.error('Failed to parse localStorage config:', parseError);
                    localStorage.removeItem('plaid_link_config');
                    localStorage.removeItem('plaid_link_config_name');
                }
            }

            // Then check server
            const response = await window.apiClient.getStatus();
            if (response.has_custom_link_config && response.custom_link_config) {
                this.config = { ...this.getDefaultConfig(), ...response.custom_link_config };
                this.updateUIFromConfig();
                UIUtils.showStatus('configStatus', 'Loaded existing configuration from server', 'info');
            }
        } catch (error) {
            console.log('No existing config found:', error);
        }
    }

    savePreset() {
        const presetName = prompt('Enter a name for this preset:');
        if (!presetName) return;

        const finalConfig = this.getFinalConfig();

        // Save as the active configuration that start page will detect
        localStorage.setItem('plaid_link_config', JSON.stringify(finalConfig));
        localStorage.setItem('plaid_link_config_name', presetName);

        UIUtils.showNotification(`Preset "${presetName}" saved and activated!`, 'success');
        UIUtils.showStatus('configStatus', `Preset "${presetName}" saved as active configuration`, 'success');

        console.log('Available presets:', Object.keys(presets));
    }

    updateUIFromConfig() {
        // Update basic inputs
        document.getElementById('clientName').value = this.config.client_name || 'Plaid Test Kit';
        document.getElementById('linkCustomizationName').value = this.config.link_customization_name || '';
        document.getElementById('language').value = this.config.language || 'en';

        // Update user inputs
        document.getElementById('clientUserId').value = this.config.user.client_user_id || '';
        document.getElementById('phoneNumber').value = this.config.user.phone_number || '';

        // Update country checkboxes
        document.getElementById('countryCodesInput').value = (this.config.country_codes || []).join(',');

        // Update products table
        this.renderProductsTable();
    }

    renderProductsTable() {
        const tbody = document.getElementById('productsTableBody');
        if (!tbody) {
            console.error('Products table body not found');
            return;
        }

        tbody.innerHTML = '';

        PLAID_PRODUCTS.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="product-name">${product.name}</div>
                    <div class="product-description">${product.description}</div>
                </td>
                <td style="text-align: center;">
                    <input type="checkbox" class="product-checkbox product-include" data-product="${product.id}" ${this.config.products.includes(product.id) ? 'checked' : ''}>
                </td>
                <td style="text-align: center;">
                    <input type="checkbox" class="product-checkbox product-optional" data-product="${product.id}" ${this.config.optional_products.includes(product.id) ? 'checked' : ''}>
                </td>
                <td style="text-align: center;">
                    <input type="checkbox" class="product-checkbox product-required-if-supported" data-product="${product.id}" ${this.config.required_if_supported_products.includes(product.id) ? 'checked' : ''}>
                </td>
                <td style="text-align: center;">
                    <input type="checkbox" class="product-checkbox product-additional-consented" data-product="${product.id}" ${this.config.additional_consented_products.includes(product.id) ? 'checked' : ''}>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    setupEventListeners() {
        // Advanced mode toggle
        document.getElementById('advancedToggle').addEventListener('click', () => {
            this.toggleAdvancedMode();
        });

        // Product checkboxes
        document.addEventListener('change', (e) => {
            if (e.target.matches('.product-include')) {
                this.handleProductInclude(e.target);
            } else if (e.target.matches('.product-optional')) {
                this.handleProductOptional(e.target);
            } else if (e.target.matches('.product-required-if-supported')) {
                this.handleProductRequiredIfSupported(e.target);
            } else if (e.target.matches('.product-additional-consented')) {
                this.handleProductAdditionalConsented(e.target); // NEW: Handle additional consented products
            }
        });

        // Basic config inputs
        document.getElementById('clientName').addEventListener('input', () => {
            this.config.client_name = document.getElementById('clientName').value;
        });

        document.getElementById('linkCustomizationName').addEventListener('input', () => {
            this.config.link_customization_name = document.getElementById('linkCustomizationName').value;
        });

        document.getElementById('language').addEventListener('change', () => {
            this.config.language = document.getElementById('language').value;
        });

        document.getElementById('countryCodesInput').addEventListener('input', () => {
            this.updateCountryCodesFromInput();
        });

        // User inputs
        document.getElementById('clientUserId').addEventListener('input', () => {
            this.config.user.client_user_id = document.getElementById('clientUserId').value;
        });
        document.getElementById('userPhoneNumber').addEventListener('input', () => {
            const input = document.getElementById('userPhoneNumber').value;
            this.config.user.phone_number = this.autoDetectE164(input);
        });

        // JSON editor
        document.getElementById('jsonConfig').addEventListener('input', () => {
            this.validateAndUpdateJSON();
        });

        // Action buttons
        document.getElementById('applyConfig').addEventListener('click', () => {
            this.applyConfiguration();
        });

        document.getElementById('resetConfig').addEventListener('click', () => {
            this.resetToDefaults();
        });

        document.getElementById('savePreset').addEventListener('click', () => {
            this.savePreset();
        });
    }

    displayWebhookUrl() {
        const webhookUrlElement = document.getElementById('webhookUrl');
        if (webhookUrlElement && document.location.origin) {
            webhookUrlElement.placeholder = `${document.location.origin}/webhooks`;
        }
    }

    toggleAdvancedMode() {
        this.isAdvancedMode = !this.isAdvancedMode;
        const toggle = document.getElementById('advancedToggle');
        const section = document.getElementById('advancedSection');

        if (this.isAdvancedMode) {
            toggle.classList.add('active');
            section.classList.remove('disabled-section');
        } else {
            toggle.classList.remove('active');
            section.classList.add('disabled-section');
        }
    }

    // Helper method to remove product from all arrays except the specified one
    removeProductFromAllArraysExcept(product, exceptArray) {
        if (exceptArray !== 'products') {
            this.config.products = this.config.products.filter(p => p !== product);
        }
        if (exceptArray !== 'optional_products') {
            this.config.optional_products = this.config.optional_products.filter(p => p !== product);
        }
        if (exceptArray !== 'required_if_supported_products') {
            this.config.required_if_supported_products = this.config.required_if_supported_products.filter(p => p !== product);
        }
        if (exceptArray !== 'additional_consented_products') {
            this.config.additional_consented_products = this.config.additional_consented_products.filter(p => p !== product);
        }
    }

    // Helper method to update all checkboxes for a product based on current config
    updateProductCheckboxes(product) {
        document.querySelector(`.product-include[data-product="${product}"]`).checked = this.config.products.includes(product);
        document.querySelector(`.product-optional[data-product="${product}"]`).checked = this.config.optional_products.includes(product);
        document.querySelector(`.product-required-if-supported[data-product="${product}"]`).checked = this.config.required_if_supported_products.includes(product);
        document.querySelector(`.product-additional-consented[data-product="${product}"]`).checked = this.config.additional_consented_products.includes(product);
    }

    handleProductInclude(checkbox) {
        const product = checkbox.dataset.product;
        if (checkbox.checked) {
            // Remove from all other arrays and add to products
            this.removeProductFromAllArraysExcept(product, 'products');
            if (!this.config.products.includes(product)) {
                this.config.products.push(product);
            }
        } else {
            // Remove from products array
            this.config.products = this.config.products.filter(p => p !== product);
        }

        // Update all checkboxes for this product
        this.updateProductCheckboxes(product);
    }

    handleProductOptional(checkbox) {
        const product = checkbox.dataset.product;
        if (checkbox.checked) {
            // Remove from all other arrays and add to optional_products
            this.removeProductFromAllArraysExcept(product, 'optional_products');
            if (!this.config.optional_products.includes(product)) {
                this.config.optional_products.push(product);
            }
        } else {
            // Remove from optional_products array
            this.config.optional_products = this.config.optional_products.filter(p => p !== product);
        }

        // Update all checkboxes for this product
        this.updateProductCheckboxes(product);
    }

    handleProductRequiredIfSupported(checkbox) {
        const product = checkbox.dataset.product;
        if (checkbox.checked) {
            // Remove from all other arrays and add to required_if_supported_products
            this.removeProductFromAllArraysExcept(product, 'required_if_supported_products');
            if (!this.config.required_if_supported_products.includes(product)) {
                this.config.required_if_supported_products.push(product);
            }
        } else {
            // Remove from required_if_supported_products array
            this.config.required_if_supported_products = this.config.required_if_supported_products.filter(p => p !== product);
        }

        // Update all checkboxes for this product
        this.updateProductCheckboxes(product);
    }

    // Handle additional consented products with mutual exclusivity
    handleProductAdditionalConsented(checkbox) {
        const product = checkbox.dataset.product;
        if (checkbox.checked) {
            // Remove from all other arrays and add to additional_consented_products
            this.removeProductFromAllArraysExcept(product, 'additional_consented_products');
            if (!this.config.additional_consented_products.includes(product)) {
                this.config.additional_consented_products.push(product);
            }
        } else {
            // Remove from additional_consented_products array
            this.config.additional_consented_products = this.config.additional_consented_products.filter(p => p !== product);
        }

        // Update all checkboxes for this product
        this.updateProductCheckboxes(product);
    }

    updateCountryCodesFromInput() {
        const input = document.getElementById('countryCodesInput').value;
        this.config.country_codes = input
            .split(',')
            .map(code => code.trim().toUpperCase())
            .filter(code => code.length > 0);
    }



    autoDetectE164(phoneNumber, fallbackCountryCode = '1') {
        // Country code patterns and rules
        const COUNTRY_CODES = {
            // North America (NANP)
            '1': { minLength: 10, maxLength: 10, pattern: /^1?[2-9]\d{2}[2-9]\d{6}$/ },

            // Major country codes with their typical lengths
            '44': { minLength: 10, maxLength: 10, pattern: /^44[1-9]\d{8,9}$/ }, // UK
            '33': { minLength: 9, maxLength: 9, pattern: /^33[1-9]\d{8}$/ },   // France
            '49': { minLength: 10, maxLength: 12, pattern: /^49[1-9]\d{9,11}$/ }, // Germany
            '39': { minLength: 9, maxLength: 11, pattern: /^39\d{9,11}$/ },    // Italy
            '34': { minLength: 9, maxLength: 9, pattern: /^34[6-9]\d{8}$/ },   // Spain
            '31': { minLength: 9, maxLength: 9, pattern: /^31[1-9]\d{8}$/ },   // Netherlands
            '7': { minLength: 10, maxLength: 10, pattern: /^7[3-9]\d{9}$/ },   // Russia/Kazakhstan
            '86': { minLength: 11, maxLength: 11, pattern: /^86[1]\d{10}$/ },  // China
            '81': { minLength: 10, maxLength: 11, pattern: /^81[1-9]\d{8,9}$/ }, // Japan
            '91': { minLength: 10, maxLength: 10, pattern: /^91[6-9]\d{9}$/ }, // India
            '61': { minLength: 9, maxLength: 9, pattern: /^61[2-4689]\d{8}$/ }, // Australia
            '55': { minLength: 10, maxLength: 11, pattern: /^55[1-9]\d{8,9}$/ }, // Brazil
            '52': { minLength: 10, maxLength: 10, pattern: /^52[1-9]\d{9}$/ }, // Mexico
        };

        // Remove all non-digit characters
        const digitsOnly = phoneNumber.replace(/\D/g, '');

        // If empty, return empty string
        if (!digitsOnly) {
            return '';
        }

        // Try to detect country code by testing patterns
        for (const [countryCode, rules] of Object.entries(COUNTRY_CODES)) {
            // Check if digits start with this country code
            if (digitsOnly.startsWith(countryCode)) {
                const nationalNumber = digitsOnly.substring(countryCode.length);

                // Check if the remaining digits fit the pattern for this country
                if (nationalNumber.length >= rules.minLength &&
                    nationalNumber.length <= rules.maxLength) {

                    const fullNumber = countryCode + nationalNumber;
                    if (rules.pattern.test(fullNumber)) {
                        console.log(`✓ Detected country code: +${countryCode}`);
                        return '+' + fullNumber;
                    }
                }
            }

            // Also check if the number WITHOUT country code fits the pattern
            if (digitsOnly.length >= rules.minLength &&
                digitsOnly.length <= rules.maxLength) {

                const testNumber = countryCode + digitsOnly;
                if (rules.pattern.test(testNumber)) {
                    console.log(`✓ Auto-added country code: +${countryCode}`);
                    return '+' + testNumber;
                }
            }
        }

        // Fallback: use simple length-based detection
        if (digitsOnly.length >= 11) {
            // Assume it already has a country code
            console.log(`Using as-is (${digitsOnly.length} digits)`);
            return '+' + digitsOnly;
        } else if (digitsOnly.length === 10) {
            // Most likely needs country code - use fallback
            console.log(`Adding fallback country code: +${fallbackCountryCode}`);
            return '+' + fallbackCountryCode + digitsOnly;
        } else {
            // Just add + and hope for the best
            console.log(`Uncertain format, adding + prefix`);
            return '+' + digitsOnly;
        }
    }

    populateJSONFromConfig() {
        const jsonConfig = { ...this.config };
        // Remove empty arrays and empty strings to keep JSON clean
        if (jsonConfig.optional_products.length === 0) delete jsonConfig.optional_products;
        if (jsonConfig.required_if_supported_products.length === 0) delete jsonConfig.required_if_supported_products;
        if (jsonConfig.additional_consented_products.length === 0) delete jsonConfig.additional_consented_products;
        if (!jsonConfig.link_customization_name || jsonConfig.link_customization_name.trim() === '') delete jsonConfig.link_customization_name;
        if (!jsonConfig.user.phone_number || jsonConfig.user.phone_number.trim() === '') delete jsonConfig.user.phone_number;

        document.getElementById('jsonConfig').value = JSON.stringify(jsonConfig, null, 2);
        this.validateAndUpdateJSON();
    }

    validateAndUpdateJSON() {
        const jsonText = document.getElementById('jsonConfig').value;
        const statusEl = document.getElementById('jsonStatus');

        try {
            const parsed = JSON.parse(jsonText);
            statusEl.textContent = 'JSON is valid';
            statusEl.className = 'json-status json-valid';

            if (this.isAdvancedMode) {
                this.config = { ...this.getDefaultConfig(), ...parsed };
            }
        } catch (error) {
            statusEl.textContent = `Invalid JSON: ${error.message}`;
            statusEl.className = 'json-status json-invalid';
        }
    }

    getBasicConfig() {
        const config = { ...this.config };

        // Clean up empty arrays and empty strings
        if (config.optional_products.length === 0) delete config.optional_products;
        if (config.required_if_supported_products.length === 0) delete config.required_if_supported_products;
        if (config.additional_consented_products.length === 0) delete config.additional_consented_products;
        if (!config.link_customization_name || config.link_customization_name.trim() === '') delete config.link_customization_name;
        if (!config.user.phone_number || config.user.phone_number.trim() === '') delete config.user.phone_number;

        return config;
    }

    getAdvancedConfig() {
        try {
            return JSON.parse(document.getElementById('jsonConfig').value);
        } catch {
            return this.config;
        }
    }

    getFinalConfig() {
        return this.isAdvancedMode ? this.getAdvancedConfig() : this.getBasicConfig();
    }

    async applyConfiguration() {
        try {
            UIUtils.setButtonLoading(document.getElementById('applyConfig'), true, 'Applying...');

            const finalConfig = this.getFinalConfig();

            // Validate configuration
            if (!finalConfig.products || finalConfig.products.length === 0) {
                throw new Error('At least one product must be selected');
            }

            if (!finalConfig.country_codes || finalConfig.country_codes.length === 0) {
                throw new Error('At least one country code must be selected');
            }

            // Save to localStorage with consistent keys
            const productsList = finalConfig.products.join(', ');
            const additionalConsentedList = finalConfig.additional_consented_products ? ` + ${finalConfig.additional_consented_products.join(', ')} (additional)` : '';
            const configName = `Applied Config (${productsList}${additionalConsentedList})`;
            localStorage.setItem('plaid_link_config', JSON.stringify(finalConfig));
            localStorage.setItem('plaid_link_config_name', configName);

            // Send configuration to server
            try {
                const response = await window.apiClient.request('/api/set-link-config', {
                    method: 'POST',
                    body: JSON.stringify({ config: finalConfig })
                });

                if (response.success) {
                    UIUtils.showStatus('configStatus', 'Configuration applied successfully! Link tokens will now use these settings.', 'success');
                    UIUtils.showNotification('Configuration saved and applied!', 'success');
                } else {
                    throw new Error(response.error || 'Failed to apply configuration to server');
                }
            } catch (serverError) {
                console.warn('Server save failed, but localStorage config is active:', serverError);
                UIUtils.showStatus('configStatus', 'Configuration saved locally but server update failed. You can still test with this config.', 'warning');
                UIUtils.showNotification('Configuration saved locally (server failed)', 'warning');
            }

            setTimeout(() => {
                if (confirm('Configuration saved! Would you like to return to the main page to test it?')) {
                    window.location.href = '/';
                }
            }, 2000);

        } catch (error) {
            UIUtils.showStatus('configStatus', `Error: ${error.message}`, 'error');
            UIUtils.showNotification(`Failed to apply configuration: ${error.message}`, 'error');
        } finally {
            UIUtils.setButtonLoading(document.getElementById('applyConfig'), false);
        }
    }

    async resetToDefaults() {
        try {
            // Clear localStorage configuration
            localStorage.removeItem('plaid_link_config');
            localStorage.removeItem('plaid_link_config_name');

            // Clear server configuration
            try {
                await window.apiClient.request('/api/clear-link-config', {
                    method: 'POST'
                });
            } catch (serverError) {
                console.warn('Server clear failed:', serverError);
            }

            this.config = this.getDefaultConfig();
            this.isAdvancedMode = false;

            // Reset UI
            document.getElementById('advancedToggle').classList.remove('active');
            document.getElementById('advancedSection').classList.add('disabled-section');
            document.getElementById('clientName').value = this.config.client_name;
            document.getElementById('linkCustomizationName').value = this.config.link_customization_name || '';
            document.getElementById('language').value = this.config.language;
            document.getElementById('clientUserId').value = this.config.user.client_user_id || 'test-kit-user-' + Date.now();
            document.getElementById('userPhoneNumber').value = this.config.user.phone_number || '';

            // Reset country checkboxes
            document.querySelectorAll('.country-checkbox').forEach(cb => {
                cb.checked = this.config.country_codes.includes(cb.value);
            });

            // Reset products table
            this.renderProductsTable();

            // Clear JSON
            document.getElementById('jsonConfig').value = '';

            UIUtils.showStatus('configStatus', 'Configuration reset to defaults', 'info');
            UIUtils.showNotification('Configuration reset to defaults (both local and server)', 'info');
        } catch (error) {
            UIUtils.showNotification(`Failed to reset configuration: ${error.message}`, 'error');
        }
    }

    savePreset() {
        const presetName = prompt('Enter a name for this preset:');
        if (!presetName) return;

        const finalConfig = this.getFinalConfig();

        // Save as the active configuration using consistent keys
        localStorage.setItem('plaid_link_config', JSON.stringify(finalConfig));
        localStorage.setItem('plaid_link_config_name', `${presetName} Preset`);

        UIUtils.showNotification(`Preset "${presetName}" saved and activated!`, 'success');
        UIUtils.showStatus('configStatus', `Preset "${presetName}" is now the active configuration`, 'success');
    }
}

// Global functions for external access
function loadPreset(presetName) {
    if (window.linkTokenConfig) {
        window.linkTokenConfig.loadPreset(presetName);
    }
}

function getAvailablePresets() {
    if (window.linkTokenConfig) {
        return window.linkTokenConfig.getAvailablePresets();
    }
    return [];
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';

    const maxHeight = 500;
    if (textarea.scrollHeight > maxHeight) {
        textarea.style.height = maxHeight + 'px';
        textarea.style.overflowY = 'auto';
    } else {
        textarea.style.overflowY = 'hidden';
    }
}

// Robust initialization that handles multiple loading scenarios
function initializeAutoResize() {


    const jsonConfig = document.getElementById('jsonConfig');

    if (jsonConfig) {


        // Remove any existing event listeners to prevent duplicates
        jsonConfig.removeEventListener('input', handleInput);
        jsonConfig.removeEventListener('paste', handlePaste);
        jsonConfig.removeEventListener('keyup', handleKeyup);

        // Add event listeners
        jsonConfig.addEventListener('input', handleInput);
        jsonConfig.addEventListener('paste', handlePaste);
        jsonConfig.addEventListener('keyup', handleKeyup);

        // Load current configuration into the textarea
        if (window.linkTokenConfig?.config) {
            jsonConfig.value = JSON.stringify(window.linkTokenConfig.config, null, 2);
        }

        // Initial resize
        autoResizeTextarea(jsonConfig);


        return true;
    } else {
        console.log('jsonConfig element not found, will retry...');
        return false;
    }
}

function setupAutoResize() {


    // If DOM is already ready, initialize immediately
    if (document.readyState === 'loading') {
        // DOM is still loading, wait for DOMContentLoaded
        document.addEventListener('DOMContentLoaded', initializeAutoResize);
    } else {
        // DOM is already loaded, initialize now
        if (!initializeAutoResize()) {
            // If element not found, try again with a short delay
            setTimeout(initializeAutoResize, 50);
        }
    }

    // Backup: try again when window fully loads
    window.addEventListener('load', function () {
        console.log('Window load event fired');
        initializeAutoResize();
    });

    // Additional backup: try periodically until element is found
    let retryCount = 0;
    const maxRetries = 20; // Try for up to 2 seconds
    const retryInterval = setInterval(() => {
        retryCount++;
        console.log(`Retry attempt ${retryCount}/${maxRetries}`);

        if (initializeAutoResize() || retryCount >= maxRetries) {
            clearInterval(retryInterval);
            if (retryCount >= maxRetries) {
                console.error('Failed to find jsonConfig element after maximum retries');
            }
        }
    }, 100);
}

// Toggle functionality
function setupToggle() {
    const advancedToggle = document.getElementById('advancedToggle');
    const advancedSection = document.getElementById('advancedSection');
    const jsonConfig = document.getElementById('jsonConfig');

    if (advancedToggle && advancedSection) {
        advancedToggle.addEventListener('click', function () {


            this.classList.toggle('active');
            advancedSection.classList.toggle('disabled-section');

            // Always refresh textarea content and resize when toggle is clicked
            if (jsonConfig) {
                // Refresh content from current config
                if (window.linkTokenConfig?.config) {

                    jsonConfig.value = JSON.stringify(window.linkTokenConfig.config, null, 2);
                } else {
                    console.log('No linkTokenConfig.config found, using placeholder');
                    // Fallback to placeholder if no config exists
                    jsonConfig.value = JSON.stringify({
                        "webhook": "https://your-webhook-url.com/webhook",
                        "link_customization_name": "default",
                        "products": ["transactions"],
                        "country_codes": ["US"],
                        "language": "en",
                        "user": {
                            "client_user_id": "user_123"
                        }
                    }, null, 2);
                }

                // Always auto-resize after content update
                autoResizeTextarea(jsonConfig);
                console.log('Textarea refreshed and resized');
            }
        });
    }
}

// Event handler functions
function handleInput(event) {

    autoResizeTextarea(event.target);
}

function handlePaste(event) {

    setTimeout(() => autoResizeTextarea(event.target), 0);
}

function handleKeyup(event) {
    autoResizeTextarea(event.target);
}

setupAutoResize();
setupToggle();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.linkTokenConfig = new LinkTokenConfig();

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+S to save/apply
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            document.getElementById('applyConfig').click();
        }

        // Ctrl+R to reset
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            document.getElementById('resetConfig').click();
        }
    });
});