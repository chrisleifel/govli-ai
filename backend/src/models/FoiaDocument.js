const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const FoiaDocument = sequelize.define('FoiaDocument', {
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

  // File Information
  filename: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Current filename in storage'
  },
  originalFilename: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'original_filename',
    comment: 'Original filename from upload'
  },
  fileType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'file_type',
    comment: 'MIME type (e.g., application/pdf, image/jpeg)'
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'file_size',
    comment: 'File size in bytes'
  },
  filePath: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'file_path',
    comment: 'Path to file in storage system'
  },

  // Document Classification
  documentType: {
    type: DataTypes.ENUM('responsive', 'non_responsive', 'duplicate', 'privileged', 'exempt'),
    defaultValue: 'responsive',
    field: 'document_type',
    comment: 'Document classification for FOIA response'
  },
  sourceDepartment: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'source_department',
    comment: 'Department that provided this document (reference only)'
  },

  // Redaction Status
  redactionStatus: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'approved', 'not_required'),
    defaultValue: 'pending',
    field: 'redaction_status',
    comment: 'Status of redaction process'
  },
  redactedFilePath: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'redacted_file_path',
    comment: 'Path to redacted version of document'
  },
  redactionCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'redaction_count',
    comment: 'Number of redactions applied'
  },
  redactedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'redacted_by',
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'Staff member who performed redactions'
  },
  redactionDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'redaction_date',
    comment: 'Date redaction was completed'
  },

  // AI Analysis
  aiPiiDetected: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'ai_pii_detected',
    defaultValue: [],
    comment: 'Array of AI-detected PII entities with locations'
  },
  aiExemptionsSuggested: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'ai_exemptions_suggested',
    defaultValue: [],
    comment: 'AI-suggested exemptions based on content analysis'
  },
  aiConfidenceScore: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    field: 'ai_confidence_score',
    comment: 'AI confidence score for detections (0.00-1.00)'
  },

  // Document Content
  pageCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'page_count',
    comment: 'Number of pages in document'
  },
  extractedText: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'extracted_text',
    comment: 'OCR or extracted text content'
  },

  // Processing Status
  processed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Whether document has been processed for PII/analysis'
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'processed_at',
    comment: 'Date AI processing was completed'
  },

  // Metadata
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional document metadata'
  },

  // Audit Fields
  uploadedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'uploaded_by',
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'User who uploaded the document'
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'created_by',
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'updated_by',
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  tableName: 'FoiaDocuments',
  timestamps: true,
  underscored: false,
  paranoid: true,
  indexes: [
    {
      fields: ['request_id']
    },
    {
      fields: ['document_type']
    },
    {
      fields: ['redaction_status']
    },
    {
      fields: ['source_department']
    },
    {
      fields: ['processed']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = FoiaDocument;
