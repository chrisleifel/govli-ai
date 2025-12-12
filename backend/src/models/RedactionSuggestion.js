const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const RedactionSuggestion = sequelize.define('RedactionSuggestion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // PII Association
  piiId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'pii_id',
    references: {
      model: 'DetectedPII',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },

  // Redaction Status
  status: {
    type: DataTypes.ENUM('suggested', 'approved', 'rejected', 'applied'),
    defaultValue: 'suggested'
  },

  redactionMethod: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'redaction_method',
    comment: 'black_box, blur, pixelate, replace'
  },

  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Reason for redaction suggestion'
  },

  // Review Information
  reviewedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'reviewed_by',
    references: {
      model: 'Users',
      key: 'id'
    }
  },

  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'reviewed_at'
  }
}, {
  tableName: 'RedactionSuggestions',
  timestamps: true,
  underscored: false,
  indexes: [
    {
      fields: ['pii_id']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = RedactionSuggestion;
