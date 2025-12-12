'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create Document Analysis table
    await queryInterface.createTable('DocumentAnalysis', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      documentId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'document_id',
        references: {
          model: 'FoiaDocuments',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      documentType: {
        type: Sequelize.STRING(50),
        allowNull: true,
        field: 'document_type',
        comment: 'invoice, email, report, memo, contract, etc.'
      },
      typeConfidence: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        field: 'type_confidence',
        comment: 'Confidence score for document type (0.00-1.00)'
      },
      pageCount: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'page_count'
      },
      processingStatus: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending',
        field: 'processing_status'
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Additional document metadata'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'createdAt'
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updatedAt'
      }
    });

    // Create Detected PII table
    await queryInterface.createTable('DetectedPII', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      analysisId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'analysis_id',
        references: {
          model: 'DocumentAnalysis',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      piiType: {
        type: Sequelize.STRING(50),
        allowNull: false,
        field: 'pii_type',
        comment: 'SSN, PHONE, EMAIL, ADDRESS, CREDIT_CARD, DRIVERS_LICENSE, etc.'
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'The detected PII value (may be hashed for security)'
      },
      pageNumber: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'page_number'
      },
      coordinates: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Bounding box coordinates {x, y, width, height}'
      },
      confidence: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        comment: 'Detection confidence (0.00-1.00)'
      },
      context: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Surrounding text for context'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'createdAt'
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updatedAt'
      }
    });

    // Create Redaction Suggestions table
    await queryInterface.createTable('RedactionSuggestions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      piiId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'pii_id',
        references: {
          model: 'DetectedPII',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      status: {
        type: Sequelize.ENUM('suggested', 'approved', 'rejected', 'applied'),
        defaultValue: 'suggested'
      },
      redactionMethod: {
        type: Sequelize.STRING(20),
        allowNull: true,
        field: 'redaction_method',
        comment: 'black_box, blur, pixelate, replace'
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason for redaction suggestion'
      },
      reviewedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'reviewed_by',
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      reviewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'reviewed_at'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'createdAt'
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updatedAt'
      }
    });

    // Create Exemption Classifications table
    await queryInterface.createTable('ExemptionClassifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      analysisId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'analysis_id',
        references: {
          model: 'DocumentAnalysis',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      exemptionType: {
        type: Sequelize.STRING(10),
        allowNull: false,
        field: 'exemption_type',
        comment: 'b1, b2, b3, b4, b5, b6, b7, b8, b9'
      },
      exemptionName: {
        type: Sequelize.STRING(100),
        allowNull: true,
        field: 'exemption_name',
        comment: 'Human-readable exemption name'
      },
      confidence: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        comment: 'Classification confidence (0.00-1.00)'
      },
      reasoning: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Why this exemption was suggested'
      },
      pageReferences: {
        type: Sequelize.ARRAY(Sequelize.INTEGER),
        allowNull: true,
        field: 'page_references',
        comment: 'Pages where exemption applies'
      },
      status: {
        type: Sequelize.ENUM('suggested', 'approved', 'rejected'),
        defaultValue: 'suggested'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'createdAt'
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updatedAt'
      }
    });

    // Create indexes
    await queryInterface.addIndex('DocumentAnalysis', ['document_id'], {
      name: 'idx_document_analysis_document'
    });

    await queryInterface.addIndex('DetectedPII', ['analysis_id'], {
      name: 'idx_detected_pii_analysis'
    });

    await queryInterface.addIndex('DetectedPII', ['pii_type'], {
      name: 'idx_detected_pii_type'
    });

    await queryInterface.addIndex('RedactionSuggestions', ['pii_id'], {
      name: 'idx_redaction_suggestions_pii'
    });

    await queryInterface.addIndex('RedactionSuggestions', ['status'], {
      name: 'idx_redaction_suggestions_status'
    });

    await queryInterface.addIndex('ExemptionClassifications', ['analysis_id'], {
      name: 'idx_exemption_classifications_analysis'
    });

    await queryInterface.addIndex('ExemptionClassifications', ['exemption_type'], {
      name: 'idx_exemption_classifications_type'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ExemptionClassifications');
    await queryInterface.dropTable('RedactionSuggestions');
    await queryInterface.dropTable('DetectedPII');
    await queryInterface.dropTable('DocumentAnalysis');
  }
};
