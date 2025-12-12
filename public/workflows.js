/**
 * Workflows Module - Workflow Automation and Execution
 * Handles all workflow-related API calls and UI updates
 */

const Workflows = {
    workflows: [],
    executions: [],
    tasks: [],
    currentWorkflow: null,
    currentExecution: null,

    /**
     * Initialize Workflows module
     */
    async init() {
        console.log('Initializing Workflows module...');
        await this.loadWorkflows();
        await this.loadExecutions();
        await this.loadTasks();
        this.setupEventListeners();
    },

    /**
     * Load workflows from API
     */
    async loadWorkflows(filters = {}) {
        try {
            const queryParams = new URLSearchParams(filters);

            const response = await Auth.apiCall(
                `${API_CONFIG.ENDPOINTS.WORKFLOWS.LIST}?${queryParams}`
            );

            this.workflows = response.workflows || [];
            console.log(`Loaded ${this.workflows.length} workflows`);
            return this.workflows;
        } catch (error) {
            console.error('Failed to load workflows:', error);
            this.showError('Failed to load workflows. Please try again.');
        }
    },

    /**
     * Get single workflow with steps
     */
    async getWorkflow(workflowId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.WORKFLOWS.GET(workflowId)
            );

            this.currentWorkflow = response.workflow;
            return this.currentWorkflow;
        } catch (error) {
            console.error('Failed to get workflow:', error);
            this.showError('Failed to load workflow details.');
            throw error;
        }
    },

    /**
     * Load workflow executions
     */
    async loadExecutions(filters = {}) {
        try {
            const queryParams = new URLSearchParams({
                page: 1,
                limit: 50,
                ...filters
            });

            const response = await Auth.apiCall(
                `${API_CONFIG.ENDPOINTS.WORKFLOWS.EXECUTIONS}?${queryParams}`
            );

            this.executions = response.executions || [];
            this.renderExecutions();
            console.log(`Loaded ${this.executions.length} workflow executions`);
        } catch (error) {
            console.error('Failed to load executions:', error);
            this.showError('Failed to load workflow executions.');
        }
    },

    /**
     * Get single workflow execution
     */
    async getExecution(executionId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.WORKFLOWS.EXECUTION_GET(executionId)
            );

            this.currentExecution = response.execution;
            return this.currentExecution;
        } catch (error) {
            console.error('Failed to get execution:', error);
            this.showError('Failed to load execution details.');
            throw error;
        }
    },

    /**
     * Resume workflow execution
     */
    async resumeExecution(executionId, data = {}) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.WORKFLOWS.RESUME(executionId),
                {
                    method: 'POST',
                    body: JSON.stringify(data)
                }
            );

            this.showSuccess('Workflow resumed successfully!');
            await this.loadExecutions();

            return response.execution;
        } catch (error) {
            console.error('Failed to resume execution:', error);
            this.showError('Failed to resume workflow.');
            throw error;
        }
    },

    /**
     * Cancel workflow execution
     */
    async cancelExecution(executionId, reason = '') {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.WORKFLOWS.CANCEL(executionId),
                {
                    method: 'POST',
                    body: JSON.stringify({ reason })
                }
            );

            this.showSuccess('Workflow cancelled successfully!');
            await this.loadExecutions();

            return response.execution;
        } catch (error) {
            console.error('Failed to cancel execution:', error);
            this.showError('Failed to cancel workflow.');
            throw error;
        }
    },

    /**
     * Load tasks
     */
    async loadTasks(filters = {}) {
        try {
            const queryParams = new URLSearchParams({
                page: 1,
                limit: 50,
                ...filters
            });

            const response = await Auth.apiCall(
                `${API_CONFIG.ENDPOINTS.TASKS.LIST}?${queryParams}`
            );

            this.tasks = response.tasks || [];
            this.renderTasks();
            console.log(`Loaded ${this.tasks.length} tasks`);
        } catch (error) {
            console.error('Failed to load tasks:', error);
            this.showError('Failed to load tasks.');
        }
    },

    /**
     * Complete task
     */
    async completeTask(taskId, completionData = {}) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.TASKS.COMPLETE(taskId),
                {
                    method: 'POST',
                    body: JSON.stringify(completionData)
                }
            );

            this.showSuccess('Task completed successfully!');
            await this.loadTasks();

            return response.task;
        } catch (error) {
            console.error('Failed to complete task:', error);
            this.showError('Failed to complete task.');
            throw error;
        }
    },

    /**
     * Render workflow executions
     */
    renderExecutions() {
        const container = document.getElementById('workflowExecutionsList');
        if (!container) return;

        if (this.executions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-white/60">
                    <i class="fas fa-project-diagram fa-3x mb-3"></i>
                    <p>No workflow executions found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.executions.map(execution => {
            const statusColors = {
                'running': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-400/30', icon: 'fa-spinner fa-spin' },
                'waiting': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-400/30', icon: 'fa-pause' },
                'completed': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-400/30', icon: 'fa-check' },
                'failed': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-400/30', icon: 'fa-times' },
                'cancelled': { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-400/30', icon: 'fa-ban' }
            };

            const status = execution.status || 'running';
            const color = statusColors[status] || statusColors['running'];

            return `
                <div class="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                     onclick="Workflows.viewExecution('${execution.id}')">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                            <h4 class="text-lg font-semibold text-white mb-1">${execution.workflow?.name || 'Unknown Workflow'}</h4>
                            <p class="text-white/70 text-sm">${execution.workflow?.description || 'No description'}</p>
                        </div>
                        <div class="${color.bg} ${color.border} border rounded-lg px-3 py-1.5 flex items-center">
                            <i class="fas ${color.icon} ${color.text} text-xs mr-2"></i>
                            <span class="${color.text} font-medium text-sm capitalize">${status}</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-4 mb-4">
                        <div>
                            <div class="text-white/50 text-xs mb-1">Current Step</div>
                            <div class="text-white text-sm font-medium">${execution.currentStep?.name || 'N/A'}</div>
                        </div>
                        <div>
                            <div class="text-white/50 text-xs mb-1">Progress</div>
                            <div class="text-white text-sm font-medium">${execution.progress || 0}%</div>
                        </div>
                        <div>
                            <div class="text-white/50 text-xs mb-1">Started</div>
                            <div class="text-white text-sm">${execution.createdAt ? new Date(execution.createdAt).toLocaleString() : 'N/A'}</div>
                        </div>
                    </div>

                    ${status === 'waiting' || status === 'running' ? `
                        <div class="flex items-center space-x-2 pt-4 border-t border-white/10">
                            ${status === 'waiting' ? `
                                <button onclick="event.stopPropagation(); Workflows.resumeExecution('${execution.id}')"
                                        class="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 py-2 rounded-lg transition-all duration-200 border border-emerald-500/30 text-sm">
                                    <i class="fas fa-play text-xs mr-2"></i>Resume
                                </button>
                            ` : ''}
                            <button onclick="event.stopPropagation(); Workflows.cancelExecution('${execution.id}')"
                                    class="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 py-2 rounded-lg transition-all duration-200 border border-red-500/30 text-sm">
                                <i class="fas fa-ban text-xs mr-2"></i>Cancel
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    /**
     * Render tasks
     */
    renderTasks() {
        const container = document.getElementById('tasksList');
        if (!container) return;

        if (this.tasks.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-white/60">
                    <i class="fas fa-tasks fa-3x mb-3"></i>
                    <p>No tasks found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.tasks.map(task => {
            const priorityColors = {
                'high': 'text-red-400',
                'medium': 'text-yellow-400',
                'low': 'text-blue-400'
            };

            const priorityColor = priorityColors[task.priority] || priorityColors['medium'];

            return `
                <div class="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all">
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex-1">
                            <h5 class="text-white font-semibold mb-1">${task.title || 'Untitled Task'}</h5>
                            <p class="text-white/60 text-sm">${task.description || 'No description'}</p>
                        </div>
                        <div class="${priorityColor} text-xs font-medium uppercase">${task.priority || 'medium'}</div>
                    </div>

                    <div class="flex items-center justify-between text-sm">
                        <div class="text-white/70">
                            <i class="fas fa-user mr-2"></i>${task.assignee?.name || 'Unassigned'}
                        </div>
                        <div class="text-white/70">
                            Due: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No deadline'}
                        </div>
                    </div>

                    ${task.status !== 'completed' && Auth.hasRole('staff') ? `
                        <button onclick="Workflows.completeTask('${task.id}')"
                                class="w-full mt-3 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 py-2 rounded-lg transition-all duration-200 border border-emerald-500/30 text-sm">
                            <i class="fas fa-check text-xs mr-2"></i>Complete Task
                        </button>
                    ` : task.status === 'completed' ? `
                        <div class="mt-3 text-center text-emerald-400 text-sm">
                            <i class="fas fa-check-circle mr-2"></i>Completed
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    },

    /**
     * View execution details
     */
    async viewExecution(executionId) {
        try {
            const execution = await this.getExecution(executionId);
            console.log('Viewing execution:', execution);
            alert(`Workflow Execution: ${execution.workflow?.name}\nStatus: ${execution.status}\nProgress: ${execution.progress}%\nCurrent Step: ${execution.currentStep?.name || 'N/A'}\n\nStarted: ${execution.createdAt ? new Date(execution.createdAt).toLocaleString() : 'N/A'}`);
        } catch (error) {
            console.error('Failed to view execution:', error);
        }
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        console.log('Workflows event listeners setup complete');
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
window.Workflows = Workflows;

console.log('Workflows module loaded');
