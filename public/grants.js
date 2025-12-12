/**
 * Grants Module - Grant Management and Applications
 * Handles all grant-related API calls and UI updates
 */

const Grants = {
    grants: [],
    applications: [],
    currentGrant: null,
    currentApplication: null,
    filters: {
        query: '',
        status: 'active',
        category: ''
    },

    /**
     * Initialize Grants module
     */
    async init() {
        console.log('Initializing Grants module...');
        await this.loadGrants();
        await this.loadApplications();
        this.setupEventListeners();
    },

    /**
     * Load grants from API
     */
    async loadGrants(filters = {}) {
        try {
            this.showLoading('grants');

            const queryParams = new URLSearchParams({
                page: 1,
                limit: 50,
                ...filters
            });

            const response = await Auth.apiCall(
                `${API_CONFIG.ENDPOINTS.GRANTS.LIST}?${queryParams}`
            );

            this.grants = response.grants || [];
            this.renderGrants();
            this.hideLoading('grants');

            console.log(`Loaded ${this.grants.length} grants`);
        } catch (error) {
            console.error('Failed to load grants:', error);
            this.showError('Failed to load grants. Please try again.');
            this.hideLoading('grants');
        }
    },

    /**
     * Load grant applications from API
     */
    async loadApplications(filters = {}) {
        try {
            const queryParams = new URLSearchParams({
                page: 1,
                limit: 50,
                ...filters
            });

            const response = await Auth.apiCall(
                `${API_CONFIG.ENDPOINTS.GRANTS.APPLICATIONS.LIST}?${queryParams}`
            );

            this.applications = response.applications || [];
            console.log(`Loaded ${this.applications.length} applications`);
        } catch (error) {
            console.error('Failed to load applications:', error);
        }
    },

    /**
     * Get single grant with details
     */
    async getGrant(grantId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.GRANTS.GET(grantId)
            );

            this.currentGrant = response.grant;
            return this.currentGrant;
        } catch (error) {
            console.error('Failed to get grant:', error);
            this.showError('Failed to load grant details.');
            throw error;
        }
    },

    /**
     * Create new grant (admin only)
     */
    async createGrant(grantData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.GRANTS.CREATE,
                {
                    method: 'POST',
                    body: JSON.stringify(grantData)
                }
            );

            this.showSuccess('Grant created successfully!');
            await this.loadGrants();

            return response.grant;
        } catch (error) {
            console.error('Failed to create grant:', error);
            this.showError('Failed to create grant. Please try again.');
            throw error;
        }
    },

    /**
     * Update grant
     */
    async updateGrant(grantId, grantData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.GRANTS.UPDATE(grantId),
                {
                    method: 'PUT',
                    body: JSON.stringify(grantData)
                }
            );

            this.showSuccess('Grant updated successfully!');
            await this.loadGrants();

            return response.grant;
        } catch (error) {
            console.error('Failed to update grant:', error);
            this.showError('Failed to update grant. Please try again.');
            throw error;
        }
    },

    /**
     * Delete grant
     */
    async deleteGrant(grantId) {
        try {
            await Auth.apiCall(
                API_CONFIG.ENDPOINTS.GRANTS.DELETE(grantId),
                {
                    method: 'DELETE'
                }
            );

            this.showSuccess('Grant deleted successfully!');
            await this.loadGrants();
        } catch (error) {
            console.error('Failed to delete grant:', error);
            this.showError('Failed to delete grant. Please try again.');
            throw error;
        }
    },

    /**
     * Match grants based on criteria
     */
    async matchGrants(criteria) {
        try {
            this.showLoading('grants');

            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.GRANTS.MATCH,
                {
                    method: 'POST',
                    body: JSON.stringify(criteria)
                }
            );

            this.grants = response.matches || [];
            this.renderGrants();
            this.hideLoading('grants');

            console.log(`Found ${this.grants.length} matching grants`);
            return response.matches;
        } catch (error) {
            console.error('Failed to match grants:', error);
            this.showError('Failed to match grants.');
            this.hideLoading('grants');
            throw error;
        }
    },

    /**
     * Sync grants from external sources
     */
    async syncGrants() {
        try {
            this.showLoading('grants');
            this.showSuccess('Syncing grants from external sources...');

            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.GRANTS.SYNC,
                {
                    method: 'POST'
                }
            );

            this.showSuccess(`Synced ${response.newGrants || 0} new grants, updated ${response.updatedGrants || 0} existing grants`);
            await this.loadGrants();
            this.hideLoading('grants');

            return response;
        } catch (error) {
            console.error('Failed to sync grants:', error);
            this.showError('Failed to sync grants.');
            this.hideLoading('grants');
            throw error;
        }
    },

    /**
     * Get grant statistics
     */
    async getStats() {
        try {
            const response = await Auth.apiCall(API_CONFIG.ENDPOINTS.GRANTS.STATS);
            return response.stats;
        } catch (error) {
            console.error('Failed to get grant stats:', error);
            return null;
        }
    },

    /**
     * Create grant application
     */
    async createApplication(applicationData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.GRANTS.APPLICATIONS.CREATE,
                {
                    method: 'POST',
                    body: JSON.stringify(applicationData)
                }
            );

            this.showSuccess('Application created successfully!');
            await this.loadApplications();

            return response.application;
        } catch (error) {
            console.error('Failed to create application:', error);
            this.showError('Failed to create application. Please try again.');
            throw error;
        }
    },

    /**
     * Update grant application
     */
    async updateApplication(applicationId, applicationData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.GRANTS.APPLICATIONS.UPDATE(applicationId),
                {
                    method: 'PUT',
                    body: JSON.stringify(applicationData)
                }
            );

            this.showSuccess('Application updated successfully!');
            await this.loadApplications();

            return response.application;
        } catch (error) {
            console.error('Failed to update application:', error);
            this.showError('Failed to update application. Please try again.');
            throw error;
        }
    },

    /**
     * Submit grant application
     */
    async submitApplication(applicationId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.GRANTS.APPLICATIONS.SUBMIT(applicationId),
                {
                    method: 'POST'
                }
            );

            this.showSuccess('Application submitted successfully!');
            await this.loadApplications();

            return response.application;
        } catch (error) {
            console.error('Failed to submit application:', error);
            this.showError('Failed to submit application. Please try again.');
            throw error;
        }
    },

    /**
     * Review grant application (staff/admin)
     */
    async reviewApplication(applicationId, reviewData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.GRANTS.APPLICATIONS.REVIEW(applicationId),
                {
                    method: 'POST',
                    body: JSON.stringify(reviewData)
                }
            );

            this.showSuccess('Application reviewed successfully!');
            await this.loadApplications();

            return response.application;
        } catch (error) {
            console.error('Failed to review application:', error);
            this.showError('Failed to review application. Please try again.');
            throw error;
        }
    },

    /**
     * Make decision on grant application (admin)
     */
    async makeDecision(applicationId, decisionData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.GRANTS.APPLICATIONS.DECISION(applicationId),
                {
                    method: 'POST',
                    body: JSON.stringify(decisionData)
                }
            );

            this.showSuccess(`Application ${decisionData.status}!`);
            await this.loadApplications();

            return response.application;
        } catch (error) {
            console.error('Failed to make decision:', error);
            this.showError('Failed to make decision. Please try again.');
            throw error;
        }
    },

    /**
     * Delete grant application
     */
    async deleteApplication(applicationId) {
        try {
            await Auth.apiCall(
                API_CONFIG.ENDPOINTS.GRANTS.APPLICATIONS.DELETE(applicationId),
                {
                    method: 'DELETE'
                }
            );

            this.showSuccess('Application deleted successfully!');
            await this.loadApplications();
        } catch (error) {
            console.error('Failed to delete application:', error);
            this.showError('Failed to delete application. Please try again.');
            throw error;
        }
    },

    /**
     * Render grants in the UI
     */
    renderGrants() {
        const grantsContainer = document.getElementById('grantSearchResults');
        if (!grantsContainer) return;

        if (this.grants.length === 0) {
            grantsContainer.innerHTML = `
                <div class="text-center py-8 text-white/60">
                    <i class="fas fa-hand-holding-usd fa-3x mb-3"></i>
                    <p>No grants found</p>
                    <p class="text-sm mt-2">Try adjusting your search criteria</p>
                </div>
            `;
            return;
        }

        grantsContainer.innerHTML = this.grants.map(grant => {
            const statusColors = {
                'active': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-400/30' },
                'pending': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-400/30' },
                'closed': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-400/30' },
                'expired': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-400/30' }
            };

            const status = grant.status || 'active';
            const color = statusColors[status] || statusColors['active'];

            const daysLeft = grant.deadline ? Math.ceil((new Date(grant.deadline) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            const urgencyClass = daysLeft !== null && daysLeft < 14 ? 'text-red-400' : daysLeft !== null && daysLeft < 30 ? 'text-yellow-400' : 'text-emerald-400';

            return `
                <div class="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                     onclick="Grants.viewGrant('${grant.id}')">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                            <div class="flex items-center space-x-3 mb-2">
                                <h4 class="text-lg font-semibold text-white">${grant.title || 'Untitled Grant'}</h4>
                                <div class="${color.bg} ${color.border} border rounded-lg px-3 py-1">
                                    <span class="${color.text} text-sm font-medium capitalize">${status}</span>
                                </div>
                            </div>
                            <p class="text-white/70 text-sm mb-3">${grant.agency || 'Unknown Agency'}</p>
                            <p class="text-white/60 text-sm line-clamp-2">${grant.description || 'No description available'}</p>
                        </div>
                        <div class="text-right ml-4">
                            <div class="text-2xl font-bold text-emerald-400">
                                $${(grant.maxAmount || 0).toLocaleString()}
                            </div>
                            <div class="text-white/50 text-xs">Max Award</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
                        <div>
                            <div class="text-white/50 text-xs mb-1">Category</div>
                            <div class="text-white text-sm font-medium">${grant.category || 'General'}</div>
                        </div>
                        <div>
                            <div class="text-white/50 text-xs mb-1">Match %</div>
                            <div class="text-white text-sm font-medium">${grant.matchScore ? (grant.matchScore * 100).toFixed(0) + '%' : 'N/A'}</div>
                        </div>
                        <div>
                            <div class="text-white/50 text-xs mb-1">Deadline</div>
                            <div class="${urgencyClass} text-sm font-medium">
                                ${daysLeft !== null ? (daysLeft > 0 ? `${daysLeft} days` : 'Expired') : 'No deadline'}
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center space-x-2 mt-4">
                        <button onclick="event.stopPropagation(); Grants.viewGrant('${grant.id}')"
                                class="flex-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 py-2 rounded-lg transition-all duration-200 border border-blue-500/30">
                            <i class="fas fa-eye text-xs mr-2"></i>View Details
                        </button>
                        <button onclick="event.stopPropagation(); Grants.startApplication('${grant.id}')"
                                class="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 py-2 rounded-lg transition-all duration-200 border border-emerald-500/30">
                            <i class="fas fa-file-alt text-xs mr-2"></i>Apply Now
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * View grant details
     */
    async viewGrant(grantId) {
        try {
            const grant = await this.getGrant(grantId);
            // TODO: Show grant detail modal
            console.log('Viewing grant:', grant);
            alert(`Grant: ${grant.title}\nAgency: ${grant.agency}\nMax Amount: $${(grant.maxAmount || 0).toLocaleString()}\n\n${grant.description}`);
        } catch (error) {
            console.error('Failed to view grant:', error);
        }
    },

    /**
     * Start grant application
     */
    startApplication(grantId) {
        // TODO: Show application modal
        console.log('Starting application for grant:', grantId);
        alert('Application process coming soon. This will open a form to apply for the grant.');
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Grant search functionality would be added here
        console.log('Grant event listeners setup complete');
    },

    /**
     * Show loading state
     */
    showLoading(type) {
        if (type === 'grants') {
            const grantsContainer = document.getElementById('grantSearchResults');
            if (grantsContainer) {
                grantsContainer.innerHTML = `
                    <div class="text-center py-8 text-white/60">
                        <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
                        <p>Loading grants...</p>
                    </div>
                `;
            }
        }
    },

    /**
     * Hide loading state
     */
    hideLoading(type) {
        // Loading state is replaced by render functions
    },

    /**
     * Show error message
     */
    showError(message) {
        // TODO: Implement better error notification
        alert(`Error: ${message}`);
    },

    /**
     * Show success message
     */
    showSuccess(message) {
        // TODO: Implement better success notification
        console.log(`Success: ${message}`);
    }
};

// Export for use in other scripts
window.Grants = Grants;

// Global functions for onclick handlers in HTML
window.searchGrants = function() {
    if (window.Grants) {
        const searchInput = document.getElementById('grantSearch');
        const criteria = searchInput ? { query: searchInput.value } : {};
        Grants.matchGrants(criteria);
    }
};

window.syncGrantsFromExternal = function() {
    if (window.Grants) {
        Grants.syncGrants();
    }
};

window.showNewGrantModal = function() {
    // TODO: Implement create grant modal (admin only)
    alert('Create grant functionality coming soon (admin only).');
};

console.log('Grants module loaded');
