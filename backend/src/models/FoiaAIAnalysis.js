const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const FoiaAIAnalysis = sequelize.define('FoiaAIAnalysis', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Request Association
  requestId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'request_id',
    references: {
      model: 'FoiaRequests',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'Associated FOIA request (null for pre-submission analysis)'
  },

  // Analysis Type
  analysisType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'analysis_type',
    comment: 'Type: scope, entities, departments, complexity'
  },

  // Input Data
  inputText: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'input_text',
    comment: 'Original text that was analyzed'
  },

  // Results
  analysisResult: {
    type: DataTypes.JSONB,
    allowNull: false,
    field: 'analysis_result',
    comment: 'Full analysis results in JSON format'
  },

  confidenceScore: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    field: 'confidence_score',
    comment: 'Overall confidence (0.00-1.00)'
  },

  // Metadata
  modelVersion: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'model_version',
    defaultValue: 'v1.0'
  },

  processingTimeMs: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'processing_time_ms',
    comment: 'Processing time in milliseconds'
  }
}, {
  tableName: 'FoiaAIAnalysis',
  timestamps: true,
  underscored: false,
  indexes: [
    {
      fields: ['request_id']  // Physical column name from 'field' property
    },
    {
      fields: ['analysis_type']  // Physical column name from 'field' property
    },
    {
      fields: ['createdAt']  // Timestamp columns use camelCase with underscored: false
    }
  ]
});

module.exports = FoiaAIAnalysis;
