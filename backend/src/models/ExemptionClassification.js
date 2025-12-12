const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const ExemptionClassification = sequelize.define('ExemptionClassification', {
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

  // Exemption Information
  exemptionType: {
    type: DataTypes.STRING(10),
    allowNull: false,
    field: 'exemption_type',
    comment: 'b1, b2, b3, b4, b5, b6, b7, b8, b9'
  },

  exemptionName: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'exemption_name',
    comment: 'Human-readable exemption name'
  },

  confidence: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: true,
    comment: 'Classification confidence (0.00-1.00)'
  },

  reasoning: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Why this exemption was suggested'
  },

  pageReferences: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    allowNull: true,
    field: 'page_references',
    comment: 'Pages where exemption applies'
  },

  status: {
    type: DataTypes.ENUM('suggested', 'approved', 'rejected'),
    defaultValue: 'suggested'
  }
}, {
  tableName: 'ExemptionClassifications',
  timestamps: true,
  underscored: false,
  indexes: [
    {
      fields: ['analysis_id']
    },
    {
      fields: ['exemption_type']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = ExemptionClassification;
