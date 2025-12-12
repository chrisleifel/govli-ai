/**
 * Run Document Analysis Tables Migration
 */

const sequelize = require('./src/config/sequelize');
const migration = require('./src/migrations/20251209-add-document-analysis-tables');

async function runMigration() {
  console.log('🚀 Running Document Analysis Tables Migration...');

  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Get QueryInterface from sequelize
    const queryInterface = sequelize.getQueryInterface();

    // Run migration
    await migration.up(queryInterface, sequelize.constructor);

    console.log('✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
