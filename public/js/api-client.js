// public/js/api-client.js

class ApiClient {
    constructor() {
        this.baseUrl = '';
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Link Token Operations
    async createLinkToken(options = {}) {
        return this.request('/api/create-link-token', {
            method: 'POST',
            body: JSON.stringify(options)
        });
    }

    async exchangePublicToken(publicToken) {
        return this.request('/api/exchange-token', {
            method: 'POST',
            body: JSON.stringify({ public_token: publicToken })
        });
    }

    async setAccessToken(accessToken) {
        return this.request('/api/set-token', {
            method: 'POST',
            body: JSON.stringify({ access_token: accessToken })
        });
    }

    async clearToken() {
        return this.request('/api/clear-token', {
            method: 'POST'
        });
    }

    // Account Operations
    async getAccounts() {
        return this.request('/api/get-accounts', {
            method: 'POST'
        });
    }

    // Identity Operations
    async testIdentity(userData) {
        return this.request('/api/test-identity', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    // Health Check
    async getHealth() {
        return this.request('/health');
    }
}

// Create and export a singleton instance
window.apiClient = new ApiClient();