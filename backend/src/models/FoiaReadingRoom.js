const { DataTypes } = require('sequelize');
const sequelize = require('../config/sequelize');

const FoiaReadingRoom = sequelize.define('FoiaReadingRoom', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },

  // Request Association (optional - can be set to null if request deleted)
  requestId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'request_id',
    references: {
      model: 'FoiaRequests',
      key: 'id'
    },
    onDelete: 'SET NULL',
    comment: 'Original FOIA request (may be null for proactive disclosures)'
  },

  // Document Information
  title: {
    type: DataTypes.STRING(500),
    allowNull: false,
    comment: 'Public title for the reading room entry'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Description of the released records'
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Brief summary for search results'
  },

  // Classification
  category: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Category for organization (e.g., "Police Reports", "Contracts")'
  },
  subcategory: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Subcategory for further organization'
  },
  keywords: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    comment: 'Keywords for search and discovery'
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    comment: 'Tags for categorization'
  },

  // Related Documents
  documentIds: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    defaultValue: [],
    field: 'document_ids',
    comment: 'Array of FoiaDocument IDs included in this reading room entry'
  },

  // Department Association
  departmentId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'department_id',
    comment: 'Department that released these records (reference only)'
  },

  // Temporal Information
  publishedDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'published_date',
    comment: 'Date records were published to reading room'
  },
  fiscalYear: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'fiscal_year',
    comment: 'Fiscal year the records relate to'
  },
  dateRangeStart: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'date_range_start',
    comment: 'Start date of record coverage period'
  },
  dateRangeEnd: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'date_range_end',
    comment: 'End date of record coverage period'
  },

  // File Information
  filePath: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'file_path',
    comment: 'Path to compiled/redacted document package'
  },
  fileSize: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'file_size',
    comment: 'File size in bytes'
  },
  fileType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'file_type',
    comment: 'MIME type of file'
  },
  fileName: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'file_name',
    comment: 'Display filename for download'
  },
  pageCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'page_count',
    comment: 'Total number of pages in document package'
  },

  // Engagement Metrics
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'view_count',
    comment: 'Number of times viewed'
  },
  downloadCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'download_count',
    comment: 'Number of times downloaded'
  },
  lastViewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_viewed_at',
    comment: 'Most recent view date'
  },

  // Display Options
  isFeatured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_featured',
    comment: 'Whether to feature this entry prominently'
  },
  isProactiveDisclosure: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_proactive_disclosure',
    comment: 'Whether this was proactively disclosed (not in response to request)'
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'display_order',
    comment: 'Custom sort order for featured items'
  },

  // Status
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived', 'withdrawn'),
    defaultValue: 'draft',
    comment: 'Publication status'
  },
  publishedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'published_by',
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'Staff member who published this entry'
  },

  // Exemptions and Redactions
  exemptionsApplied: {
    type: DataTypes.ARRAY(DataTypes.STRING(10)),
    defaultValue: [],
    field: 'exemptions_applied',
    comment: 'Array of exemption codes applied to these records'
  },
  redactionSummary: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'redaction_summary',
    comment: 'Summary of redactions applied'
  },

  // Metadata
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional metadata and custom fields'
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
    comment: 'User who created this entry'
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'updated_by',
    references: {
      model: 'Users',
      key: 'id'
    },
    comment: 'User who last updated this entry'
  }
}, {
  tableName: 'FoiaReadingRoom',
  timestamps: true,
  underscored: false,
  paranoid: true,
  indexes: [
    {
      fields: ['request_id']
    },
    {
      fields: ['category']
    },
    {
      fields: ['department_id']
    },
    {
      fields: ['published_date']
    },
    {
      fields: ['fiscal_year']
    },
    {
      fields: ['status']
    },
    {
      fields: ['is_featured']
    },
    {
      fields: ['is_proactive_disclosure']
    },
    {
      fields: ['keywords'],
      using: 'gin'
    },
    {
      fields: ['tags'],
      using: 'gin'
    },
    {
      fields: ['document_ids'],
      using: 'gin'
    },
    {
      fields: ['exemptions_applied'],
      using: 'gin'
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = FoiaReadingRoom;
