const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const FoiaExtractedEntity = sequelize.define('FoiaExtractedEntity', {
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
      model: 'FoiaAIAnalysis',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },

  // Entity Information
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'entity_type',
    comment: 'PERSON, ORG, DATE, LOCATION, PROJECT, AMOUNT, SSN, PHONE, EMAIL'
  },

  entityValue: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'entity_value',
    comment: 'The extracted entity value'
  },

  // Position in Text
  startPosition: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'start_position',
    comment: 'Start character position in input text'
  },

  endPosition: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'end_position',
    comment: 'End character position in input text'
  },

  // Confidence
  confidence: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    comment: 'Confidence score (0.00-1.00)'
  },

  // Context
  contextSnippet: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'context_snippet',
    comment: 'Surrounding text for context'
  }
}, {
  tableName: 'FoiaExtractedEntities',
  timestamps: true,
  underscored: false,
  indexes: [
    {
      fields: ['analysis_id']  // Physical column name from 'field' property
    },
    {
      fields: ['entity_type']  // Physical column name from 'field' property
    }
  ]
});

module.exports = FoiaExtractedEntity;
