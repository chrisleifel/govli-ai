/**
 * Authentication Module
 * Handles login, logout, token management, and user session
 */

const Auth = {
    // Get stored token
    getToken() {
        return localStorage.getItem('authToken');
    },

    // Set auth token
    setToken(token) {
        localStorage.setItem('authToken', token);
    },

    // Remove auth token
    removeToken() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    },

    // Get stored user
    getUser() {
        const userJson = localStorage.getItem('user');
        return userJson ? JSON.parse(userJson) : null;
    },

    // Set user data
    setUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    },

    // Check if user is logged in
    isLoggedIn() {
        return !!this.getToken();
    },

    // Login function
    async login(email, password) {
        try {
            // DEMO MODE: Skip backend authentication
            if (window.DEMO_CONFIG?.enabled) {
                console.log('Demo mode: Bypassing authentication');

                // Create demo user with provided email or default
                const demoUser = {
                    ...window.DEMO_CONFIG.credentials,
                    email: email || window.DEMO_CONFIG.credentials.email
                };

                const demoToken = 'DEMO_TOKEN_' + Date.now();

                // Store demo token and user
                this.setToken(demoToken);
                this.setUser(demoUser);

                // Simulate network delay for realism
                await new Promise(resolve => setTimeout(resolve, 500));

                return {
                    token: demoToken,
                    user: demoUser,
                    message: 'Demo login successful'
                };
            }

            // PRODUCTION MODE: Normal backend authentication
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.LOGIN}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Login failed');
            }

            const data = await response.json();

            // Store token and user data
            this.setToken(data.token);
            this.setUser(data.user);

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    // Logout function
    logout() {
        this.removeToken();
        // Redirect to login page or show login modal
        window.location.reload();
    },

    // Get user role
    getUserRole() {
        const user = this.getUser();
        return user ? user.role : null;
    },

    // Check if user has required role
    hasRole(requiredRole) {
        const userRole = this.getUserRole();
        if (!userRole) return false;

        const roleHierarchy = {
            'admin': 4,
            'staff': 3,
            'inspector': 2,
            'citizen': 1
        };

        return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
    },

    // Initialize auth state on page load
    init() {
        const user = this.getUser();
        if (user) {
            // Update UI with user info
            this.updateUserDisplay(user);
        } else {
            // Show login modal if not logged in
            this.showLoginModal();
        }
    },

    // Update user display in UI
    updateUserDisplay(user) {
        // Update user name and role in header
        const userNameEl = document.querySelector('.user-name');
        const userRoleEl = document.querySelector('.user-role');

        if (userNameEl) {
            userNameEl.textContent = user.name || user.email;
        }
        if (userRoleEl) {
            userRoleEl.textContent = user.role || 'User';
        }
    },

    // Show login modal
    showLoginModal() {
        // Check if login modal exists
        let loginModal = document.getElementById('loginModal');

        if (!loginModal) {
            // Create login modal
            loginModal = document.createElement('div');
            loginModal.id = 'loginModal';
            loginModal.className = 'modal';
            loginModal.innerHTML = `
                <div class="modal-content" style="max-width: 400px; margin: 100px auto;">
                    <h2>Login to Govli AI</h2>
                    <form id="loginForm">
                        <div class="form-group">
                            <label for="loginEmail">Email</label>
                            <input type="email" id="loginEmail" required placeholder="admin@govli.ai">
                        </div>
                        <div class="form-group">
                            <label for="loginPassword">Password</label>
                            <input type="password" id="loginPassword" required placeholder="Admin123$">
                        </div>
                        <div id="loginError" class="error-message" style="display: none; color: red; margin-bottom: 10px;"></div>
                        <button type="submit" class="btn btn-primary" style="width: 100%;">
                            <i class="fas fa-sign-in-alt"></i> Login
                        </button>
                        <div style="margin-top: 15px; text-align: center; font-size: 0.9em; color: #666;">
                            <p><strong>Test Accounts:</strong></p>
                            <p>Admin: admin@govli.ai / Admin123$</p>
                            <p>Staff: staff@govli.ai / Staff123$</p>
                        </div>
                    </form>
                </div>
            `;
            document.body.appendChild(loginModal);

            // Handle login form submission
            const loginForm = document.getElementById('loginForm');
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                const errorEl = document.getElementById('loginError');

                try {
                    errorEl.style.display = 'none';
                    await this.login(email, password);

                    // Close modal and reload page
                    loginModal.style.display = 'none';
                    window.location.reload();
                } catch (error) {
                    errorEl.textContent = error.message;
                    errorEl.style.display = 'block';
                }
            });
        }

        loginModal.style.display = 'block';
    },

    // Enhanced API call with auth token
    async apiCall(endpoint, options = {}) {
        const token = this.getToken();

        // DEMO MODE: Intercept API calls and return mock data
        if (window.DEMO_CONFIG?.enabled && window.DemoData) {
            console.log('Demo mode: Intercepting API call:', endpoint);
            return await this.getMockDataForEndpoint(endpoint, options);
        }

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            }
        };

        // Add auth token if available
        if (token) {
            defaultOptions.headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
                ...defaultOptions,
                ...options,
                headers: {
                    ...defaultOptions.headers,
                    ...(options.headers || {})
                }
            });

            // Handle 401 Unauthorized
            if (response.status === 401) {
                this.logout();
                throw new Error('Session expired. Please login again.');
            }

            // Check content type before parsing
            const contentType = response.headers.get('content-type');
            const isJson = contentType && contentType.includes('application/json');

            // If response is HTML instead of JSON, the endpoint likely doesn't exist
            if (!isJson) {
                const status = response.status;
                const text = await response.text();
                if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                    throw new Error(`API endpoint not found (${status}): ${endpoint}. Please check if the backend server is running.`);
                }
                throw new Error(`Unexpected response type: ${contentType || 'unknown'}`);
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'API call failed');
            }

            return await response.json();
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    },

    // Get mock data for endpoint in demo mode
    async getMockDataForEndpoint(endpoint, options = {}) {
        console.log('Demo mode: Generating mock data for:', endpoint, options);

        // Parse endpoint to determine data type
        const method = options.method || 'GET';

        // Grants endpoints
        if (endpoint.includes('/api/grants')) {
            if (method === 'GET') {
                const params = new URLSearchParams(endpoint.split('?')[1] || '');
                return await window.DemoData.getGrants({
                    query: params.get('query'),
                    status: params.get('status'),
                    page: params.get('page'),
                    limit: params.get('limit')
                });
            }
        }

        // CRM/Contacts endpoints
        if (endpoint.includes('/api/crm') || endpoint.includes('/api/contacts')) {
            if (method === 'GET') {
                const params = new URLSearchParams(endpoint.split('?')[1] || '');
                return await window.DemoData.getContacts({
                    query: params.get('query'),
                    contactType: params.get('contactType')
                });
            }
            if (method === 'POST') {
                const body = JSON.parse(options.body || '{}');
                return await window.DemoData.createRecord('contacts', body);
            }
            if (method === 'PUT') {
                const id = endpoint.split('/').pop();
                const body = JSON.parse(options.body || '{}');
                return await window.DemoData.updateRecord('contacts', id, body);
            }
            if (method === 'DELETE') {
                const id = endpoint.split('/').pop();
                return await window.DemoData.deleteRecord('contacts', id);
            }
        }

        // Dashboard endpoints
        if (endpoint.includes('/api/dashboard')) {
            if (endpoint.includes('/stats')) {
                return await window.DemoData.getDashboardStats();
            }
            if (endpoint.includes('/activity')) {
                return await window.DemoData.getRecentActivity();
            }
        }

        // Permits endpoints
        if (endpoint.includes('/api/permits')) {
            if (method === 'GET') {
                const params = new URLSearchParams(endpoint.split('?')[1] || '');
                return await window.DemoData.getPermits({
                    status: params.get('status')
                });
            }
        }

        // Documents endpoints
        if (endpoint.includes('/api/documents')) {
            if (method === 'GET') {
                return await window.DemoData.getDocuments();
            }
        }

        // Workflows endpoints
        if (endpoint.includes('/api/workflows')) {
            if (method === 'GET') {
                return await window.DemoData.getWorkflows();
            }
        }

        // Inspections endpoints
        if (endpoint.includes('/api/inspections')) {
            if (method === 'GET') {
                return await window.DemoData.getInspections();
            }
        }

        // Payments endpoints
        if (endpoint.includes('/api/payments')) {
            if (method === 'GET') {
                return await window.DemoData.getPayments();
            }
        }

        // Default fallback - return generic success
        console.warn('Demo mode: No mock data handler for endpoint:', endpoint);
        return {
            success: true,
            message: 'Demo mode - operation simulated',
            data: []
        };
    }
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Don't auto-show login modal, let user click login button
        const user = Auth.getUser();
        if (user) {
            Auth.updateUserDisplay(user);
        }
    });
} else {
    const user = Auth.getUser();
    if (user) {
        Auth.updateUserDisplay(user);
    }
}

// Export for use in other scripts
window.Auth = Auth;

console.log('Auth module loaded');
