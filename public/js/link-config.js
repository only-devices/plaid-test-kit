// public/js/link-config.js

// Plaid products configuration
const PLAID_PRODUCTS = [
    {
        id: 'auth',
        name: 'Auth',
        description: 'Access to account and routing numbers for ACH'
    },
    {
        id: 'transactions',
        name: 'Transactions',
        description: 'Access to account transactions and history'
    },
    {
        id: 'identity',
        name: 'Identity',
        description: 'Access to identity information like names, emails, phone numbers, and addresses'
    },
    {
        id: 'assets',
        name: 'Assets',
        description: 'Access to asset reports for income verification'
    },
    {
        id: 'income',
        name: 'Income',
        description: 'Access to income verification data'
    },
    /*{
    {
        id: 'investments',
        name: 'Investments',
        description: 'Access to investment account data and holdings'
    },
        id: 'liabilities',
        name: 'Liabilities',
        description: 'Access to liability accounts like credit cards and loans'
    },
    {
        id: 'payment_initiation',
        name: 'Payment Initiation',
        description: 'Ability to initiate payments (UK/EU only)'
    },
    {
        id: 'deposit_switch',
        name: 'Deposit Switch',
        description: 'Enable users to switch their direct deposit'
    },
    {
        id: 'standing_orders',
        name: 'Standing Orders',
        description: 'Access to standing orders (UK only)'
    }*/
];

class LinkTokenConfig {
    constructor() {
        this.config = this.getDefaultConfig();
        this.isAdvancedMode = false;
        this.init();
    }

    async init() {
        this.renderProductsTable();
        this.setupEventListeners();
        await this.loadExistingConfig();
        this.updatePreview();
    }

    getDefaultConfig() {
        return {
            products: ['auth'],
            optional_products: [],
            required_if_supported_products: [],
            client_name: 'Plaid Test Kit',
            country_codes: ['US'],
            language: 'en',
            user: {
                client_user_id: 'test-kit-user-' + Date.now()
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
            const response = await window.apiClient.getHealth();
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
        document.getElementById('language').value = this.config.language || 'en';

        // Update country checkboxes
        document.querySelectorAll('.country-checkbox').forEach(cb => {
            cb.checked = this.config.country_codes.includes(cb.value);
        });

        // Update products table
        this.renderProductsTable();
    }

    renderProductsTable() {
        const tbody = document.getElementById('productsTableBody');
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
            } else if (e.target.matches('.country-checkbox')) {
                this.updateCountryCodes();
            }
        });

        // Basic config inputs
        document.getElementById('clientName').addEventListener('input', () => {
            this.config.client_name = document.getElementById('clientName').value;
            this.updatePreview();
        });

        document.getElementById('language').addEventListener('change', () => {
            this.config.language = document.getElementById('language').value;
            this.updatePreview();
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

    toggleAdvancedMode() {
        this.isAdvancedMode = !this.isAdvancedMode;
        const toggle = document.getElementById('advancedToggle');
        const section = document.getElementById('advancedSection');

        if (this.isAdvancedMode) {
            toggle.classList.add('active');
            section.classList.remove('disabled-section');
            this.populateJSONFromConfig();
        } else {
            toggle.classList.remove('active');
            section.classList.add('disabled-section');
        }

        this.updatePreview();
    }

    handleProductInclude(checkbox) {
        const product = checkbox.dataset.product;
        if (checkbox.checked) {
            if (!this.config.products.includes(product)) {
                this.config.products.push(product);
            }
        } else {
            this.config.products = this.config.products.filter(p => p !== product);
            // Also remove from optional and required_if_supported
            this.config.optional_products = this.config.optional_products.filter(p => p !== product);
            this.config.required_if_supported_products = this.config.required_if_supported_products.filter(p => p !== product);
            // Update the checkboxes
            document.querySelector(`.product-optional[data-product="${product}"]`).checked = false;
            document.querySelector(`.product-required-if-supported[data-product="${product}"]`).checked = false;
        }
        this.updatePreview();
    }

    handleProductOptional(checkbox) {
        const product = checkbox.dataset.product;
        if (checkbox.checked) {
            // Ensure product is included first
            const includeCheckbox = document.querySelector(`.product-include[data-product="${product}"]`);
            if (!includeCheckbox.checked) {
                includeCheckbox.checked = true;
                this.config.products.push(product);
            }
            if (!this.config.optional_products.includes(product)) {
                this.config.optional_products.push(product);
            }
        } else {
            this.config.optional_products = this.config.optional_products.filter(p => p !== product);
        }
        this.updatePreview();
    }

    handleProductRequiredIfSupported(checkbox) {
        const product = checkbox.dataset.product;
        if (checkbox.checked) {
            // Ensure product is included first
            const includeCheckbox = document.querySelector(`.product-include[data-product="${product}"]`);
            if (!includeCheckbox.checked) {
                includeCheckbox.checked = true;
                this.config.products.push(product);
            }
            if (!this.config.required_if_supported_products.includes(product)) {
                this.config.required_if_supported_products.push(product);
            }
        } else {
            this.config.required_if_supported_products = this.config.required_if_supported_products.filter(p => p !== product);
        }
        this.updatePreview();
    }

    updateCountryCodes() {
        const checkboxes = document.querySelectorAll('.country-checkbox:checked');
        this.config.country_codes = Array.from(checkboxes).map(cb => cb.value);
        this.updatePreview();
    }

    populateJSONFromConfig() {
        const jsonConfig = { ...this.config };
        // Remove empty arrays to keep JSON clean
        if (jsonConfig.optional_products.length === 0) delete jsonConfig.optional_products;
        if (jsonConfig.required_if_supported_products.length === 0) delete jsonConfig.required_if_supported_products;

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
                this.updatePreview();
            }
        } catch (error) {
            statusEl.textContent = `Invalid JSON: ${error.message}`;
            statusEl.className = 'json-status json-invalid';
        }
    }

    updatePreview() {
        const preview = document.getElementById('configPreview');
        const configToShow = this.isAdvancedMode
            ? this.getAdvancedConfig()
            : this.getBasicConfig();

        preview.innerHTML = UIUtils.syntaxHighlight(configToShow);
    }

    getBasicConfig() {
        const config = { ...this.config };

        // Clean up empty arrays
        if (config.optional_products.length === 0) delete config.optional_products;
        if (config.required_if_supported_products.length === 0) delete config.required_if_supported_products;

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
            const configName = `Applied Config (${finalConfig.products.join(', ')})`;
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
            document.getElementById('language').value = this.config.language;

            // Reset country checkboxes
            document.querySelectorAll('.country-checkbox').forEach(cb => {
                cb.checked = this.config.country_codes.includes(cb.value);
            });

            // Reset products table
            this.renderProductsTable();

            // Clear JSON
            document.getElementById('jsonConfig').value = '';

            this.updatePreview();
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