const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const FoiaRedaction = sequelize.define('FoiaRedaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Document Association
  documentId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'document_id',
    references: {
      model: 'FoiaDocuments',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'Associated FOIA document'
  },

  // Redaction Location
  pageNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'page_number',
    comment: 'Page number where redaction appears (null for non-paginated files)'
  },
  coordinates: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Redaction box coordinates {x, y, width, height} in pixels or percentage'
  },

  // Redaction Type and Classification
  redactionType: {
    type: DataTypes.ENUM('text', 'image', 'full_page', 'metadata'),
    allowNull: false,
    field: 'redaction_type',
    defaultValue: 'text',
    comment: 'Type of content being redacted'
  },
  exemptionCode: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'exemption_code',
    comment: 'FOIA exemption code applied (e.g., b6, b7C, b5)'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Detailed reason for redaction'
  },

  // AI Detection
  aiDetected: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'ai_detected',
    comment: 'Whether this redaction was AI-suggested vs manually added'
  },
  aiConfidence: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    field: 'ai_confidence',
    comment: 'AI confidence score for detection (0.00-1.00)'
  },
  aiEntityType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'ai_entity_type',
    comment: 'Type of PII detected by AI (SSN, email, phone, name, etc.)'
  },

  // Review and Approval
  reviewed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether redaction has been reviewed by staff'
  },
  reviewedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'reviewed_by',
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'Staff member who reviewed this redaction'
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reviewed_at',
    comment: 'Date redaction was reviewed'
  },
  reviewStatus: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'modified'),
    allowNull: true,
    field: 'review_status',
    defaultValue: 'pending',
    comment: 'Review decision status'
  },
  reviewNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'review_notes',
    comment: 'Notes from reviewer about this redaction'
  },

  // Redaction Content
  originalText: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'original_text',
    comment: 'Original text that was redacted (for audit trail)'
  },
  replacementText: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'replacement_text',
    comment: 'Replacement text (e.g., "[REDACTED - SSN]")'
  },

  // Metadata
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional redaction metadata'
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
    comment: 'User who created the redaction'
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'updated_by',
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'User who last updated the redaction'
  }
}, {
  tableName: 'FoiaRedactions',
  timestamps: true,
  underscored: false,
  paranoid: true,
  indexes: [
    {
      fields: ['document_id']
    },
    {
      fields: ['page_number']
    },
    {
      fields: ['exemption_code']
    },
    {
      fields: ['redaction_type']
    },
    {
      fields: ['ai_detected']
    },
    {
      fields: ['reviewed']
    },
    {
      fields: ['review_status']
    },
    {
      fields: ['reviewed_by']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = FoiaRedaction;
