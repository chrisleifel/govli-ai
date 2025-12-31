/**
 * Demo Data Generator
 * Provides comprehensive mock data for all modules when demo mode is enabled
 *
 * IMPORTANT: This file is only used when DEMO_CONFIG.enabled = true
 * All data is stored in localStorage for persistence across sessions
 */

const DemoData = {
    // Initialize demo data in localStorage if not exists
    init() {
        if (!localStorage.getItem('demo_initialized')) {
            this.resetAllData();
            localStorage.setItem('demo_initialized', 'true');
            console.log('Demo data initialized');
        }
    },

    // Reset all demo data to defaults
    resetAllData() {
        localStorage.setItem('demo_grants', JSON.stringify(this.getDefaultGrants()));
        localStorage.setItem('demo_contacts', JSON.stringify(this.getDefaultContacts()));
        localStorage.setItem('demo_permits', JSON.stringify(this.getDefaultPermits()));
        localStorage.setItem('demo_documents', JSON.stringify(this.getDefaultDocuments()));
        localStorage.setItem('demo_workflows', JSON.stringify(this.getDefaultWorkflows()));
        localStorage.setItem('demo_inspections', JSON.stringify(this.getDefaultInspections()));
        localStorage.setItem('demo_payments', JSON.stringify(this.getDefaultPayments()));
    },

    // Simulate network delay
    async delay() {
        const min = window.DEMO_CONFIG?.mockData?.minDelay || 300;
        const max = window.DEMO_CONFIG?.mockData?.maxDelay || 800;
        const delay = Math.random() * (max - min) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    },

    // ===== GRANTS MODULE =====
    getDefaultGrants() {
        return [
            {
                id: 1,
                title: 'Community Development Block Grant',
                agency: 'HUD',
                amount: 500000,
                deadline: '2025-03-15',
                status: 'Open',
                category: 'Housing',
                description: 'Federal funding for community development projects',
                matchRequired: 25,
                eligibility: 'Local governments, non-profits'
            },
            {
                id: 2,
                title: 'Infrastructure Investment Grant',
                agency: 'DOT',
                amount: 2000000,
                deadline: '2025-04-30',
                status: 'Open',
                category: 'Infrastructure',
                description: 'Transportation infrastructure improvements',
                matchRequired: 20,
                eligibility: 'State and local governments'
            },
            {
                id: 3,
                title: 'Public Safety Technology Grant',
                agency: 'DOJ',
                amount: 750000,
                deadline: '2025-02-28',
                status: 'Open',
                category: 'Public Safety',
                description: 'Modernize law enforcement technology',
                matchRequired: 10,
                eligibility: 'Law enforcement agencies'
            },
            {
                id: 4,
                title: 'Environmental Sustainability Grant',
                agency: 'EPA',
                amount: 350000,
                deadline: '2025-05-15',
                status: 'Open',
                category: 'Environment',
                description: 'Green infrastructure and sustainability initiatives',
                matchRequired: 15,
                eligibility: 'Municipalities, counties'
            },
            {
                id: 5,
                title: 'Workforce Development Program',
                agency: 'DOL',
                amount: 425000,
                deadline: '2025-03-01',
                status: 'Applied',
                category: 'Education',
                description: 'Job training and workforce development',
                matchRequired: 25,
                eligibility: 'Educational institutions, workforce boards'
            }
        ];
    },

    async getGrants(filters = {}) {
        await this.delay();
        let grants = JSON.parse(localStorage.getItem('demo_grants') || '[]');

        // Apply filters
        if (filters.query) {
            const query = filters.query.toLowerCase();
            grants = grants.filter(g =>
                g.title.toLowerCase().includes(query) ||
                g.agency.toLowerCase().includes(query) ||
                g.category.toLowerCase().includes(query)
            );
        }

        if (filters.status) {
            grants = grants.filter(g => g.status === filters.status);
        }

        return {
            success: true,
            grants: grants,
            total: grants.length,
            page: filters.page || 1,
            limit: filters.limit || 50
        };
    },

    // ===== CRM MODULE =====
    getDefaultContacts() {
        return [
            {
                id: '1',
                firstName: 'Sarah',
                lastName: 'Johnson',
                email: 'sarah.johnson@citymail.gov',
                phone: '(555) 123-4567',
                contactType: 'citizen',
                organization: 'Downtown Residents Association',
                address: '123 Main St, Downtown',
                status: 'active',
                lastInteractionDate: '2025-01-15',
                totalInteractions: 12,
                notes: 'Active community leader, frequent permit applicant'
            },
            {
                id: '2',
                firstName: 'Detective',
                lastName: 'Chen',
                email: 'j.chen@citypd.gov',
                phone: '(555) 234-5678',
                contactType: 'official',
                organization: 'City Police Department',
                address: 'Police Headquarters',
                status: 'active',
                lastInteractionDate: '2025-01-20',
                totalInteractions: 8,
                notes: 'Primary contact for CJIS compliance'
            },
            {
                id: '3',
                firstName: 'TechCorp',
                lastName: 'Solutions',
                email: 'contracts@techcorp.com',
                phone: '(555) 345-6789',
                contactType: 'vendor',
                organization: 'TechCorp Solutions Inc.',
                address: '456 Business Park Dr',
                status: 'active',
                lastInteractionDate: '2025-01-10',
                totalInteractions: 15,
                notes: 'IT services contractor, current contract expires Q4 2025'
            }
        ];
    },

    async getContacts(filters = {}) {
        await this.delay();
        let contacts = JSON.parse(localStorage.getItem('demo_contacts') || '[]');

        if (filters.query) {
            const query = filters.query.toLowerCase();
            contacts = contacts.filter(c =>
                c.firstName?.toLowerCase().includes(query) ||
                c.lastName?.toLowerCase().includes(query) ||
                c.email?.toLowerCase().includes(query) ||
                c.organization?.toLowerCase().includes(query)
            );
        }

        if (filters.contactType && filters.contactType !== 'all') {
            contacts = contacts.filter(c => c.contactType === filters.contactType);
        }

        return {
            success: true,
            contacts: contacts,
            total: contacts.length
        };
    },

    // ===== DASHBOARD MODULE =====
    async getDashboardStats() {
        await this.delay();
        return {
            success: true,
            stats: {
                totalPermits: 156,
                pendingReviews: 23,
                approvedToday: 8,
                activeWorkflows: 12,
                documentsProcessed: 342,
                totalRevenue: 45780,
                complianceScore: 97.5,
                systemHealth: 99.2,
                activeUsers: 47,
                avgProcessingTime: 2.4
            }
        };
    },

    async getRecentActivity() {
        await this.delay();
        return {
            success: true,
            activities: [
                {
                    id: 1,
                    type: 'permit_approved',
                    title: 'Building Permit #BP-2025-0156 Approved',
                    user: 'J. Smith',
                    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
                    icon: 'fa-check-circle',
                    color: 'green'
                },
                {
                    id: 2,
                    type: 'document_uploaded',
                    title: 'Construction Plans Uploaded',
                    user: 'M. Davis',
                    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
                    icon: 'fa-file-upload',
                    color: 'blue'
                },
                {
                    id: 3,
                    type: 'inspection_scheduled',
                    title: 'Final Inspection Scheduled',
                    user: 'R. Johnson',
                    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
                    icon: 'fa-calendar-check',
                    color: 'purple'
                }
            ]
        };
    },

    // ===== PERMITS MODULE =====
    getDefaultPermits() {
        return [
            {
                id: 'BP-2025-0156',
                type: 'Building Permit',
                applicant: 'John Smith',
                address: '789 Oak Street',
                status: 'Under Review',
                submittedDate: '2025-01-15',
                reviewedBy: null,
                estimatedCompletion: '2025-02-01',
                fee: 450
            },
            {
                id: 'BP-2025-0155',
                type: 'Renovation Permit',
                applicant: 'Jane Doe',
                address: '321 Elm Avenue',
                status: 'Approved',
                submittedDate: '2025-01-10',
                reviewedBy: 'Inspector Johnson',
                estimatedCompletion: '2025-01-25',
                fee: 275
            }
        ];
    },

    async getPermits(filters = {}) {
        await this.delay();
        let permits = JSON.parse(localStorage.getItem('demo_permits') || '[]');

        if (filters.status) {
            permits = permits.filter(p => p.status === filters.status);
        }

        return {
            success: true,
            permits: permits,
            total: permits.length
        };
    },

    // ===== DOCUMENTS MODULE =====
    getDefaultDocuments() {
        return [
            {
                id: 'DOC-001',
                name: 'Construction Plans.pdf',
                type: 'application/pdf',
                size: 2457600,
                uploadedBy: 'Sarah Johnson',
                uploadedDate: '2025-01-15',
                category: 'Plans',
                status: 'Approved',
                tags: ['building', 'residential']
            },
            {
                id: 'DOC-002',
                name: 'Site Survey.pdf',
                type: 'application/pdf',
                size: 1835200,
                uploadedBy: 'John Smith',
                uploadedDate: '2025-01-18',
                category: 'Surveys',
                status: 'Under Review',
                tags: ['survey', 'commercial']
            }
        ];
    },

    async getDocuments(filters = {}) {
        await this.delay();
        let documents = JSON.parse(localStorage.getItem('demo_documents') || '[]');

        return {
            success: true,
            documents: documents,
            total: documents.length
        };
    },

    // ===== WORKFLOWS MODULE =====
    getDefaultWorkflows() {
        return [
            {
                id: 'WF-001',
                name: 'Building Permit Review',
                status: 'Active',
                totalSteps: 8,
                completedSteps: 5,
                createdDate: '2025-01-10',
                lastUpdated: '2025-01-20',
                assignedTo: 'Planning Department'
            },
            {
                id: 'WF-002',
                name: 'Business License Application',
                status: 'Pending',
                totalSteps: 5,
                completedSteps: 2,
                createdDate: '2025-01-15',
                lastUpdated: '2025-01-18',
                assignedTo: 'Licensing Department'
            }
        ];
    },

    async getWorkflows(filters = {}) {
        await this.delay();
        let workflows = JSON.parse(localStorage.getItem('demo_workflows') || '[]');

        return {
            success: true,
            workflows: workflows,
            total: workflows.length
        };
    },

    // ===== INSPECTIONS MODULE =====
    getDefaultInspections() {
        return [
            {
                id: 'INS-001',
                permitId: 'BP-2025-0156',
                type: 'Foundation Inspection',
                scheduledDate: '2025-02-01',
                inspector: 'Mike Rodriguez',
                status: 'Scheduled',
                address: '789 Oak Street',
                notes: 'Initial foundation inspection'
            },
            {
                id: 'INS-002',
                permitId: 'BP-2025-0155',
                type: 'Final Inspection',
                scheduledDate: '2025-01-25',
                inspector: 'Sarah Chen',
                status: 'Completed',
                address: '321 Elm Avenue',
                notes: 'Final inspection - Passed'
            }
        ];
    },

    async getInspections(filters = {}) {
        await this.delay();
        let inspections = JSON.parse(localStorage.getItem('demo_inspections') || '[]');

        return {
            success: true,
            inspections: inspections,
            total: inspections.length
        };
    },

    // ===== PAYMENTS MODULE =====
    getDefaultPayments() {
        return [
            {
                id: 'PAY-001',
                amount: 450.00,
                type: 'Permit Fee',
                status: 'Completed',
                paidBy: 'John Smith',
                paidDate: '2025-01-15',
                method: 'Credit Card',
                referenceNumber: 'BP-2025-0156'
            },
            {
                id: 'PAY-002',
                amount: 275.00,
                type: 'Inspection Fee',
                status: 'Pending',
                paidBy: 'Jane Doe',
                paidDate: null,
                method: null,
                referenceNumber: 'BP-2025-0155'
            }
        ];
    },

    async getPayments(filters = {}) {
        await this.delay();
        let payments = JSON.parse(localStorage.getItem('demo_payments') || '[]');

        return {
            success: true,
            payments: payments,
            total: payments.length
        };
    },

    // ===== CRUD OPERATIONS =====
    async createRecord(type, data) {
        await this.delay();
        const key = `demo_${type}`;
        let records = JSON.parse(localStorage.getItem(key) || '[]');

        // Generate new ID
        data.id = type + '-' + Date.now();
        records.push(data);

        localStorage.setItem(key, JSON.stringify(records));

        return {
            success: true,
            data: data,
            message: `${type} created successfully`
        };
    },

    async updateRecord(type, id, data) {
        await this.delay();
        const key = `demo_${type}`;
        let records = JSON.parse(localStorage.getItem(key) || '[]');

        const index = records.findIndex(r => r.id === id);
        if (index !== -1) {
            records[index] = { ...records[index], ...data };
            localStorage.setItem(key, JSON.stringify(records));

            return {
                success: true,
                data: records[index],
                message: `${type} updated successfully`
            };
        }

        return {
            success: false,
            error: `${type} not found`
        };
    },

    async deleteRecord(type, id) {
        await this.delay();
        const key = `demo_${type}`;
        let records = JSON.parse(localStorage.getItem(key) || '[]');

        const filtered = records.filter(r => r.id !== id);
        localStorage.setItem(key, JSON.stringify(filtered));

        return {
            success: true,
            message: `${type} deleted successfully`
        };
    }
};

// Initialize demo data when script loads
if (window.DEMO_CONFIG?.enabled) {
    DemoData.init();
}

// Make available globally
window.DemoData = DemoData;

console.log('Demo Data module loaded');
