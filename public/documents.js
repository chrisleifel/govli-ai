/**
 * Documents Module - Document Management and Processing
 * Handles all document-related API calls and UI updates
 */

const Documents = {
    documents: [],
    currentDocument: null,
    uploadQueue: [],

    /**
     * Initialize Documents module
     */
    async init() {
        console.log('Initializing Documents module...');
        await this.loadDocuments();
        this.setupEventListeners();
    },

    /**
     * Load documents from API
     */
    async loadDocuments(filters = {}) {
        try {
            this.showLoading();

            const queryParams = new URLSearchParams({
                page: 1,
                limit: 50,
                ...filters
            });

            const response = await Auth.apiCall(
                `${API_CONFIG.ENDPOINTS.DOCUMENTS.LIST}?${queryParams}`
            );

            this.documents = response.documents || [];
            this.renderDocuments();
            this.hideLoading();

            console.log(`Loaded ${this.documents.length} documents`);
        } catch (error) {
            console.error('Failed to load documents:', error);
            this.showError('Failed to load documents. Please try again.');
            this.hideLoading();
        }
    },

    /**
     * Get single document with details
     */
    async getDocument(documentId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.DOCUMENTS.GET(documentId)
            );

            this.currentDocument = response.document;
            return this.currentDocument;
        } catch (error) {
            console.error('Failed to get document:', error);
            this.showError('Failed to load document details.');
            throw error;
        }
    },

    /**
     * Upload document
     */
    async uploadDocument(file, metadata = {}) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            // Add metadata
            Object.keys(metadata).forEach(key => {
                formData.append(key, metadata[key]);
            });

            const token = Auth.getToken();
            const response = await fetch(
                `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DOCUMENTS.UPLOAD}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Upload failed');
            }

            const data = await response.json();
            this.showSuccess(`Document "${file.name}" uploaded successfully!`);
            await this.loadDocuments();

            return data.document;
        } catch (error) {
            console.error('Failed to upload document:', error);
            this.showError(`Failed to upload document: ${error.message}`);
            throw error;
        }
    },

    /**
     * Download document
     */
    async downloadDocument(documentId, filename) {
        try {
            const token = Auth.getToken();
            const response = await fetch(
                `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.DOCUMENTS.DOWNLOAD(documentId)}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Download failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `document-${documentId}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.showSuccess('Document downloaded successfully!');
        } catch (error) {
            console.error('Failed to download document:', error);
            this.showError('Failed to download document.');
            throw error;
        }
    },

    /**
     * Delete document
     */
    async deleteDocument(documentId) {
        try {
            await Auth.apiCall(
                API_CONFIG.ENDPOINTS.DOCUMENTS.DELETE(documentId),
                {
                    method: 'DELETE'
                }
            );

            this.showSuccess('Document deleted successfully!');
            await this.loadDocuments();
        } catch (error) {
            console.error('Failed to delete document:', error);
            this.showError('Failed to delete document. Please try again.');
            throw error;
        }
    },

    /**
     * Process document with AI
     */
    async processDocument(documentId) {
        try {
            this.showSuccess('Processing document with AI...');

            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.DOCUMENTS.PROCESS(documentId),
                {
                    method: 'POST'
                }
            );

            this.showSuccess('Document processed successfully!');
            await this.loadDocuments();

            return response;
        } catch (error) {
            console.error('Failed to process document:', error);
            this.showError('Failed to process document.');
            throw error;
        }
    },

    /**
     * Categorize document
     */
    async categorizeDocument(documentId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.DOCUMENTS.CATEGORIZE(documentId),
                {
                    method: 'POST'
                }
            );

            this.showSuccess(`Document categorized as: ${response.category}`);
            await this.loadDocuments();

            return response;
        } catch (error) {
            console.error('Failed to categorize document:', error);
            this.showError('Failed to categorize document.');
            throw error;
        }
    },

    /**
     * Search documents
     */
    async searchDocuments(query) {
        try {
            this.showLoading();

            const queryParams = new URLSearchParams({
                q: query,
                page: 1,
                limit: 50
            });

            const response = await Auth.apiCall(
                `${API_CONFIG.ENDPOINTS.DOCUMENTS.SEARCH}?${queryParams}`
            );

            this.documents = response.documents || [];
            this.renderDocuments();
            this.hideLoading();

            console.log(`Found ${this.documents.length} documents matching "${query}"`);
        } catch (error) {
            console.error('Failed to search documents:', error);
            this.showError('Failed to search documents.');
            this.hideLoading();
        }
    },

    /**
     * Get document requirements for permit type
     */
    async getRequirements(permitType) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.DOCUMENTS.REQUIREMENTS(permitType)
            );

            console.log(`Requirements for ${permitType}:`, response.requirements);
            return response.requirements;
        } catch (error) {
            console.error('Failed to get document requirements:', error);
            return null;
        }
    },

    /**
     * Validate documents for permit
     */
    async validateDocuments(permitId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.DOCUMENTS.VALIDATE(permitId)
            );

            console.log('Validation result:', response);
            return response;
        } catch (error) {
            console.error('Failed to validate documents:', error);
            this.showError('Failed to validate documents.');
            return null;
        }
    },

    /**
     * Get document statistics for permit
     */
    async getStats(permitId) {
        try {
            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.DOCUMENTS.STATS(permitId)
            );

            console.log('Document stats:', response.stats);
            return response.stats;
        } catch (error) {
            console.error('Failed to get document stats:', error);
            return null;
        }
    },

    /**
     * Bulk process documents for permit
     */
    async bulkProcess(permitId) {
        try {
            this.showSuccess('Processing all documents...');

            const response = await Auth.apiCall(
                API_CONFIG.ENDPOINTS.DOCUMENTS.BULK_PROCESS(permitId),
                {
                    method: 'POST'
                }
            );

            this.showSuccess(`Processed ${response.processed} documents!`);
            await this.loadDocuments();

            return response;
        } catch (error) {
            console.error('Failed to bulk process documents:', error);
            this.showError('Failed to process documents.');
            throw error;
        }
    },

    /**
     * Render documents in the UI
     */
    renderDocuments() {
        const documentsContainer = document.getElementById('documentsTableBody') || document.getElementById('documentsList');
        if (!documentsContainer) return;

        if (this.documents.length === 0) {
            const emptyHTML = `
                <div class="text-center py-8 text-white/60">
                    <i class="fas fa-file fa-3x mb-3"></i>
                    <p>No documents found</p>
                </div>
            `;

            if (documentsContainer.tagName === 'TBODY') {
                documentsContainer.innerHTML = `
                    <tr>
                        <td colspan="6" class="py-8 text-center text-white/60">
                            ${emptyHTML}
                        </td>
                    </tr>
                `;
            } else {
                documentsContainer.innerHTML = emptyHTML;
            }
            return;
        }

        if (documentsContainer.tagName === 'TBODY') {
            this.renderDocumentsTable(documentsContainer);
        } else {
            this.renderDocumentsCards(documentsContainer);
        }
    },

    /**
     * Render documents as table rows
     */
    renderDocumentsTable(container) {
        container.innerHTML = this.documents.map(doc => {
            const fileIcon = this.getFileIcon(doc.fileType || doc.mimeType);
            const fileSize = this.formatFileSize(doc.fileSize || 0);

            return `
                <tr class="hover:bg-white/5 transition-all duration-200 border-b border-white/5">
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                                <i class="${fileIcon} text-white text-sm"></i>
                            </div>
                            <div>
                                <div class="text-white font-semibold">${doc.filename || doc.name || 'Untitled'}</div>
                                <div class="text-white/60 text-sm">${fileSize}</div>
                            </div>
                        </div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="text-white/80">${doc.category || 'Uncategorized'}</div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="text-white/80">${doc.uploadedBy || 'Unknown'}</div>
                        <div class="text-white/60 text-sm">${doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'N/A'}</div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-2">
                            ${doc.processed ? '<span class="text-emerald-400"><i class="fas fa-check-circle mr-1"></i>Processed</span>' : '<span class="text-yellow-400"><i class="fas fa-clock mr-1"></i>Pending</span>'}
                        </div>
                    </td>
                    <td class="py-4 px-6">
                        <div class="flex items-center space-x-2">
                            <button onclick="Documents.viewDocument('${doc.id}')"
                                    class="p-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg transition-all duration-200 border border-blue-500/30">
                                <i class="fas fa-eye text-xs"></i>
                            </button>
                            <button onclick="Documents.downloadDocument('${doc.id}', '${doc.filename}')"
                                    class="p-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded-lg transition-all duration-200 border border-emerald-500/30">
                                <i class="fas fa-download text-xs"></i>
                            </button>
                            ${!doc.processed ? `
                                <button onclick="Documents.processDocument('${doc.id}')"
                                        class="p-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded-lg transition-all duration-200 border border-purple-500/30">
                                    <i class="fas fa-magic text-xs"></i>
                                </button>
                            ` : ''}
                            ${Auth.hasRole('admin') ? `
                                <button onclick="Documents.deleteDocument('${doc.id}')"
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
     * Render documents as cards
     */
    renderDocumentsCards(container) {
        container.innerHTML = this.documents.map(doc => {
            const fileIcon = this.getFileIcon(doc.fileType || doc.mimeType);
            const fileSize = this.formatFileSize(doc.fileSize || 0);

            return `
                <div class="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex items-center space-x-3 flex-1">
                            <div class="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                                <i class="${fileIcon} text-white text-lg"></i>
                            </div>
                            <div class="flex-1">
                                <h4 class="text-white font-semibold truncate">${doc.filename || doc.name || 'Untitled'}</h4>
                                <p class="text-white/60 text-sm">${fileSize} • ${doc.category || 'Uncategorized'}</p>
                            </div>
                        </div>
                        ${doc.processed ? '<i class="fas fa-check-circle text-emerald-400 text-xl"></i>' : '<i class="fas fa-clock text-yellow-400 text-xl"></i>'}
                    </div>

                    <div class="flex items-center text-white/70 text-sm mb-4">
                        <i class="fas fa-user w-5 mr-2"></i>
                        <span>${doc.uploadedBy || 'Unknown'}</span>
                        <span class="mx-2">•</span>
                        <span>${doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : 'N/A'}</span>
                    </div>

                    <div class="flex items-center space-x-2">
                        <button onclick="Documents.downloadDocument('${doc.id}', '${doc.filename}')"
                                class="flex-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 py-2 rounded-lg transition-all duration-200 border border-emerald-500/30 text-sm">
                            <i class="fas fa-download text-xs mr-2"></i>Download
                        </button>
                        ${!doc.processed ? `
                            <button onclick="Documents.processDocument('${doc.id}')"
                                    class="flex-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 py-2 rounded-lg transition-all duration-200 border border-purple-500/30 text-sm">
                                <i class="fas fa-magic text-xs mr-2"></i>Process
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * View document details
     */
    async viewDocument(documentId) {
        try {
            const doc = await this.getDocument(documentId);
            console.log('Viewing document:', doc);
            alert(`Document: ${doc.filename}\nSize: ${this.formatFileSize(doc.fileSize)}\nCategory: ${doc.category || 'Uncategorized'}\nUploaded: ${doc.createdAt ? new Date(doc.createdAt).toLocaleString() : 'N/A'}\n\nProcessed: ${doc.processed ? 'Yes' : 'No'}`);
        } catch (error) {
            console.error('Failed to view document:', error);
        }
    },

    /**
     * Get file icon based on file type
     */
    getFileIcon(fileType) {
        if (!fileType) return 'fas fa-file';

        const type = fileType.toLowerCase();
        if (type.includes('pdf')) return 'fas fa-file-pdf';
        if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg')) return 'fas fa-file-image';
        if (type.includes('word') || type.includes('doc')) return 'fas fa-file-word';
        if (type.includes('excel') || type.includes('spreadsheet')) return 'fas fa-file-excel';
        if (type.includes('zip') || type.includes('archive')) return 'fas fa-file-archive';
        if (type.includes('text') || type.includes('txt')) return 'fas fa-file-alt';

        return 'fas fa-file';
    },

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // File upload drop zone
        const dropZone = document.getElementById('documentDropZone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-blue-500', 'bg-blue-500/10');
            });

            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-blue-500', 'bg-blue-500/10');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-blue-500', 'bg-blue-500/10');

                const files = Array.from(e.dataTransfer.files);
                files.forEach(file => this.uploadDocument(file));
            });
        }

        console.log('Documents event listeners setup complete');
    },

    /**
     * Show loading state
     */
    showLoading() {
        const container = document.getElementById('documentsTableBody') || document.getElementById('documentsList');
        if (container) {
            const loadingHTML = `
                <div class="text-center py-8 text-white/60">
                    <i class="fas fa-spinner fa-spin fa-2x mb-3"></i>
                    <p>Loading documents...</p>
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
        // TODO: Implement better success notification
    }
};

// Export for use in other scripts
window.Documents = Documents;

// Global functions for onclick handlers
window.uploadDocumentFile = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.zip';

    input.onchange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            Documents.uploadDocument(file);
        });
    };

    input.click();
};

console.log('Documents module loaded');
