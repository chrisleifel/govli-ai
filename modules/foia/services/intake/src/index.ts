/**
 * Govli AI FOIA Module - Intake Service
 * Main entry point for FOIA request intake and validation
 */

import express, { Express } from 'express';
import { Pool } from 'pg';
import { createIntakeRouter } from './routes';
import { setDatabasePool } from './handlers';

// Export all handlers and schemas for testing
export * from './handlers';
export * from './schemas';
export * from './routes';

/**
 * Create and configure the intake service Express app
 */
export function createIntakeApp(dbPool?: Pool): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Set database pool if provided
  if (dbPool) {
    setDatabasePool(dbPool);
  }

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      service: 'foia-intake',
      status: 'healthy',
      timestamp: new Date()
    });
  });

  // Mount intake router
  const intakeRouter = createIntakeRouter();
  app.use('/intake', intakeRouter);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found'
      },
      timestamp: new Date()
    });
  });

  // Error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      },
      timestamp: new Date()
    });
  });

  return app;
}

/**
 * Start the intake service (if run directly)
 */
if (require.main === module) {
  const PORT = process.env.PORT || 3001;

  // Create database pool
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'govli_ai',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'govli_secure_password_2024'
  });

  const app = createIntakeApp(pool);

  app.listen(PORT, () => {
    console.log(`FOIA Intake Service listening on port ${PORT}`);
  });
}
