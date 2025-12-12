// Payment API Module
// Handles all payment-related API calls

const PaymentAPI = {
  /**
   * Get list of payments with optional filters
   * @param {Object} filters - Optional filters (status, paymentType, page, limit)
   * @returns {Promise<Object>} Payment list with pagination
   */
  async getPayments(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.paymentType) queryParams.append('paymentType', filters.paymentType);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.limit) queryParams.append('limit', filters.limit);
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const endpoint = API_CONFIG.ENDPOINTS.PAYMENTS.LIST +
        (queryParams.toString() ? `?${queryParams.toString()}` : '');

      return await apiCall(endpoint);
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  },

  /**
   * Get single payment details
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Payment details
   */
  async getPayment(paymentId) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.PAYMENTS.GET(paymentId);
      return await apiCall(endpoint);
    } catch (error) {
      console.error('Error fetching payment:', error);
      throw error;
    }
  },

  /**
   * Create a new payment
   * @param {Object} paymentData - Payment data
   * @returns {Promise<Object>} Created payment
   */
  async createPayment(paymentData) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.PAYMENTS.CREATE;
      return await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(paymentData)
      });
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  },

  /**
   * Process a payment (mark as completed)
   * @param {string} paymentId - Payment ID
   * @param {Object} processData - Processing data (transactionId, metadata, etc.)
   * @returns {Promise<Object>} Updated payment
   */
  async processPayment(paymentId, processData) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.PAYMENTS.PROCESS(paymentId);
      return await apiCall(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(processData)
      });
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  },

  /**
   * Refund a payment
   * @param {string} paymentId - Payment ID
   * @param {Object} refundData - Refund data (amount, reason)
   * @returns {Promise<Object>} Updated payment with refund info
   */
  async refundPayment(paymentId, refundData) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.PAYMENTS.REFUND(paymentId);
      return await apiCall(endpoint, {
        method: 'PATCH',
        body: JSON.stringify(refundData)
      });
    } catch (error) {
      console.error('Error refunding payment:', error);
      throw error;
    }
  },

  /**
   * Get payment statistics
   * @returns {Promise<Object>} Payment stats
   */
  async getPaymentStats() {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.PAYMENTS.STATS;
      return await apiCall(endpoint);
    } catch (error) {
      console.error('Error fetching payment stats:', error);
      throw error;
    }
  },

  /**
   * Download payment invoice
   * @param {string} paymentId - Payment ID
   * @returns {string} Invoice download URL
   */
  getInvoiceUrl(paymentId) {
    return API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.PAYMENTS.INVOICE(paymentId);
  },

  /**
   * Download payment receipt
   * @param {string} paymentId - Payment ID
   * @returns {string} Receipt download URL
   */
  getReceiptUrl(paymentId) {
    return API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.PAYMENTS.RECEIPT(paymentId);
  },

  /**
   * Format currency for display
   * @param {number} amount - Amount in cents or dollars
   * @param {string} currency - Currency code (default: USD)
   * @returns {string} Formatted currency string
   */
  formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  /**
   * Get payment status badge class
   * @param {string} status - Payment status
   * @returns {string} CSS class for status badge
   */
  getStatusBadgeClass(status) {
    const statusClasses = {
      'pending': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'processing': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'completed': 'bg-green-500/20 text-green-300 border-green-500/30',
      'failed': 'bg-red-500/20 text-red-300 border-red-500/30',
      'refunded': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'cancelled': 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    };
    return statusClasses[status] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  },

  /**
   * Get payment type display name
   * @param {string} paymentType - Payment type code
   * @returns {string} Display name
   */
  getPaymentTypeLabel(paymentType) {
    const labels = {
      'permit_fee': 'Permit Fee',
      'inspection_fee': 'Inspection Fee',
      'license_fee': 'License Fee',
      'fine': 'Fine',
      'penalty': 'Penalty',
      'subscription': 'Subscription',
      'service_fee': 'Service Fee',
      'application_fee': 'Application Fee',
      'other': 'Other'
    };
    return labels[paymentType] || paymentType;
  },

  /**
   * Get payment method icon
   * @param {string} paymentMethod - Payment method
   * @returns {string} Font Awesome icon class
   */
  getPaymentMethodIcon(paymentMethod) {
    const icons = {
      'credit_card': 'fa-credit-card',
      'debit_card': 'fa-credit-card',
      'cash': 'fa-money-bill-wave',
      'check': 'fa-money-check',
      'bank_transfer': 'fa-building-columns',
      'online': 'fa-globe',
      'mobile_payment': 'fa-mobile-alt',
      'other': 'fa-circle-question'
    };
    return icons[paymentMethod] || 'fa-circle-question';
  },

  /**
   * Validate payment data before submission
   * @param {Object} paymentData - Payment data to validate
   * @returns {Object} Validation result {valid: boolean, errors: array}
   */
  validatePayment(paymentData) {
    const errors = [];

    if (!paymentData.amount || paymentData.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!paymentData.paymentType) {
      errors.push('Payment type is required');
    }

    if (!paymentData.paymentMethod) {
      errors.push('Payment method is required');
    }

    if (!paymentData.userId) {
      errors.push('User is required');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * Export payments to CSV
   * @param {Array} payments - Array of payment objects
   * @returns {string} CSV string
   */
  exportToCSV(payments) {
    const headers = [
      'Receipt Number',
      'Date',
      'User ID',
      'Amount',
      'Currency',
      'Payment Type',
      'Payment Method',
      'Status',
      'Transaction ID'
    ];

    const rows = payments.map(payment => [
      payment.receiptNumber || '',
      new Date(payment.createdAt).toLocaleString(),
      payment.userId || '',
      payment.amount || 0,
      payment.currency || 'USD',
      payment.paymentType || '',
      payment.paymentMethod || '',
      payment.status || '',
      payment.transactionId || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  },

  /**
   * Download CSV file
   * @param {string} csvContent - CSV content
   * @param {string} filename - File name
   */
  downloadCSV(csvContent, filename = 'payments.csv') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Make PaymentAPI available globally
if (typeof window !== 'undefined') {
  window.PaymentAPI = PaymentAPI;
}
