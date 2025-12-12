const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const FoiaTemplate = sequelize.define('FoiaTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Template Identification
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'Template name for internal reference'
  },
  templateType: {
    type: DataTypes.ENUM(
      'acknowledgment',
      'extension',
      'fee_estimate',
      'payment_request',
      'interim_response',
      'final_response',
      'partial_grant',
      'full_grant',
      'denial',
      'no_records',
      'release_notification',
      'clarification_request',
      'closing_notification',
      'reading_room_publication',
      'custom'
    ),
    allowNull: false,
    field: 'template_type',
    comment: 'Type of communication this template is used for'
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Category for organization (e.g., "Requester Communications", "Internal Notifications")'
  },

  // Email Content
  subject: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Email subject line (supports variable substitution)'
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Plain text version of email body'
  },
  htmlBody: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'html_body',
    comment: 'HTML version of email body'
  },

  // Variable Substitution
  variables: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of available merge variables: [{name, description, example}]'
  },
  variableHelp: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'variable_help',
    comment: 'Help text explaining available variables'
  },

  // Template Settings
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
    comment: 'Whether template is active and available for use'
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_default',
    comment: 'Whether this is the default template for its type'
  },
  isSystem: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_system',
    comment: 'Whether this is a system template (cannot be deleted)'
  },

  // Attachments
  defaultAttachments: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'default_attachments',
    comment: 'Array of default attachments to include: [{name, path, type}]'
  },

  // Usage Tracking
  usageCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'usage_count',
    comment: 'Number of times this template has been used'
  },
  lastUsedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_used_at',
    comment: 'Most recent usage date'
  },

  // Preview and Testing
  previewData: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'preview_data',
    comment: 'Sample data for template preview'
  },

  // Sender Information
  fromName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'from_name',
    comment: 'Default sender name (can be overridden)'
  },
  fromEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'from_email',
    comment: 'Default sender email (can be overridden)'
  },
  replyTo: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'reply_to',
    comment: 'Reply-to email address'
  },
  ccEmails: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'cc_emails',
    comment: 'Default CC email addresses'
  },
  bccEmails: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'bcc_emails',
    comment: 'Default BCC email addresses'
  },

  // Delivery Settings
  priority: {
    type: DataTypes.ENUM('low', 'normal', 'high'),
    defaultValue: 'normal',
    comment: 'Email priority level'
  },
  sendDelay: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'send_delay',
    comment: 'Delay in minutes before sending (null = immediate)'
  },
  requiresApproval: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'requires_approval',
    comment: 'Whether emails using this template require approval before sending'
  },

  // Localization
  language: {
    type: DataTypes.STRING(10),
    defaultValue: 'en',
    comment: 'Language code (en, es, etc.)'
  },

  // Version Control
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    comment: 'Template version number'
  },
  previousVersionId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'previous_version_id',
    comment: 'Reference to previous template version'
  },

  // Notes and Documentation
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Description of template purpose and usage'
  },
  internalNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'internal_notes',
    comment: 'Internal notes for template maintainers'
  },

  // Metadata
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional template metadata'
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
    comment: 'User who created this template'
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'updated_by',
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'User who last updated this template'
  }
}, {
  tableName: 'FoiaTemplates',
  timestamps: true,
  underscored: false,
  paranoid: true,
  indexes: [
    {
      fields: ['template_type']
    },
    {
      fields: ['category']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['is_default']
    },
    {
      fields: ['is_system']
    },
    {
      fields: ['language']
    },
    {
      fields: ['name']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = FoiaTemplate;
