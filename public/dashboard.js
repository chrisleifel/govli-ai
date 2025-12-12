/**
 * Dashboard Module - Real-time Analytics and Metrics
 * Handles dashboard statistics and analytics data from API
 */

const Dashboard = {
    stats: null,
    permitAnalytics: null,
    workflowAnalytics: null,
    taskAnalytics: null,
    refreshInterval: null,

    /**
     * Initialize Dashboard module
     */
    async init() {
        console.log('Initializing Dashboard module...');

        // Check if user is authenticated before loading data
        if (!Auth.isLoggedIn()) {
            console.warn('User not authenticated, skipping dashboard initialization');
            return;
        }

        await this.loadDashboardStats();
        this.setupAutoRefresh();
    },

    /**
     * Load dashboard statistics from API
     */
    async loadDashboardStats() {
        try {
            const response = await Auth.apiCall(API_CONFIG.ENDPOINTS.ANALYTICS.DASHBOARD);
            this.stats = response.stats || response;
            this.updateDashboardUI();
            console.log('Dashboard stats loaded:', this.stats);
        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
            this.showError('Failed to load dashboard statistics.');
        }
    },

    /**
     * Load permit analytics
     */
    async loadPermitAnalytics() {
        try {
            const response = await Auth.apiCall(API_CONFIG.ENDPOINTS.ANALYTICS.PERMITS);
            this.permitAnalytics = response;
            console.log('Permit analytics loaded:', this.permitAnalytics);
            return this.permitAnalytics;
        } catch (error) {
            console.error('Failed to load permit analytics:', error);
            return null;
        }
    },

    /**
     * Load workflow analytics
     */
    async loadWorkflowAnalytics() {
        try {
            const response = await Auth.apiCall(API_CONFIG.ENDPOINTS.ANALYTICS.WORKFLOWS);
            this.workflowAnalytics = response;
            console.log('Workflow analytics loaded:', this.workflowAnalytics);
            return this.workflowAnalytics;
        } catch (error) {
            console.error('Failed to load workflow analytics:', error);
            return null;
        }
    },

    /**
     * Load task analytics
     */
    async loadTaskAnalytics() {
        try {
            const response = await Auth.apiCall(API_CONFIG.ENDPOINTS.ANALYTICS.TASKS);
            this.taskAnalytics = response;
            console.log('Task analytics loaded:', this.taskAnalytics);
            return this.taskAnalytics;
        } catch (error) {
            console.error('Failed to load task analytics:', error);
            return null;
        }
    },

    /**
     * Load workflow performance metrics
     */
    async loadWorkflowPerformance() {
        try {
            const response = await Auth.apiCall(API_CONFIG.ENDPOINTS.ANALYTICS.WORKFLOW_PERFORMANCE);
            console.log('Workflow performance loaded:', response);
            return response;
        } catch (error) {
            console.error('Failed to load workflow performance:', error);
            return null;
        }
    },

    /**
     * Load staff productivity metrics
     */
    async loadStaffProductivity() {
        try {
            const response = await Auth.apiCall(API_CONFIG.ENDPOINTS.ANALYTICS.STAFF_PRODUCTIVITY);
            console.log('Staff productivity loaded:', response);
            return response;
        } catch (error) {
            console.error('Failed to load staff productivity:', error);
            return null;
        }
    },

    /**
     * Update dashboard UI with real data
     */
    updateDashboardUI() {
        if (!this.stats) return;

        // Find and update the stat cards in the dashboard
        const dashboardContent = document.getElementById('dashboard-content');
        if (!dashboardContent) return;

        // Update Active Workflows stat
        const workflowStats = dashboardContent.querySelectorAll('.glass')[0];
        if (workflowStats) {
            const workflowCount = workflowStats.querySelector('.text-3xl');
            if (workflowCount && this.stats.activeWorkflows !== undefined) {
                workflowCount.textContent = this.stats.activeWorkflows || 0;
            }
        }

        // Update Security Alerts stat
        const alertStats = dashboardContent.querySelectorAll('.glass')[1];
        if (alertStats) {
            const alertCount = alertStats.querySelector('.text-3xl');
            if (alertCount && this.stats.securityAlerts !== undefined) {
                alertCount.textContent = this.stats.securityAlerts || 0;
            }
        }

        // Update Processing Efficiency stat
        const efficiencyStats = dashboardContent.querySelectorAll('.glass')[2];
        if (efficiencyStats) {
            const efficiencyPercent = efficiencyStats.querySelector('.text-3xl');
            if (efficiencyPercent && this.stats.processingEfficiency !== undefined) {
                const efficiency = Math.round(this.stats.processingEfficiency * 100);
                efficiencyPercent.textContent = `${efficiency}%`;
            }
        }

        console.log('Dashboard UI updated with real stats');
    },

    /**
     * Setup auto-refresh for dashboard stats
     */
    setupAutoRefresh(intervalMs = 30000) {
        // Refresh dashboard stats every 30 seconds
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            // Only refresh if user is authenticated and dashboard is visible
            if (!Auth.isLoggedIn()) {
                console.warn('User not authenticated, skipping auto-refresh');
                return;
            }

            const dashboardContent = document.getElementById('dashboard-content');
            if (dashboardContent && dashboardContent.style.display !== 'none') {
                this.loadDashboardStats();
            }
        }, intervalMs);

        console.log(`Dashboard auto-refresh enabled (every ${intervalMs/1000}s)`);
    },

    /**
     * Export analytics data
     */
    async exportAnalytics(dataType) {
        try {
            const response = await fetch(
                `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ANALYTICS.EXPORT(dataType)}`,
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
            a.download = `analytics-${dataType}-${Date.now()}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.showSuccess(`${dataType} analytics exported successfully!`);
        } catch (error) {
            console.error('Failed to export analytics:', error);
            this.showError('Failed to export analytics data.');
            throw error;
        }
    },

    /**
     * Cleanup on module unload
     */
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
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
    }
};

// Export for use in other scripts
window.Dashboard = Dashboard;

// Global functions for onclick handlers
window.executeQuickAction = function(action) {
    console.log('Quick action requested:', action);

    switch(action) {
        case 'analyze':
            if (window.Dashboard) {
                Dashboard.loadDashboardStats();
                Dashboard.loadPermitAnalytics();
                Dashboard.loadWorkflowAnalytics();
                Dashboard.loadTaskAnalytics();
                alert('System analysis complete. Check console for detailed analytics.');
            }
            break;
        case 'optimize':
            alert('Auto-optimization feature coming soon. This will analyze and optimize system performance.');
            break;
        case 'secure':
            alert('Security scan feature coming soon. This will perform a comprehensive security audit.');
            break;
        default:
            alert(`Quick action: ${action}`);
    }
};

window.toggleAdvancedMode = function() {
    const btn = document.getElementById('advancedModeBtn');
    if (btn) {
        const isAdvanced = btn.classList.toggle('bg-purple-600/50');
        alert(isAdvanced ? 'Advanced mode enabled' : 'Advanced mode disabled');
    }
};

window.sendAdvancedAdminMessage = function() {
    const input = document.getElementById('adminUserInput');
    const commandType = document.getElementById('commandType');

    if (input && input.value.trim()) {
        const message = input.value.trim();
        const type = commandType ? commandType.value : 'natural';

        console.log('Admin command:', { type, message });

        // Add message to chat history
        const chatHistory = document.getElementById('adminChatHistory');
        if (chatHistory) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'text-white/80 mb-2';
            messageDiv.innerHTML = `
                <span class="font-semibold text-purple-300">You:</span>
                <span>${message}</span>
            `;
            chatHistory.appendChild(messageDiv);

            // Simulate AI response
            setTimeout(() => {
                const responseDiv = document.createElement('div');
                responseDiv.className = 'text-green-300 mb-2';
                responseDiv.innerHTML = `
                    <i class="fas fa-brain mr-2"></i>
                    <span class="font-semibold text-blue-300">AI Pro:</span>
                    <span>Command received and processing. This is a placeholder response. Real AI integration coming soon.</span>
                `;
                chatHistory.appendChild(responseDiv);
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }, 500);
        }

        input.value = '';
    }
};

console.log('Dashboard module loaded');
