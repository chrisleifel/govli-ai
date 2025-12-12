// Notification API Module
// Handles all notification-related API calls and utilities

const NotificationAPI = {
  /**
   * Get notifications for current user with optional filters
   * @param {Object} filters - Optional filters (unreadOnly, type, priority, page, limit)
   * @returns {Promise<Object>} Notifications list with pagination
   */
  async getNotifications(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.unreadOnly) queryParams.append('unreadOnly', 'true');
      if (filters.type) queryParams.append('type', filters.type);
      if (filters.priority) queryParams.append('priority', filters.priority);
      if (filters.page) queryParams.append('page', filters.page);
      if (filters.limit) queryParams.append('limit', filters.limit);

      const endpoint = API_CONFIG.ENDPOINTS.NOTIFICATIONS.LIST +
        (queryParams.toString() ? `?${queryParams.toString()}` : '');

      return await apiCall(endpoint);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  },

  /**
   * Get unread notification count
   * @returns {Promise<Object>} Unread count
   */
  async getUnreadCount() {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT;
      return await apiCall(endpoint);
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  },

  /**
   * Get single notification details
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object>} Notification details
   */
  async getNotification(notificationId) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.NOTIFICATIONS.GET(notificationId);
      return await apiCall(endpoint);
    } catch (error) {
      console.error('Error fetching notification:', error);
      throw error;
    }
  },

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object>} Updated notification
   */
  async markAsRead(notificationId) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId);
      return await apiCall(endpoint, {
        method: 'PATCH'
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read
   * @returns {Promise<Object>} Result
   */
  async markAllAsRead() {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ;
      return await apiCall(endpoint, {
        method: 'PATCH'
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      throw error;
    }
  },

  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   * @returns {Promise<Object>} Result
   */
  async deleteNotification(notificationId) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.NOTIFICATIONS.DELETE(notificationId);
      return await apiCall(endpoint, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },

  /**
   * Clear all read notifications
   * @returns {Promise<Object>} Result
   */
  async clearAllRead() {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.NOTIFICATIONS.CLEAR_ALL;
      return await apiCall(endpoint, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error clearing read notifications:', error);
      throw error;
    }
  },

  /**
   * Send notification to specific user(s) (admin/staff only)
   * @param {Object} notificationData - Notification data
   * @returns {Promise<Object>} Result
   */
  async sendNotification(notificationData) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.NOTIFICATIONS.SEND;
      return await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(notificationData)
      });
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  },

  /**
   * Broadcast notification to all users or by role (admin only)
   * @param {Object} broadcastData - Broadcast data
   * @returns {Promise<Object>} Result
   */
  async broadcastNotification(broadcastData) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.NOTIFICATIONS.BROADCAST;
      return await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(broadcastData)
      });
    } catch (error) {
      console.error('Error broadcasting notification:', error);
      throw error;
    }
  },

  /**
   * Get priority icon class
   * @param {string} priority - Priority level
   * @returns {string} Font Awesome icon class
   */
  getPriorityIcon(priority) {
    const icons = {
      'urgent': 'fa-exclamation-circle',
      'high': 'fa-exclamation-triangle',
      'medium': 'fa-info-circle',
      'low': 'fa-bell'
    };
    return icons[priority] || 'fa-bell';
  },

  /**
   * Get priority color class
   * @param {string} priority - Priority level
   * @returns {string} Tailwind color class
   */
  getPriorityColor(priority) {
    const colors = {
      'urgent': 'text-red-500',
      'high': 'text-orange-500',
      'medium': 'text-blue-500',
      'low': 'text-gray-500'
    };
    return colors[priority] || 'text-gray-500';
  },

  /**
   * Get priority badge class
   * @param {string} priority - Priority level
   * @returns {string} CSS class for badge
   */
  getPriorityBadgeClass(priority) {
    const classes = {
      'urgent': 'bg-red-500/20 text-red-300 border-red-500/30',
      'high': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'medium': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'low': 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    };
    return classes[priority] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  },

  /**
   * Get notification type icon
   * @param {string} type - Notification type
   * @returns {string} Font Awesome icon class
   */
  getTypeIcon(type) {
    const icons = {
      'permit_update': 'fa-file-alt',
      'permit_approved': 'fa-check-circle',
      'permit_rejected': 'fa-times-circle',
      'inspection_scheduled': 'fa-calendar-check',
      'inspection_completed': 'fa-clipboard-check',
      'payment_received': 'fa-dollar-sign',
      'payment_refunded': 'fa-undo',
      'grant_opportunity': 'fa-hand-holding-usd',
      'grant_application': 'fa-file-invoice',
      'document_uploaded': 'fa-file-upload',
      'document_processed': 'fa-file-check',
      'task_assigned': 'fa-tasks',
      'workflow_completed': 'fa-project-diagram',
      'system': 'fa-cog',
      'announcement': 'fa-bullhorn',
      'reminder': 'fa-clock'
    };
    return icons[type] || 'fa-bell';
  },

  /**
   * Get notification type label
   * @param {string} type - Notification type
   * @returns {string} Display label
   */
  getTypeLabel(type) {
    const labels = {
      'permit_update': 'Permit Update',
      'permit_approved': 'Permit Approved',
      'permit_rejected': 'Permit Rejected',
      'inspection_scheduled': 'Inspection Scheduled',
      'inspection_completed': 'Inspection Completed',
      'payment_received': 'Payment Received',
      'payment_refunded': 'Payment Refunded',
      'grant_opportunity': 'Grant Opportunity',
      'grant_application': 'Grant Application',
      'document_uploaded': 'Document Uploaded',
      'document_processed': 'Document Processed',
      'task_assigned': 'Task Assigned',
      'workflow_completed': 'Workflow Completed',
      'system': 'System Notification',
      'announcement': 'Announcement',
      'reminder': 'Reminder'
    };
    return labels[type] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  },

  /**
   * Format notification timestamp
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Formatted time string
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  },

  /**
   * Get channel icon
   * @param {string} channel - Notification channel
   * @returns {string} Font Awesome icon class
   */
  getChannelIcon(channel) {
    const icons = {
      'in_app': 'fa-desktop',
      'email': 'fa-envelope',
      'sms': 'fa-sms',
      'push': 'fa-mobile-alt'
    };
    return icons[channel] || 'fa-bell';
  },

  /**
   * Group notifications by date
   * @param {Array} notifications - Array of notifications
   * @returns {Object} Grouped notifications
   */
  groupByDate(notifications) {
    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    notifications.forEach(notification => {
      const notifDate = new Date(notification.createdAt);
      const notifDay = new Date(notifDate.getFullYear(), notifDate.getMonth(), notifDate.getDate());

      if (notifDay.getTime() === today.getTime()) {
        groups.today.push(notification);
      } else if (notifDay.getTime() === yesterday.getTime()) {
        groups.yesterday.push(notification);
      } else if (notifDate >= thisWeek) {
        groups.thisWeek.push(notification);
      } else {
        groups.older.push(notification);
      }
    });

    return groups;
  },

  /**
   * Sort notifications by priority then timestamp
   * @param {Array} notifications - Array of notifications
   * @returns {Array} Sorted notifications
   */
  sortByPriority(notifications) {
    const priorityOrder = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };

    return notifications.sort((a, b) => {
      // First sort by read status (unread first)
      if (a.read !== b.read) {
        return a.read ? 1 : -1;
      }
      // Then by priority
      const priorityDiff = (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      // Finally by timestamp (newest first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  },

  /**
   * Play notification sound
   */
  playSound() {
    // Create a simple notification beep
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn('Unable to play notification sound:', error);
    }
  },

  /**
   * Show browser notification (if permission granted)
   * @param {Object} notification - Notification object
   */
  showBrowserNotification(notification) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.priority === 'urgent'
      });
    }
  },

  /**
   * Request browser notification permission
   * @returns {Promise<string>} Permission status
   */
  async requestNotificationPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission;
    }
    return 'denied';
  },

  /**
   * Check if notification is expired
   * @param {Object} notification - Notification object
   * @returns {boolean} True if expired
   */
  isExpired(notification) {
    if (!notification.expiresAt) return false;
    return new Date(notification.expiresAt) < new Date();
  },

  /**
   * Filter notifications by criteria
   * @param {Array} notifications - Array of notifications
   * @param {Object} criteria - Filter criteria
   * @returns {Array} Filtered notifications
   */
  filterNotifications(notifications, criteria) {
    return notifications.filter(notification => {
      if (criteria.unreadOnly && notification.read) return false;
      if (criteria.type && notification.type !== criteria.type) return false;
      if (criteria.priority && notification.priority !== criteria.priority) return false;
      if (criteria.search) {
        const searchLower = criteria.search.toLowerCase();
        const titleMatch = notification.title.toLowerCase().includes(searchLower);
        const messageMatch = notification.message.toLowerCase().includes(searchLower);
        if (!titleMatch && !messageMatch) return false;
      }
      return true;
    });
  }
};

// Notification Poller - Handles automatic notification checking
class NotificationPoller {
  constructor(options = {}) {
    this.interval = options.interval || 30000; // 30 seconds default
    this.onUpdate = options.onUpdate || (() => {});
    this.onError = options.onError || ((err) => console.error(err));
    this.enabled = options.enabled !== false;
    this.timerId = null;
    this.isVisible = !document.hidden;

    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      if (this.isVisible && this.enabled) {
        this.poll(); // Poll immediately when tab becomes visible
      }
    });
  }

  async poll() {
    if (!this.isVisible || !this.enabled) return;

    try {
      const data = await NotificationAPI.getUnreadCount();
      this.onUpdate(data);
    } catch (error) {
      this.onError(error);
    }
  }

  start() {
    this.enabled = true;
    this.poll(); // Poll immediately
    this.timerId = setInterval(() => this.poll(), this.interval);
  }

  stop() {
    this.enabled = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  setInterval(newInterval) {
    this.interval = newInterval;
    if (this.timerId) {
      this.stop();
      this.start();
    }
  }
}

// Make API and Poller available globally
if (typeof window !== 'undefined') {
  window.NotificationAPI = NotificationAPI;
  window.NotificationPoller = NotificationPoller;
}
