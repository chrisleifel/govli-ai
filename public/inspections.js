/**
 * Inspections Module - Inspection Management and Scheduling
 * Handles all inspection-related API calls and UI updates
 */

const Inspections = {
    inspections: [],
    currentInspection: null,

    /**
     * Initialize Inspections module
     */
    async init() {
        console.log('Initializing Inspections module...');
        await this.loadInspections();
        this.setupEventListeners();
    },

    /**
     * Load inspections from API
     */
    async loadInspections(filters = {}) {
        try {
            this.showLoading();

            const queryParams = new URLSearchParams({
                page: 1,
                limit: 50,
                ...filters
            });

            const response = await Auth.apiCall(
                `${API_CONFIG.ENDPOINTS.INSPECTIONS.LIST}?${queryParams}`
            );

            this.inspections = response.inspections || [];
            this.renderInspections();
            this.hideLoading();

            console.log(`Loaded ${this.inspections.length} inspections`);
        } catch (error) {
            console.error('Failed to load inspections:', error);
            this.showError('Failed to load inspections. Please try again.');
            this.hideLoading();
        }
    },

    /**
     * Get single inspection with details
     */
    async getInspection(inspectionId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.INSPECTIONS.GET(inspectionId)
            );

            this.currentInspection = response.inspection;
            return this.currentInspection;
        } catch (error) {
            console.error('Failed to get inspection:', error);
            this.showError('Failed to load inspection details.');
            throw error;
        }
    },

    /**
     * Create new inspection
     */
    async createInspection(inspectionData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.INSPECTIONS.CREATE,
                {
                    method: 'POST',
                    body: JSON.stringify(inspectionData)
                }
            );

            this.showSuccess('Inspection scheduled successfully!');
            await this.loadInspections();

            return response.inspection;
        } catch (error) {
            console.error('Failed to create inspection:', error);
            this.showError('Failed to schedule inspection. Please try again.');
            throw error;
        }
    },

    /**
     * Update inspection
     */
    async updateInspection(inspectionId, inspectionData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.INSPECTIONS.UPDATE(inspectionId),
                {
                    method: 'PUT',
                    body: JSON.stringify(inspectionData)
                }
            );

            this.showSuccess('Inspection updated successfully!');
            await this.loadInspections();

            return response.inspection;
        } catch (error) {
            console.error('Failed to update inspection:', error);
            this.showError('Failed to update inspection. Please try again.');
            throw error;
        }
    },

    /**
     * Complete inspection
     */
    async completeInspection(inspectionId, completionData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.INSPECTIONS.COMPLETE(inspectionId),
                {
                    method: 'POST',
                    body: JSON.stringify(completionData)
                }
            );

            this.showSuccess('Inspection completed successfully!');
            await this.loadInspections();

            return response.inspection;
        } catch (error) {
            console.error('Failed to complete inspection:', error);
            this.showError('Failed to complete inspection.');
            throw error;
        }
    },

    /**
     * Cancel inspection
     */
    async cancelInspection(inspectionId, reason = '') {
        try {
            await Auth.apiCall(
                API_CONFIG.ENDPOINTS.INSPECTIONS.CANCEL(inspectionId),
                {
                    method: 'DELETE',
                    body: JSON.stringify({ reason })
                }
            );

            this.showSuccess('Inspection cancelled successfully!');
            await this.loadInspections();
        } catch (error) {
            console.error('Failed to cancel inspection:', error);
            this.showError('Failed to cancel inspection.');
            throw error;
        }
    },

    /**
     * Get checklist template
     */
    async getChecklistTemplate(permitType, inspectionType) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.INSPECTIONS.CHECKLIST_TEMPLATE(permitType, inspectionType)
            );

            console.log('Checklist template:', response.checklist);
            return response.checklist;
        } catch (error) {
            console.error('Failed to get checklist template:', error);
            return null;
        }
    },

    /**
     * Get required inspections for permit type
     */
    async getRequiredInspections(permitType) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.INSPECTIONS.REQUIRED_INSPECTIONS(permitType)
            );

            console.log('Required inspections:', response.inspections);
            return response.inspections;
        } catch (error) {
            console.error('Failed to get required inspections:', error);
            return null;
        }
    },

    /**
     * Render inspections in the UI
     */
    renderInspections() {
        const container = document.getElementById('inspectionsTableBody') || document.getElementById('inspectionsList');
        if (!container) return;

        if (this.inspections.length === 0) {
            const emptyHTML = `
                <div class="text-center py-8 text-white/60">
                    <i class="fas fa-clipboard-check fa-3x mb-3"></i>
                    <p>No inspections found</p>
                </div>
            `;

            if (container.tagName === 'TBODY') {
                container.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-8 text-center">
                            ${emptyHTML}
                        </td>
                    </tr>
                `;
            } else {
                container.innerHTML = emptyHTML;
            }
            return;
        }

        if (container.tagName === 'TBODY') {
            this.renderInspectionsTable(container);
        } else {
            this.renderInspectionsCards(container);
        }
    },

    /**
     * Render inspections as table rows
     */
    renderInspectionsTable(container) {
        container.innerHTML = this.inspections.map(inspection => {
            const statusColors = {
                'scheduled': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-400/30' },
                'in_progress': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-400/30' },
                'completed': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-400/30' },
                'failed': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-400/30' },
                'cancelled': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-400/30' }
            };

            const status = inspection.status || 'scheduled';
            const color = statusColors[status] || statusColors['scheduled'];

            return `
                <tr class="hover:bg-white/5 transition-all duration-200 border-b border-white/5">
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-gradient-to-r from-teal-500 to-blue-500 rounded-lg flex items-center justify-center">
                                <i class="fas fa-clipboard-check text-white text-sm"></i>
                            </div>
                            <div>
                                <div class="text-white font-semibold">${inspection.type || 'General Inspection'}</div>
                                <div class="text-white/60 text-sm">Permit: ${inspection.permit?.permitNumber || 'N/A'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="text-white/80">${inspection.inspector?.name || 'Unassigned'}</div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="text-white/80">${inspection.scheduledDate ? new Date(inspection.scheduledDate).toLocaleString() : 'Not scheduled'}</div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="${color.bg} ${color.border} border rounded-lg px-3 py-1.5 inline-flex items-center">
                            <span class="${color.text} font-medium text-sm capitalize">${status.replace('_', ' ')}</span>
                        </div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-2">
                            <button onclick="Inspections.viewInspection('${inspection.id}')"
                                    class="p-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg transition-all duration-200 border border-blue-500/30">
                                <i class="fas fa-eye text-xs"></i>
                            </button>
                            ${Auth.hasRole('inspector') && status !== 'completed' && status !== 'cancelled' ? `
                                <button onclick="Inspections.completeInspection('${inspection.id}', {result: 'passed', notes: 'Inspection completed'})"
                                        class="p-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded-lg transition-all duration-200 border border-emerald-500/30">
                                    <i class="fas fa-check text-xs"></i>
                                </button>
                                <button onclick="Inspections.completeInspection('${inspection.id}', {result: 'failed', notes: 'Issues found'})"
                                        class="p-2 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg transition-all duration-200 border border-red-500/30">
                                    <i class="fas fa-times text-xs"></i>
                                </button>
                            ` : ''}
                            ${Auth.hasRole('staff') && status === 'scheduled' ? `
                                <button onclick="Inspections.cancelInspection('${inspection.id}')"
                                        class="p-2 bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 rounded-lg transition-all duration-200 border border-gray-500/30">
                                    <i class="fas fa-ban text-xs"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Render inspections as cards
     */
    renderInspectionsCards(container) {
        container.innerHTML = this.inspections.map(inspection => {
            const statusColors = {
                'scheduled': 'bg-blue-500',
                'in_progress': 'bg-yellow-500',
                'completed': 'bg-emerald-500',
                'failed': 'bg-red-500',
                'cancelled': 'bg-gray-500'
            };

            const status = inspection.status || 'scheduled';
            const statusColor = statusColors[status] || statusColors['scheduled'];

            return `
                <div class="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                     onclick="Inspections.viewInspection('${inspection.id}')">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                            <h4 class="text-lg font-semibold text-white mb-1">${inspection.type || 'General Inspection'}</h4>
                            <p class="text-white/70 text-sm">Permit: ${inspection.permit?.permitNumber || 'N/A'}</p>
                        </div>
                        <div class="${statusColor} px-3 py-1 rounded-lg">
                            <span class="text-white text-sm font-medium capitalize">${status.replace('_', ' ')}</span>
                        </div>
                    </div>

                    <div class="space-y-2 mb-4">
                        <div class="flex items-center text-white/70 text-sm">
                            <i class="fas fa-user w-5 mr-2"></i>
                            <span>${inspection.inspector?.name || 'Unassigned'}</span>
                        </div>
                        <div class="flex items-center text-white/70 text-sm">
                            <i class="fas fa-calendar w-5 mr-2"></i>
                            <span>${inspection.scheduledDate ? new Date(inspection.scheduledDate).toLocaleString() : 'Not scheduled'}</span>
                        </div>
                        ${inspection.result ? `
                            <div class="flex items-center text-white/70 text-sm">
                                <i class="fas fa-clipboard-list w-5 mr-2"></i>
                                <span>Result: ${inspection.result}</span>
                            </div>
                        ` : ''}
                    </div>

                    ${Auth.hasRole('inspector') && status !== 'completed' && status !== 'cancelled' ? `
                        <div class="flex items-center space-x-2 pt-4 border-t border-white/10">
                            <button onclick="event.stopPropagation(); Inspections.completeInspection('${inspection.id}', {result: 'passed'})"
                                    class="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 py-2 rounded-lg transition-all duration-200 border border-emerald-500/30 text-sm">
                                <i class="fas fa-check text-xs mr-2"></i>Pass
                            </button>
                            <button onclick="event.stopPropagation(); Inspections.completeInspection('${inspection.id}', {result: 'failed'})"
                                    class="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 py-2 rounded-lg transition-all duration-200 border border-red-500/30 text-sm">
                                <i class="fas fa-times text-xs mr-2"></i>Fail
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    /**
     * View inspection details
     */
    async viewInspection(inspectionId) {
        try {
            const inspection = await this.getInspection(inspectionId);
            console.log('Viewing inspection:', inspection);
            alert(`Inspection: ${inspection.type}\nPermit: ${inspection.permit?.permitNumber || 'N/A'}\nInspector: ${inspection.inspector?.name || 'Unassigned'}\nStatus: ${inspection.status}\n\nScheduled: ${inspection.scheduledDate ? new Date(inspection.scheduledDate).toLocaleString() : 'Not scheduled'}\n\nResult: ${inspection.result || 'Pending'}\nNotes: ${inspection.notes || 'None'}`);
        } catch (error) {
            console.error('Failed to view inspection:', error);
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        console.log('Inspections event listeners setup complete');
    },

    /**
     * Show loading state
     */
    showLoading() {
        const container = document.getElementById('inspectionsTableBody') || document.getElementById('inspectionsList');
        if (container) {
            const loadingHTML = `
                <div class="text-center py-8 text-white/60">
                    <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
                    <p>Loading inspections...</p>
                </div>
            `;

            if (container.tagName === 'TBODY') {
                container.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-8 text-center">
                            ${loadingHTML}
                        </td>
                    </tr>
                `;
            } else {
                container.innerHTML = loadingHTML;
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
        console.error(message);
        alert(`Error: ${message}`);
    },

    /**
     * Show success message
     */
    showSuccess(message) {
        console.log(`Success: ${message}`);
        alert(message);
    }
};

// Export for use in other scripts
window.Inspections = Inspections;

// Global functions for onclick handlers
window.scheduleInspection = function() {
    // TODO: Show inspection scheduling modal
    alert('Schedule inspection functionality coming soon. This will open a form to schedule a new inspection.');
};

console.log('Inspections module loaded');
