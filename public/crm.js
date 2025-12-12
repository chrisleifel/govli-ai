/**
 * CRM Module - Contact Relationship Management
 * Handles all CRM-related API calls and UI updates
 */

const CRM = {
    contacts: [],
    currentContact: null,
    filters: {
        query: '',
        contactType: '',
        status: 'active',
        tags: []
    },

    /**
     * Initialize CRM module
     */
    async init() {
        console.log('Initializing CRM module...');

        // Check if user is authenticated before loading data
        if (!Auth.isLoggedIn()) {
            console.warn('User not authenticated, skipping CRM initialization');
            return;
        }

        await this.loadContacts();
        this.setupEventListeners();
    },

    /**
     * Load contacts from API
     */
    async loadContacts(filters = {}) {
        try {
            this.showLoading();

            const queryParams = new URLSearchParams({
                page: 1,
                limit: 50,
                ...filters
            });

            const response = await Auth.apiCall(
                `${API_CONFIG.ENDPOINTS.CRM.LIST_CONTACTS}?${queryParams}`
            );

            this.contacts = response.contacts || [];
            this.renderContacts();
            this.hideLoading();

            console.log(`Loaded ${this.contacts.length} contacts`);
        } catch (error) {
            console.error('Failed to load contacts:', error);
            this.showError('Failed to load contacts. Please try again.');
            this.hideLoading();
        }
    },

    /**
     * Get single contact with details
     */
    async getContact(contactId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.CRM.GET_CONTACT(contactId)
            );

            this.currentContact = response.contact;
            return this.currentContact;
        } catch (error) {
            console.error('Failed to get contact:', error);
            this.showError('Failed to load contact details.');
            throw error;
        }
    },

    /**
     * Create new contact
     */
    async createContact(contactData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.CRM.CREATE_CONTACT,
                {
                    method: 'POST',
                    body: JSON.stringify(contactData)
                }
            );

            this.showSuccess('Contact created successfully!');
            await this.loadContacts();

            return response.contact;
        } catch (error) {
            console.error('Failed to create contact:', error);
            this.showError('Failed to create contact. Please try again.');
            throw error;
        }
    },

    /**
     * Update contact
     */
    async updateContact(contactId, contactData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.CRM.UPDATE_CONTACT(contactId),
                {
                    method: 'PUT',
                    body: JSON.stringify(contactData)
                }
            );

            this.showSuccess('Contact updated successfully!');
            await this.loadContacts();

            return response.contact;
        } catch (error) {
            console.error('Failed to update contact:', error);
            this.showError('Failed to update contact. Please try again.');
            throw error;
        }
    },

    /**
     * Delete contact
     */
    async deleteContact(contactId) {
        try {
            await Auth.apiCall(
                API_CONFIG.ENDPOINTS.CRM.DELETE_CONTACT(contactId),
                {
                    method: 'DELETE'
                }
            );

            this.showSuccess('Contact archived successfully!');
            await this.loadContacts();
        } catch (error) {
            console.error('Failed to delete contact:', error);
            this.showError('Failed to archive contact. Please try again.');
            throw error;
        }
    },

    /**
     * Log interaction with contact
     */
    async logInteraction(contactId, interactionData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.CRM.LOG_INTERACTION(contactId),
                {
                    method: 'POST',
                    body: JSON.stringify(interactionData)
                }
            );

            this.showSuccess('Interaction logged successfully!');
            return response.interaction;
        } catch (error) {
            console.error('Failed to log interaction:', error);
            this.showError('Failed to log interaction.');
            throw error;
        }
    },

    /**
     * Search and filter contacts
     */
    async searchAndFilter() {
        const searchInput = document.getElementById('contactSearch');
        const filterSelect = document.getElementById('contactFilter');

        const filters = {};
        if (searchInput && searchInput.value) {
            filters.query = searchInput.value;
        }
        if (filterSelect && filterSelect.value && filterSelect.value !== 'all') {
            filters.contactType = filterSelect.value;
        }

        await this.loadContacts(filters);
    },

    /**
     * Search contacts
     */
    async searchContacts(query) {
        await this.loadContacts({ query });
    },

    /**
     * Filter contacts by type
     */
    async filterByType(contactType) {
        await this.loadContacts({ contactType });
    },

    /**
     * Get CRM statistics
     */
    async getStats() {
        try {
            const response = await Auth.apiCall(API_CONFIG.ENDPOINTS.CRM.STATS);
            return response.stats;
        } catch (error) {
            console.error('Failed to get CRM stats:', error);
            return null;
        }
    },

    /**
     * Import contacts from CSV
     */
    async importContacts(csvData) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.CRM.IMPORT,
                {
                    method: 'POST',
                    body: JSON.stringify({ csvData })
                }
            );

            this.showSuccess(`Import completed: ${response.results.created} created, ${response.results.updated} updated`);
            await this.loadContacts();

            return response.results;
        } catch (error) {
            console.error('Failed to import contacts:', error);
            this.showError('Failed to import contacts.');
            throw error;
        }
    },

    /**
     * Export contacts to CSV
     */
    async exportContacts(filters = {}) {
        try {
            const queryParams = new URLSearchParams(filters);

            const response = await fetch(
                `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CRM.EXPORT}?${queryParams}`,
                {
                    headers: {
                        'Authorization': `Bearer ${Auth.getToken()}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Export failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `contacts-export-${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.showSuccess('Contacts exported successfully!');
        } catch (error) {
            console.error('Failed to export contacts:', error);
            this.showError('Failed to export contacts.');
            throw error;
        }
    },

    /**
     * Find duplicate contacts
     */
    async findDuplicates(contactId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.CRM.FIND_DUPLICATES(contactId)
            );

            return response.duplicates;
        } catch (error) {
            console.error('Failed to find duplicates:', error);
            this.showError('Failed to find duplicates.');
            throw error;
        }
    },

    /**
     * Merge duplicate contacts
     */
    async mergeDuplicates(primaryContactId, duplicateContactId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.CRM.MERGE_CONTACTS(primaryContactId),
                {
                    method: 'POST',
                    body: JSON.stringify({ duplicateContactId })
                }
            );

            this.showSuccess('Contacts merged successfully!');
            await this.loadContacts();

            return response.contact;
        } catch (error) {
            console.error('Failed to merge contacts:', error);
            this.showError('Failed to merge contacts.');
            throw error;
        }
    },

    /**
     * Render contacts in the UI (table format)
     */
    renderContacts() {
        const tableBody = document.getElementById('contactsTableBody');
        if (!tableBody) return;

        if (this.contacts.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-white/60">
                        <i class="fas fa-users fa-3x mb-3"></i>
                        <p>No contacts found</p>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = this.contacts.map(contact => {
            const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown';
            const initials = this.getInitials(contact.firstName, contact.lastName);
            const statusClass = contact.status === 'active' ? 'text-emerald-400' : 'text-gray-400';

            const typeConfig = {
                'citizen': { color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-400/30', icon: 'fas fa-user' },
                'official': { color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-400/30', icon: 'fas fa-user-tie' },
                'vendor': { color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-400/30', icon: 'fas fa-building' },
                'contractor': { color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-400/30', icon: 'fas fa-hard-hat' }
            };

            const contactType = contact.contactType || 'citizen';
            const typeInfo = typeConfig[contactType] || typeConfig['citizen'];
            const engagement = contact.totalInteractions || 0;
            const engagementPercent = Math.min(100, engagement * 10);
            const engagementColor = engagementPercent > 70 ? 'text-emerald-400' : engagementPercent > 40 ? 'text-yellow-400' : 'text-orange-400';

            return `
                <tr class="hover:bg-white/5 transition-all duration-200 border-b border-white/5">
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-4">
                            <input type="checkbox" class="rounded border-white/30 bg-white/10">
                            <div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                                <span class="text-white font-semibold">${initials}</span>
                            </div>
                            <div class="flex-1">
                                <div class="text-white font-semibold">${fullName}</div>
                                <div class="text-white/60 text-sm">${contact.email || 'No email'}</div>
                                <div class="text-white/40 text-xs">${contact.phone || 'No phone'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-2">
                            <div class="${typeInfo.bg} ${typeInfo.border} border rounded-lg px-3 py-1.5 flex items-center space-x-2">
                                <i class="${typeInfo.icon} ${typeInfo.color} text-xs"></i>
                                <span class="${typeInfo.color} font-medium text-sm capitalize">${contactType}</span>
                            </div>
                        </div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="text-white/80 font-medium">${contact.organization || 'N/A'}</div>
                        <div class="text-white/50 text-sm">${contact.address || 'No address'}</div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="text-white/80">${contact.lastInteractionDate ? new Date(contact.lastInteractionDate).toLocaleDateString() : 'Never'}</div>
                        <div class="flex items-center space-x-2 mt-1">
                            <div class="w-2 h-2 ${engagementColor.replace('text-', 'bg-')} rounded-full"></div>
                            <span class="${engagementColor} text-sm font-medium">${engagementPercent}% engaged</span>
                        </div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-2">
                            <div class="w-2 h-2 ${statusClass.replace('text-', 'bg-')} rounded-full animate-pulse"></div>
                            <span class="${statusClass} font-medium capitalize">${contact.status || 'active'}</span>
                        </div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-2">
                            <button onclick="CRM.viewContact('${contact.id}')" class="p-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg transition-all duration-200 border border-blue-500/30">
                                <i class="fas fa-eye text-xs"></i>
                            </button>
                            <button onclick="CRM.editContact('${contact.id}')" class="p-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded-lg transition-all duration-200 border border-emerald-500/30">
                                <i class="fas fa-edit text-xs"></i>
                            </button>
                            <button onclick="CRM.scheduleFollowUp('${contact.id}')" class="p-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded-lg transition-all duration-200 border border-purple-500/30">
                                <i class="fas fa-calendar text-xs"></i>
                            </button>
                            <button onclick="CRM.deleteContact('${contact.id}')" class="p-2 bg-red-600/20 hover:bg-red-600/40 text-red-300 rounded-lg transition-all duration-200 border border-red-500/30">
                                <i class="fas fa-trash text-xs"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * View contact details
     */
    async viewContact(contactId) {
        try {
            const contact = await this.getContact(contactId);
            // TODO: Show contact detail modal
            console.log('Viewing contact:', contact);
            alert(`Viewing contact: ${contact.firstName} ${contact.lastName}\nEmail: ${contact.email}\nPhone: ${contact.phone}`);
        } catch (error) {
            console.error('Failed to view contact:', error);
        }
    },

    /**
     * Edit contact
     */
    async editContact(contactId) {
        try {
            const contact = await this.getContact(contactId);
            // TODO: Show edit contact modal
            console.log('Editing contact:', contact);
            alert(`Edit functionality coming soon for: ${contact.firstName} ${contact.lastName}`);
        } catch (error) {
            console.error('Failed to edit contact:', error);
        }
    },

    /**
     * Schedule follow-up
     */
    scheduleFollowUp(contactId) {
        // TODO: Show schedule follow-up modal
        console.log('Scheduling follow-up for contact:', contactId);
        alert('Schedule follow-up functionality coming soon');
    },

    /**
     * Get initials from name
     */
    getInitials(firstName, lastName) {
        const first = (firstName || '').charAt(0).toUpperCase();
        const last = (lastName || '').charAt(0).toUpperCase();
        return first + last || '??';
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('contactSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.searchAndFilter();
                }, 300);
            });
        }

        // Filter select
        const filterSelect = document.getElementById('contactFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', () => {
                this.searchAndFilter();
            });
        }
    },

    /**
     * Show loading state
     */
    showLoading() {
        const tableBody = document.getElementById('contactsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-8 text-center text-white/60">
                        <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
                        <p>Loading contacts...</p>
                    </td>
                </tr>
            `;
        }
    },

    /**
     * Hide loading state
     */
    hideLoading() {
        // Loading state is replaced by renderContacts()
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
window.CRM = CRM;

// Global functions for onclick handlers in HTML
window.showNewContactModal = function() {
    // TODO: Implement create contact modal
    alert('Create contact functionality coming soon. This will open a modal to create a new contact.');
};

window.exportContacts = function() {
    if (window.CRM) {
        CRM.exportContacts();
    }
};

window.bulkImportContacts = function() {
    // TODO: Implement import contacts modal
    alert('Import contacts functionality coming soon. This will open a modal to upload a CSV file.');
};

// Ensure old mock functions don't interfere
window.viewContact = function(id) {
    if (window.CRM) {
        CRM.viewContact(id);
    }
};

window.editContact = function(id) {
    if (window.CRM) {
        CRM.editContact(id);
    }
};

window.deleteContact = function(id) {
    if (window.CRM && confirm('Are you sure you want to delete this contact?')) {
        CRM.deleteContact(id);
    }
};

window.scheduleFollowUp = function(id) {
    if (window.CRM) {
        CRM.scheduleFollowUp(id);
    }
};

console.log('CRM module loaded');
