// public/js/ui-utils.js

class UIUtils {
    /**
     * Show status message
     * @param {HTMLElement|string} element - Element or element ID
     * @param {string} message - Message text
     * @param {string} type - 'success', 'error', 'info', 'warning'
     */
    static showStatus(element, message, type = 'info') {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) return;

        el.innerHTML = `<div class="status status-${type}">${message}</div>`;
    }

    /**
     * Clear status messages
     * @param {HTMLElement|string} element - Element or element ID
     */
    static clearStatus(element) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) return;
        
        el.innerHTML = '';
    }

    /**
     * Set loading state for button
     * @param {HTMLElement|string} button - Button element or ID
     * @param {boolean} loading - Loading state
     * @param {string} loadingText - Text to show when loading
     */
    static setButtonLoading(button, loading, loadingText = 'Loading...') {
        const btn = typeof button === 'string' ? document.getElementById(button) : button;
        if (!btn) return;

        if (loading) {
            btn.dataset.originalText = btn.textContent;
            btn.textContent = loadingText;
            btn.disabled = true;
            btn.classList.add('loading');
        } else {
            btn.textContent = btn.dataset.originalText || btn.textContent;
            btn.disabled = false;
            btn.classList.remove('loading');
            delete btn.dataset.originalText;
        }
    }

    /**
     * Format access token for display
     * @param {string} token - Access token
     * @returns {string} Formatted token
     */
    static formatToken(token) {
        if (!token) return '';
        if (token.length <= 20) return token;
        return `${token.substring(0, 8)}...${token.substring(token.length - 8)}`;
    }

    /**
     * Show/hide element
     * @param {HTMLElement|string} element - Element or element ID
     * @param {boolean} show - Whether to show the element
     */
    static toggleElement(element, show) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) return;

        if (show) {
            el.classList.remove('hidden');
            el.classList.add('visible');
        } else {
            el.classList.add('hidden');
            el.classList.remove('visible');
        }
    }

    /**
     * Populate select element with options
     * @param {HTMLElement|string} select - Select element or ID
     * @param {Array} options - Array of {value, text} objects
     * @param {string} placeholder - Placeholder option text
     */
    static populateSelect(select, options, placeholder = 'Select an option...') {
        const selectEl = typeof select === 'string' ? document.getElementById(select) : select;
        if (!selectEl) return;
        
        selectEl.style.backgroundColor = 'white'; // Reset background color
        selectEl.innerHTML = `<option value="">${placeholder}</option>`;
        
        options.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option.value;
            optionEl.textContent = option.text;
            selectEl.appendChild(optionEl);
        });

        // Auto-select first option if available
        if (options.length > 0) {
            selectEl.selectedIndex = 1; // Skip placeholder
        }
    }

    /**
     * Update boolean field display
     * @param {HTMLElement|string} element - Element or element ID
     * @param {string} label - Field label
     * @param {boolean} value - Boolean value
     */
    static updateBooleanField(element, label, value) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (!el) return;

        el.textContent = `${label}: ${value ? 'TRUE' : 'FALSE'}`;
        el.className = `boolean-field ${value ? 'boolean-true' : 'boolean-false'}`;
    }

    /**
     * Create loading spinner element
     * @returns {HTMLElement} Spinner element
     */
    static createSpinner() {
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        spinner.innerHTML = '⟳';
        spinner.style.cssText = `
            display: inline-block;
            animation: spin 1s linear infinite;
            font-size: 18px;
            margin-right: 8px;
        `;
        
        // Add keyframe animation if not already present
        if (!document.querySelector('#spinner-keyframes')) {
            const style = document.createElement('style');
            style.id = 'spinner-keyframes';
            style.textContent = `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        return spinner;
    }

    /**
     * Validate form data
     * @param {FormData|Object} data - Form data to validate
     * @param {Array} requiredFields - Array of required field names
     * @returns {Object} {isValid: boolean, errors: string[]}
     */
    static validateForm(data, requiredFields = []) {
        const errors = [];
        const values = data instanceof FormData ? Object.fromEntries(data) : data;

        requiredFields.forEach(field => {
            if (!values[field] || values[field].trim() === '') {
                errors.push(`${field} is required`);
            }
        });

        // Email validation
        if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
            errors.push('Invalid email format');
        }

        // Phone validation (basic)
        if (values.phone && !/^[\+]? [1-9][\d]{0,15}$/.test(values.phone.replace(/\s/g, ''))) {
            errors.push('Invalid phone format');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Format account display name
     * @param {Object} account - Account object
     * @returns {string} Formatted account name
     */
    static formatAccountName(account) {
        const name = account.name || account.official_name || 'Unnamed Account';
        const type = account.type ? ` (${account.type})` : '';
        const mask = account.mask ? ` ****${account.mask}` : '';
        return `${name}${type}${mask}`;
    }

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} Success status
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy text:', err);
            return false;
        }
    }

    /**
     * Syntax highlight JSON for HTML display
     * @param {Object|string} json - JSON object or JSON string
     * @returns {string} HTML string containing syntax highlighted JSON
     */
    static syntaxHighlight(json) {
        // Ensure we have a string representation of the JSON
        if (typeof json !== 'string') {
            json = JSON.stringify(json, null, 2);
        }

        // Escape HTML special characters
        json = json
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Replace tokens with span-wrapped versions for coloring
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g, match => {
            let cls = 'number';
            if (/^"/.test(match)) {
                cls = /:$/.test(match) ? 'key' : 'string';
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return `<span class="${cls}">${match}</span>`;
        });
    }

    /**
     * Show temporary notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type
     * @param {number} duration - Duration in milliseconds
     */
    static showNotification(message, type = 'info', duration = 4000) {
        const notification = document.createElement('div');
        notification.className = `status status-${type} notification-enter`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 1000;
            max-width: 400px;
            min-width: 300px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
            border-radius: 12px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            font-weight: 500;
        `;

        document.body.appendChild(notification);
        
        // Trigger animation
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });
        
        // Auto-dismiss
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, duration);

        // Click to dismiss
        notification.addEventListener('click', () => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        });
    }
}

// Export to global scope
window.UIUtils = UIUtils;
