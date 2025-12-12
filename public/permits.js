/**
 * Permits Module - Permit Management and Processing
 * Handles all permit-related API calls and UI updates
 */

const Permits = {
    permits: [],
    currentPermit: null,
    stats: null,
    filters: {
        query: '',
        status: '',
        type: ''
    },

    /**
     * Initialize Permits module
     */
    async init() {
        console.log('Initializing Permits module...');
        await this.loadPermits();
        await this.loadStats();
        this.setupEventListeners();
    },

    /**
     * Load permits from API
     */
    async loadPermits(filters = {}) {
        try {
            this.showLoading();

            const queryParams = new URLSearchParams({
                page: 1,
                limit: 50,
                ...filters
            });

            const response = await Auth.apiCall(
                `${API_CONFIG.ENDPOINTS.PERMITS.LIST}?${queryParams}`
            );

            this.permits = response.permits || [];
            this.renderPermits();
            this.hideLoading();

            console.log(`Loaded ${this.permits.length} permits`);
        } catch (error) {
            console.error('Failed to load permits:', error);
            this.showError('Failed to load permits. Please try again.');
            this.hideLoading();
        }
    },

    /**
     * Get single permit with details
     */
    async getPermit(permitId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.PERMITS.GET(permitId)
            );

            this.currentPermit = response.permit;
            return this.currentPermit;
        } catch (error) {
            console.error('Failed to get permit:', error);
            this.showError('Failed to load permit details.');
            throw error;
        }
    },

    /**
     * Create new permit
     */
    async createPermit(permitData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.PERMITS.CREATE,
                {
                    method: 'POST',
                    body: JSON.stringify(permitData)
                }
            );

            this.showSuccess('Permit created successfully!');
            await this.loadPermits();

            return response.permit;
        } catch (error) {
            console.error('Failed to create permit:', error);
            this.showError('Failed to create permit. Please try again.');
            throw error;
        }
    },

    /**
     * Update permit
     */
    async updatePermit(permitId, permitData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.PERMITS.UPDATE(permitId),
                {
                    method: 'PUT',
                    body: JSON.stringify(permitData)
                }
            );

            this.showSuccess('Permit updated successfully!');
            await this.loadPermits();

            return response.permit;
        } catch (error) {
            console.error('Failed to update permit:', error);
            this.showError('Failed to update permit. Please try again.');
            throw error;
        }
    },

    /**
     * Update permit status
     */
    async updatePermitStatus(permitId, status) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.PERMITS.UPDATE_STATUS(permitId),
                {
                    method: 'PATCH',
                    body: JSON.stringify({ status })
                }
            );

            this.showSuccess(`Permit status updated to ${status}!`);
            await this.loadPermits();

            return response.permit;
        } catch (error) {
            console.error('Failed to update permit status:', error);
            this.showError('Failed to update permit status.');
            throw error;
        }
    },

    /**
     * Delete permit
     */
    async deletePermit(permitId) {
        try {
            await Auth.apiCall(
                API_CONFIG.ENDPOINTS.PERMITS.DELETE(permitId),
                {
                    method: 'DELETE'
                }
            );

            this.showSuccess('Permit deleted successfully!');
            await this.loadPermits();
        } catch (error) {
            console.error('Failed to delete permit:', error);
            this.showError('Failed to delete permit. Please try again.');
            throw error;
        }
    },

    /**
     * Search permits
     */
    async searchPermits(query) {
        try {
            this.showLoading();

            const queryParams = new URLSearchParams({
                q: query,
                page: 1,
                limit: 50
            });

            const response = await Auth.apiCall(
                `${API_CONFIG.ENDPOINTS.PERMITS.SEARCH}?${queryParams}`
            );

            this.permits = response.permits || [];
            this.renderPermits();
            this.hideLoading();

            console.log(`Found ${this.permits.length} permits matching "${query}"`);
        } catch (error) {
            console.error('Failed to search permits:', error);
            this.showError('Failed to search permits.');
            this.hideLoading();
        }
    },

    /**
     * Load permit statistics
     */
    async loadStats() {
        try {
            const response = await Auth.apiCall(API_CONFIG.ENDPOINTS.PERMITS.STATS);
            this.stats = response.statistics || response;
            console.log('Permit stats loaded:', this.stats);
            return this.stats;
        } catch (error) {
            console.error('Failed to load permit stats:', error);
            return null;
        }
    },

    /**
     * Render permits in the UI
     */
    renderPermits() {
        const permitsContainer = document.getElementById('permitsTableBody');
        if (!permitsContainer) {
            // Try alternate container ID
            const altContainer = document.getElementById('permitsList');
            if (!altContainer) return;
            this.renderPermitsCards(altContainer);
            return;
        }

        if (this.permits.length === 0) {
            permitsContainer.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-white/60">
                        <i class="fas fa-file-alt fa-3x mb-3"></i>
                        <p>No permits found</p>
                    </td>
                </tr>
            `;
            return;
        }

        permitsContainer.innerHTML = this.permits.map(permit => {
            const statusColors = {
                'submitted': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-400/30' },
                'under_review': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-400/30' },
                'approved': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-400/30' },
                'rejected': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-400/30' },
                'pending': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-400/30' }
            };

            const status = permit.status || 'submitted';
            const color = statusColors[status] || statusColors['submitted'];

            return `
                <tr class="hover:bg-white/5 transition-all duration-200 border-b border-white/5">
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                                <i class="fas fa-file-alt text-white text-sm"></i>
                            </div>
                            <div>
                                <div class="text-white font-semibold">${permit.permitNumber || 'N/A'}</div>
                                <div class="text-white/60 text-sm">${permit.type || 'Unknown Type'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="text-white font-medium">${permit.applicantName || 'Unknown'}</div>
                        <div class="text-white/60 text-sm">${permit.applicantEmail || 'No email'}</div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="text-white/80">${permit.propertyAddress || 'No address'}</div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="${color.bg} ${color.border} border rounded-lg px-3 py-1.5 inline-flex items-center">
                            <span class="${color.text} font-medium text-sm capitalize">${status.replace('_', ' ')}</span>
                        </div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="text-white/80 text-sm">${permit.createdAt ? new Date(permit.createdAt).toLocaleDateString() : 'N/A'}</div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-2">
                            <button onclick="Permits.viewPermit('${permit.id}')"
                                    class="p-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg transition-all duration-200 border border-blue-500/30">
                                <i class="fas fa-eye text-xs"></i>
                            </button>
                            ${Auth.hasRole('staff') ? `
                                <button onclick="Permits.editPermit('${permit.id}')"
                                        class="p-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded-lg transition-all duration-200 border border-emerald-500/30">
                                    <i class="fas fa-edit text-xs"></i>
                                </button>
                                <button onclick="Permits.changeStatus('${permit.id}')"
                                        class="p-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded-lg transition-all duration-200 border border-purple-500/30">
                                    <i class="fas fa-tasks text-xs"></i>
                                </button>
                            ` : ''}
                            ${Auth.hasRole('admin') ? `
                                <button onclick="Permits.deletePermit('${permit.id}')"
                                        class="p-2 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg transition-all duration-200 border border-red-500/30">
                                    <i class="fas fa-trash text-xs"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Render permits as cards (alternate layout)
     */
    renderPermitsCards(container) {
        if (this.permits.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-white/60">
                    <i class="fas fa-file-alt fa-3x mb-3"></i>
                    <p>No permits found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.permits.map(permit => {
            const statusColors = {
                'submitted': 'bg-blue-500',
                'under_review': 'bg-yellow-500',
                'approved': 'bg-emerald-500',
                'rejected': 'bg-red-500',
                'pending': 'bg-orange-500'
            };

            const status = permit.status || 'submitted';
            const statusColor = statusColors[status] || statusColors['submitted'];

            return `
                <div class="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                     onclick="Permits.viewPermit('${permit.id}')">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                            <h4 class="text-lg font-semibold text-white mb-1">${permit.permitNumber || 'N/A'}</h4>
                            <p class="text-white/70 text-sm">${permit.type || 'Unknown Type'}</p>
                        </div>
                        <div class="${statusColor} px-3 py-1 rounded-lg">
                            <span class="text-white text-sm font-medium capitalize">${status.replace('_', ' ')}</span>
                        </div>
                    </div>

                    <div class="space-y-2 mb-4">
                        <div class="flex items-center text-white/70 text-sm">
                            <i class="fas fa-user w-5 mr-2"></i>
                            <span>${permit.applicantName || 'Unknown'}</span>
                        </div>
                        <div class="flex items-center text-white/70 text-sm">
                            <i class="fas fa-map-marker-alt w-5 mr-2"></i>
                            <span>${permit.propertyAddress || 'No address'}</span>
                        </div>
                        <div class="flex items-center text-white/70 text-sm">
                            <i class="fas fa-calendar w-5 mr-2"></i>
                            <span>${permit.createdAt ? new Date(permit.createdAt).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>

                    <div class="flex items-center space-x-2 pt-4 border-t border-white/10">
                        <button onclick="event.stopPropagation(); Permits.viewPermit('${permit.id}')"
                                class="flex-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 py-2 rounded-lg transition-all duration-200 border border-blue-500/30 text-sm">
                            <i class="fas fa-eye text-xs mr-2"></i>View
                        </button>
                        ${Auth.hasRole('staff') ? `
                            <button onclick="event.stopPropagation(); Permits.editPermit('${permit.id}')"
                                    class="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 py-2 rounded-lg transition-all duration-200 border border-emerald-500/30 text-sm">
                                <i class="fas fa-edit text-xs mr-2"></i>Edit
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * View permit details
     */
    async viewPermit(permitId) {
        try {
            const permit = await this.getPermit(permitId);
            // TODO: Show permit detail modal
            console.log('Viewing permit:', permit);
            alert(`Permit: ${permit.permitNumber}\nType: ${permit.type}\nStatus: ${permit.status}\nApplicant: ${permit.applicantName}\nAddress: ${permit.propertyAddress}\n\nDescription: ${permit.projectDescription || 'No description'}`);
        } catch (error) {
            console.error('Failed to view permit:', error);
        }
    },

    /**
     * Edit permit
     */
    async editPermit(permitId) {
        try {
            const permit = await this.getPermit(permitId);
            // TODO: Show edit permit modal
            console.log('Editing permit:', permit);
            alert(`Edit functionality coming soon for permit: ${permit.permitNumber}`);
        } catch (error) {
            console.error('Failed to edit permit:', error);
        }
    },

    /**
     * Change permit status
     */
    async changeStatus(permitId) {
        const newStatus = prompt('Enter new status (submitted, under_review, approved, rejected):');
        if (newStatus && ['submitted', 'under_review', 'approved', 'rejected'].includes(newStatus)) {
            try {
                await this.updatePermitStatus(permitId, newStatus);
            } catch (error) {
                console.error('Failed to change status:', error);
            }
        } else if (newStatus) {
            alert('Invalid status. Please use: submitted, under_review, approved, or rejected');
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Permit search functionality would be added here
        console.log('Permit event listeners setup complete');
    },

    /**
     * Show loading state
     */
    showLoading() {
        const permitsContainer = document.getElementById('permitsTableBody') || document.getElementById('permitsList');
        if (permitsContainer) {
            if (permitsContainer.tagName === 'TBODY') {
                permitsContainer.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-8 text-center text-white/60">
                            <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
                            <p>Loading permits...</p>
                        </td>
                    </tr>
                `;
            } else {
                permitsContainer.innerHTML = `
                    <div class="text-center py-8 text-white/60">
                        <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
                        <p>Loading permits...</p>
                    </div>
                `;
            }
        }
    },

    /**
     * Hide loading state
     */
    hideLoading() {
        // Loading state is replaced by render functions
    },

    /**
     * Show error message
     */
    showError(message) {
        // TODO: Implement better error notification
        console.error(message);
        alert(`Error: ${message}`);
    },

    /**
     * Show success message
     */
    showSuccess(message) {
        // TODO: Implement better success notification
        console.log(`Success: ${message}`);
        alert(message);
    }
};

// Export for use in other scripts
window.Permits = Permits;

// Global functions for onclick handlers
window.createNewPermit = function() {
    // TODO: Show create permit modal
    alert('Create permit functionality coming soon. This will open a form to submit a new permit application.');
};

window.searchPermits = function() {
    const searchInput = document.getElementById('permitSearch');
    if (searchInput && searchInput.value.trim()) {
        Permits.searchPermits(searchInput.value.trim());
    } else {
        Permits.loadPermits();
    }
};

console.log('Permits module loaded');
