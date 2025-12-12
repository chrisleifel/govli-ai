'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create AI Analysis Storage table
    await queryInterface.createTable('FoiaAIAnalysis', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      requestId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'request_id',
        references: {
          model: 'FoiaRequests',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      analysisType: {
        type: Sequelize.STRING(50),
        allowNull: false,
        field: 'analysis_type',
        comment: 'Type of analysis: scope, entities, departments, complexity'
      },
      inputText: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'input_text'
      },
      analysisResult: {
        type: Sequelize.JSONB,
        allowNull: false,
        field: 'analysis_result'
      },
      confidenceScore: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        field: 'confidence_score'
      },
      modelVersion: {
        type: Sequelize.STRING(20),
        allowNull: true,
        field: 'model_version',
        defaultValue: 'v1.0'
      },
      processingTimeMs: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'processing_time_ms'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at'
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updated_at'
      }
    });

    // Create Entity Extraction Results table
    await queryInterface.createTable('FoiaExtractedEntities', {
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
          model: 'FoiaAIAnalysis',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      entityType: {
        type: Sequelize.STRING(50),
        allowNull: true,
        field: 'entity_type',
        comment: 'PERSON, ORG, DATE, LOCATION, PROJECT, AMOUNT, SSN, PHONE, EMAIL'
      },
      entityValue: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'entity_value'
      },
      startPosition: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'start_position'
      },
      endPosition: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'end_position'
      },
      confidence: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true
      },
      contextSnippet: {
        type: Sequelize.TEXT,
        allowNull: true,
        field: 'context_snippet'
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'created_at'
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        field: 'updated_at'
      }
    });

    // Create indexes
    await queryInterface.addIndex('FoiaAIAnalysis', ['request_id'], {
      name: 'idx_foia_ai_analysis_request'
    });

    await queryInterface.addIndex('FoiaExtractedEntities', ['analysis_id'], {
      name: 'idx_foia_entities_analysis'
    });

    await queryInterface.addIndex('FoiaExtractedEntities', ['entity_type'], {
      name: 'idx_foia_entities_type'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('FoiaExtractedEntities');
    await queryInterface.dropTable('FoiaAIAnalysis');
  }
};
