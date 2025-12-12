const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const FoiaExemption = sequelize.define('FoiaExemption', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Exemption Identification
  code: {
    type: DataTypes.STRING(10),
    unique: true,
    allowNull: false,
    comment: 'Exemption code (e.g., b1, b6, b7C for federal; varies by state)'
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
    comment: 'Short name/title of exemption'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Full description of what the exemption covers'
  },

  // Legal Foundation
  legalCitation: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'legal_citation',
    comment: 'Legal citation (e.g., "5 U.S.C. § 552(b)(6)")'
  },
  statute: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: 'Statute or law name (e.g., "Freedom of Information Act")'
  },

  // Jurisdiction
  appliesTo: {
    type: DataTypes.ENUM('federal', 'state', 'local', 'both'),
    allowNull: false,
    field: 'applies_to',
    defaultValue: 'federal',
    comment: 'Jurisdiction level this exemption applies to'
  },
  state: {
    type: DataTypes.STRING(2),
    allowNull: true,
    comment: 'Two-letter state code if state-specific exemption'
  },

  // Classification
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Category of exemption (e.g., "National Security", "Personal Privacy")'
  },
  subcategory: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Subcategory for more specific classification'
  },

  // Usage Guidance
  examples: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Examples of when to apply this exemption'
  },
  usageNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'usage_notes',
    comment: 'Notes and guidance for proper application'
  },
  commonPiiTypes: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'common_pii_types',
    comment: 'Common PII types associated with this exemption (SSN, DOB, etc.)'
  },

  // Display and Sorting
  displayOrder: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'display_order',
    comment: 'Sort order for display purposes'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
    comment: 'Whether this exemption is currently active'
  },
  isFrequentlyUsed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_frequently_used',
    comment: 'Flag for commonly used exemptions'
  },

  // Related Information
  relatedExemptions: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'related_exemptions',
    comment: 'Array of related exemption codes'
  },
  keywordMatches: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'keyword_matches',
    comment: 'Keywords that might trigger this exemption for AI assistance'
  },

  // Metadata
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional exemption metadata'
  }
}, {
  tableName: 'FoiaExemptions',
  timestamps: true,
  underscored: false,
  paranoid: false, // Reference data - no soft deletes
  indexes: [
    {
      fields: ['code'],
      unique: true
    },
    {
      fields: ['applies_to']
    },
    {
      fields: ['state']
    },
    {
      fields: ['category']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['is_frequently_used']
    },
    {
      fields: ['display_order']
    },
    {
      fields: ['keyword_matches'],
      using: 'gin'
    },
    {
      fields: ['common_pii_types'],
      using: 'gin'
    }
  ]
});

module.exports = FoiaExemption;
