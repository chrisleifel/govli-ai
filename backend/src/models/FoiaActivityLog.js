const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const FoiaActivityLog = sequelize.define('FoiaActivityLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Request/Document Association
  requestId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'request_id',
    references: {
      model: 'FoiaRequests',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'Associated FOIA request (if applicable)'
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'document_id',
    references: {
      model: 'FoiaDocuments',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'Associated document (if applicable)'
  },

  // Activity Classification
  activityType: {
    type: DataTypes.ENUM(
      'request_created',
      'request_updated',
      'status_change',
      'assignment',
      'document_upload',
      'document_deleted',
      'redaction_added',
      'redaction_reviewed',
      'communication_sent',
      'communication_received',
      'deadline_extended',
      'fee_calculated',
      'fee_paid',
      'note_added',
      'exemption_applied',
      'legal_review',
      'release_approved',
      'request_closed',
      'other'
    ),
    allowNull: false,
    field: 'activity_type',
    comment: 'Type of activity performed'
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Human-readable description of action (e.g., "Status changed from Submitted to Assigned")'
  },

  // Actor Information
  actorId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'actor_id',
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'User who performed the action'
  },
  actorName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'actor_name',
    comment: 'Name of actor (for system actions or anonymous users)'
  },
  actorRole: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'actor_role',
    comment: 'Role of actor at time of action'
  },

  // Change Tracking
  oldValue: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'old_value',
    comment: 'Previous value (for updates)'
  },
  newValue: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'new_value',
    comment: 'New value (for updates)'
  },
  changes: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Detailed change tracking {field: {old: value, new: value}}'
  },

  // Context Information
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'entity_type',
    comment: 'Type of entity affected (FoiaRequest, FoiaDocument, etc.)'
  },
  entityId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'entity_id',
    comment: 'ID of affected entity'
  },

  // Security and Audit
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
    field: 'ip_address',
    comment: 'IP address of actor (supports IPv6)'
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'user_agent',
    comment: 'Browser/client user agent string'
  },
  sessionId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'session_id',
    comment: 'Session identifier'
  },

  // Additional Context
  severity: {
    type: DataTypes.ENUM('info', 'low', 'medium', 'high', 'critical'),
    defaultValue: 'info',
    comment: 'Severity level of activity'
  },
  isSystemAction: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_system_action',
    comment: 'Whether action was performed by system (vs user)'
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    comment: 'Tags for categorization and filtering'
  },

  // Metadata
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional activity metadata and context'
  },

  // Timestamp (created only, no updates)
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    comment: 'When the activity occurred'
  }
}, {
  tableName: 'FoiaActivityLogs',
  timestamps: false, // Using custom timestamp field instead
  underscored: false,
  paranoid: false, // No soft deletes for audit logs
  indexes: [
    {
      fields: ['request_id']
    },
    {
      fields: ['document_id']
    },
    {
      fields: ['activity_type']
    },
    {
      fields: ['actor_id']
    },
    {
      fields: ['entity_type', 'entity_id']
    },
    {
      fields: ['timestamp']
    },
    {
      fields: ['severity']
    },
    {
      fields: ['is_system_action']
    },
    {
      fields: ['tags'],
      using: 'gin'
    }
  ]
});

module.exports = FoiaActivityLog;
