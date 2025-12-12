const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const FoiaCommunication = sequelize.define('FoiaCommunication', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Request Association
  requestId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'request_id',
    references: {
      model: 'FoiaRequests',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'Associated FOIA request'
  },

  // Communication Type and Direction
  communicationType: {
    type: DataTypes.ENUM('email', 'phone', 'mail', 'in_person', 'portal', 'fax'),
    allowNull: false,
    field: 'communication_type',
    defaultValue: 'email',
    comment: 'Type of communication channel used'
  },
  direction: {
    type: DataTypes.ENUM('inbound', 'outbound'),
    allowNull: false,
    defaultValue: 'outbound',
    comment: 'Direction of communication flow'
  },

  // Message Content
  subject: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Subject line for emails or brief description for other types'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Full message content or communication notes'
  },
  htmlContent: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'html_content',
    comment: 'HTML version of email content if applicable'
  },

  // Sender Information
  senderId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'sender_id',
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'Staff user who sent the communication (for outbound)'
  },
  senderEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'sender_email',
    comment: 'Email address of sender (for inbound)'
  },
  senderName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'sender_name',
    comment: 'Name of sender (for inbound communications)'
  },

  // Recipient Information
  recipientEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'recipient_email',
    comment: 'Primary recipient email address'
  },
  recipientName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'recipient_name',
    comment: 'Name of recipient'
  },
  ccRecipients: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'cc_recipients',
    comment: 'Array of CC email addresses'
  },
  bccRecipients: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'bcc_recipients',
    comment: 'Array of BCC email addresses'
  },

  // Attachments
  attachments: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of attachment metadata {filename, path, size, type}'
  },

  // Delivery Tracking
  sentAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'sent_at',
    comment: 'Date/time communication was sent'
  },
  delivered: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether communication was successfully delivered'
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'delivered_at',
    comment: 'Date/time delivery was confirmed'
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether communication was read/opened (if trackable)'
  },
  readAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'read_at',
    comment: 'Date/time communication was read'
  },
  bounced: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether email bounced'
  },
  bounceReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'bounce_reason',
    comment: 'Reason for bounce if applicable'
  },

  // Template Association
  templateId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'template_id',
    references: {
      model: 'FoiaTemplates',
      key: 'id'
    },
    comment: 'Email template used (if any)'
  },

  // Phone Call Specifics
  phoneNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'phone_number',
    comment: 'Phone number for phone communications'
  },
  callDuration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'call_duration',
    comment: 'Call duration in seconds (for phone calls)'
  },
  callNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'call_notes',
    comment: 'Notes from phone conversation'
  },

  // Status and Priority
  status: {
    type: DataTypes.ENUM('draft', 'queued', 'sent', 'delivered', 'failed', 'cancelled'),
    defaultValue: 'draft',
    comment: 'Communication status'
  },
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
    defaultValue: 'normal',
    comment: 'Communication priority level'
  },

  // Internal Tracking
  isInternal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_internal',
    comment: 'Whether this is internal communication (not sent to requester)'
  },
  requiresResponse: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'requires_response',
    comment: 'Whether this communication requires a response'
  },
  responseDeadline: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'response_deadline',
    comment: 'Deadline for response if required'
  },

  // Metadata
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional communication metadata (email headers, tracking IDs, etc.)'
  },

  // Audit Fields
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'created_by',
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'User who created/logged this communication'
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'updated_by',
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'User who last updated this communication'
  }
}, {
  tableName: 'FoiaCommunications',
  timestamps: true,
  underscored: false,
  paranoid: true,
  indexes: [
    {
      fields: ['request_id']
    },
    {
      fields: ['communication_type']
    },
    {
      fields: ['direction']
    },
    {
      fields: ['sender_id']
    },
    {
      fields: ['recipient_email']
    },
    {
      fields: ['sent_at']
    },
    {
      fields: ['status']
    },
    {
      fields: ['template_id']
    },
    {
      fields: ['requires_response']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = FoiaCommunication;
