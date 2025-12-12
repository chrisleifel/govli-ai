const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const DocumentAnalysis = sequelize.define('DocumentAnalysis', {
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
    onDelete: 'CASCADE'
  },

  // Classification Results
  documentType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'document_type',
    comment: 'invoice, email, report, memo, contract, letter, form, other'
  },

  typeConfidence: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    field: 'type_confidence',
    comment: 'Confidence score for document type (0.00-1.00)'
  },

  pageCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'page_count'
  },

  processingStatus: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending',
    field: 'processing_status'
  },

  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Additional document metadata (file size, creation date, etc.)'
  }
}, {
  tableName: 'DocumentAnalysis',
  timestamps: true,
  underscored: false,
  indexes: [
    {
      fields: ['document_id']
    },
    {
      fields: ['processing_status']
    },
    {
      fields: ['document_type']
    }
  ]
});

module.exports = DocumentAnalysis;
