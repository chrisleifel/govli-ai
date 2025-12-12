const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const DetectedPII = sequelize.define('DetectedPII', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Analysis Association
  analysisId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'analysis_id',
    references: {
      model: 'DocumentAnalysis',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },

  // PII Information
  piiType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'pii_type',
    comment: 'SSN, PHONE, EMAIL, ADDRESS, CREDIT_CARD, DRIVERS_LICENSE, DOB, NAME, etc.'
  },

  value: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'The detected PII value (may be hashed for security)'
  },

  // Location Information
  pageNumber: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'page_number'
  },

  coordinates: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Bounding box coordinates {x, y, width, height}'
  },

  // Confidence & Context
  confidence: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    comment: 'Detection confidence (0.00-1.00)'
  },

  context: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Surrounding text for context'
  }
}, {
  tableName: 'DetectedPII',
  timestamps: true,
  underscored: false,
  indexes: [
    {
      fields: ['analysis_id']
    },
    {
      fields: ['pii_type']
    }
  ]
});

module.exports = DetectedPII;
