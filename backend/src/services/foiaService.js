const {
  FoiaRequest,
  FoiaDocument,
  FoiaRedaction,
  FoiaCommunication,
  FoiaActivityLog,
  FoiaReadingRoom,
  FoiaTemplate,
  FoiaExemption,
  User
} = require('../models');
const { Op } = require('sequelize');
const aiService = require('./aiService');

/**
 * FOIA/Public Records Management Service
 * Handles FOIA request lifecycle, document processing, redaction, and public records access
 */
class FoiaService {
  /**
   * Create a new FOIA request
   * @param {Object} requestData - Request details
   * @param {Object} user - User creating the request (optional for public submissions)
   * @returns {Promise<Object>} Created FOIA request
   */
  static async createRequest(requestData, user = null) {
    try {
      // Generate unique tracking number
      const trackingNumber = await this.generateTrackingNumber();

      // Calculate due date (default 10 business days)
      const dateDue = this.calculateDueDate(new Date(), 10);

      // Prepare request object
      const requestObj = {
        trackingNumber,
        ...requestData,
        dateSubmitted: new Date(),
        dateDue,
        status: 'submitted',
        createdBy: user ? user.id : null
      };

      // Create the request
      const request = await FoiaRequest.create(requestObj);

      // AI classification if description provided
      if (requestData.description) {
        await this.classifyRequest(request.id);
      }

      // Log activity
      await this.logActivity({
        requestId: request.id,
        activityType: 'request_created',
        action: `FOIA request ${trackingNumber} created`,
        actorId: user ? user.id : null,
        actorName: user ? user.name : requestData.requesterName,
        newValue: JSON.stringify(request)
      });

      return request;
    } catch (error) {
      console.error('Create FOIA request error:', error);
      throw error;
    }
  }

  /**
   * Generate unique tracking number for FOIA request
   * @returns {Promise<string>} Tracking number
   */
  static async generateTrackingNumber() {
    const year = new Date().getFullYear();
    const prefix = `FOIA-${year}-`;

    // Find highest number for current year
    const latestRequest = await FoiaRequest.findOne({
      where: {
        trackingNumber: {
          [Op.like]: `${prefix}%`
        }
      },
      order: [['createdAt', 'DESC']]
    });

    let nextNumber = 1;
    if (latestRequest) {
      const currentNumber = parseInt(latestRequest.trackingNumber.split('-')[2]);
      nextNumber = currentNumber + 1;
    }

    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }

  /**
   * Calculate due date based on business days
   * @param {Date} startDate - Start date
   * @param {number} businessDays - Number of business days
   * @returns {Date} Due date
   */
  static calculateDueDate(startDate, businessDays) {
    let date = new Date(startDate);
    let daysAdded = 0;

    while (daysAdded < businessDays) {
      date.setDate(date.getDate() + 1);
      const dayOfWeek = date.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysAdded++;
      }
    }

    return date;
  }

  /**
   * Search FOIA requests with advanced filters
   * @param {Object} filters - Search filters
   * @returns {Promise<Object>} Paginated results
   */
  static async searchRequests(filters = {}) {
    try {
      const {
        query,
        status,
        priority,
        requestType,
        requesterEmail,
        assignedTo,
        dateSubmittedAfter,
        dateSubmittedBefore,
        dateDueAfter,
        dateDueBefore,
        limit = 50,
        offset = 0,
        sortBy = 'dateSubmitted',
        sortOrder = 'DESC'
      } = filters;

      const where = {};

      // Text search across tracking number, subject, description, requester
      if (query) {
        where[Op.or] = [
          { trackingNumber: { [Op.iLike]: `%${query}%` } },
          { subject: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } },
          { requesterName: { [Op.iLike]: `%${query}%` } },
          { requesterEmail: { [Op.iLike]: `%${query}%` } }
        ];
      }

      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (requestType) where.requestType = requestType;
      if (requesterEmail) where.requesterEmail = { [Op.iLike]: `%${requesterEmail}%` };
      if (assignedTo) where.assignedTo = assignedTo;

      // Date filters
      if (dateSubmittedAfter) {
        where.dateSubmitted = { [Op.gte]: new Date(dateSubmittedAfter) };
      }
      if (dateSubmittedBefore) {
        if (where.dateSubmitted) {
          where.dateSubmitted[Op.lte] = new Date(dateSubmittedBefore);
        } else {
          where.dateSubmitted = { [Op.lte]: new Date(dateSubmittedBefore) };
        }
      }

      if (dateDueAfter) {
        where.dateDue = { [Op.gte]: new Date(dateDueAfter) };
      }
      if (dateDueBefore) {
        if (where.dateDue) {
          where.dateDue[Op.lte] = new Date(dateDueBefore);
        } else {
          where.dateDue = { [Op.lte]: new Date(dateDueBefore) };
        }
      }

      // Field mapping for sorting
      const orderMap = {
        dateSubmitted: 'date_submitted',
        dateDue: 'date_due',
        trackingNumber: 'tracking_number',
        priority: 'priority',
        status: 'status'
      };
      const orderField = orderMap[sortBy] || 'date_submitted';

      const { rows: requests, count } = await FoiaRequest.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: 'assignedStaff',
            attributes: ['id', 'name', 'email']
          },
          {
            model: User,
            as: 'requester',
            attributes: ['id', 'name', 'email']
          }
        ],
        order: [[orderField, sortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return {
        requests,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };
    } catch (error) {
      console.error('Search FOIA requests error:', error);
      throw error;
    }
  }

  /**
   * Get request details with all related data
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} Full request details
   */
  static async getRequestDetails(requestId) {
    try {
      const request = await FoiaRequest.findByPk(requestId, {
        include: [
          {
            model: User,
            as: 'requester',
            attributes: ['id', 'name', 'email']
          },
          {
            model: User,
            as: 'assignedStaff',
            attributes: ['id', 'name', 'email']
          },
          {
            model: FoiaDocument,
            as: 'documents',
            include: [
              {
                model: FoiaRedaction,
                as: 'redactions'
              }
            ]
          },
          {
            model: FoiaCommunication,
            as: 'communications',
            order: [['sentAt', 'DESC']],
            limit: 20
          },
          {
            model: FoiaActivityLog,
            as: 'activityLogs',
            order: [['timestamp', 'DESC']],
            limit: 50
          }
        ]
      });

      if (!request) {
        throw new Error('FOIA request not found');
      }

      return request;
    } catch (error) {
      console.error('Get FOIA request details error:', error);
      throw error;
    }
  }

  /**
   * Update request status
   * @param {string} requestId - Request ID
   * @param {string} newStatus - New status
   * @param {Object} user - User making the change
   * @param {string} notes - Optional notes
   * @returns {Promise<Object>} Updated request
   */
  static async updateStatus(requestId, newStatus, user, notes = null) {
    try {
      const request = await FoiaRequest.findByPk(requestId);
      if (!request) {
        throw new Error('FOIA request not found');
      }

      const oldStatus = request.status;
      request.status = newStatus;
      request.updatedBy = user.id;

      // Update status-specific dates
      if (newStatus === 'acknowledged' && !request.dateAcknowledged) {
        request.dateAcknowledged = new Date();
      }
      if (['released', 'closed', 'denied'].includes(newStatus) && !request.dateCompleted) {
        request.dateCompleted = new Date();
      }

      await request.save();

      // Log activity
      await this.logActivity({
        requestId: request.id,
        activityType: 'status_change',
        action: `Status changed from ${oldStatus} to ${newStatus}`,
        actorId: user.id,
        actorName: user.name,
        oldValue: oldStatus,
        newValue: newStatus,
        metadata: notes ? { notes } : {}
      });

      return request;
    } catch (error) {
      console.error('Update FOIA status error:', error);
      throw error;
    }
  }

  /**
   * Upload document to FOIA request
   * @param {string} requestId - Request ID
   * @param {Object} fileData - File information
   * @param {Object} user - User uploading
   * @returns {Promise<Object>} Created document
   */
  static async uploadDocument(requestId, fileData, user) {
    try {
      const request = await FoiaRequest.findByPk(requestId);
      if (!request) {
        throw new Error('FOIA request not found');
      }

      const document = await FoiaDocument.create({
        requestId,
        filename: fileData.filename,
        originalFilename: fileData.originalFilename,
        fileType: fileData.fileType,
        fileSize: fileData.fileSize,
        filePath: fileData.filePath,
        uploadedBy: user.id,
        createdBy: user.id
      });

      // Log activity
      await this.logActivity({
        requestId,
        documentId: document.id,
        activityType: 'document_upload',
        action: `Document uploaded: ${fileData.originalFilename}`,
        actorId: user.id,
        actorName: user.name
      });

      return document;
    } catch (error) {
      console.error('Upload FOIA document error:', error);
      throw error;
    }
  }

  /**
   * AI classification of FOIA request
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} Classification results
   */
  static async classifyRequest(requestId) {
    try {
      const request = await FoiaRequest.findByPk(requestId);
      if (!request) {
        throw new Error('FOIA request not found');
      }

      // Use AI service to classify complexity and sensitivity
      const prompt = `Analyze this FOIA request and provide:
1. Complexity score (0.0-1.0) - how complex is this request to fulfill?
2. Sensitivity score (0.0-1.0) - how sensitive is the requested information?
3. Suggested priority (low/normal/high/urgent)
4. Estimated response time in business days

Request: ${request.subject}
Description: ${request.description}
Type: ${request.requestType}`;

      const analysis = await aiService.analyze(prompt);

      // Parse AI response and update request
      request.aiClassification = analysis;
      request.complexityScore = analysis.complexityScore || 0.5;
      request.sensitivityScore = analysis.sensitivityScore || 0.5;

      if (analysis.suggestedPriority) {
        request.priority = analysis.suggestedPriority;
      }

      await request.save();

      return analysis;
    } catch (error) {
      console.error('Classify FOIA request error:', error);
      // Non-fatal - continue even if AI fails
      return null;
    }
  }

  /**
   * Log activity for audit trail
   * @param {Object} activityData - Activity details
   * @returns {Promise<Object>} Created activity log
   */
  static async logActivity(activityData) {
    try {
      return await FoiaActivityLog.create({
        ...activityData,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Log FOIA activity error:', error);
      // Non-fatal - don't throw
      return null;
    }
  }

  /**
   * Get dashboard statistics
   * @returns {Promise<Object>} Dashboard stats
   */
  static async getDashboardStats() {
    try {
      const stats = {
        totalRequests: await FoiaRequest.count(),
        byStatus: {},
        byPriority: {},
        overdue: 0,
        dueThisWeek: 0
      };

      // Count by status
      const statusCounts = await FoiaRequest.findAll({
        attributes: [
          'status',
          [FoiaRequest.sequelize.fn('COUNT', FoiaRequest.sequelize.col('id')), 'count']
        ],
        group: ['status']
      });

      statusCounts.forEach(row => {
        stats.byStatus[row.status] = parseInt(row.dataValues.count);
      });

      // Count by priority
      const priorityCounts = await FoiaRequest.findAll({
        attributes: [
          'priority',
          [FoiaRequest.sequelize.fn('COUNT', FoiaRequest.sequelize.col('id')), 'count']
        ],
        group: ['priority']
      });

      priorityCounts.forEach(row => {
        stats.byPriority[row.priority] = parseInt(row.dataValues.count);
      });

      // Overdue requests
      stats.overdue = await FoiaRequest.count({
        where: {
          dateDue: { [Op.lt]: new Date() },
          status: { [Op.notIn]: ['released', 'closed', 'denied'] }
        }
      });

      // Due this week
      const oneWeekFromNow = new Date();
      oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);
      stats.dueThisWeek = await FoiaRequest.count({
        where: {
          dateDue: {
            [Op.gte]: new Date(),
            [Op.lte]: oneWeekFromNow
          },
          status: { [Op.notIn]: ['released', 'closed', 'denied'] }
        }
      });

      return stats;
    } catch (error) {
      console.error('Get FOIA dashboard stats error:', error);
      throw error;
    }
  }
}

module.exports = FoiaService;
