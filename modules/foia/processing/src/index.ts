/**
 * FOIA Processing Module - Main Entry Point
 * Document processing and AI redaction service
 */

import express, { Express } from 'express';
import { Pool } from 'pg';
import { createProcessingRoutes } from './routes/processingRoutes';

export interface ProcessingServiceConfig {
  port?: number;
  dbConfig?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

/**
 * Create FOIA Processing Service
 */
export function createProcessingService(config: ProcessingServiceConfig = {}): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Database connection
  const db = new Pool(config.dbConfig || {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'govli_foia',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      service: 'foia-processing',
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date()
    });
  });

  // Mount processing routes
  app.use('/api/v1/foia/processing', createProcessingRoutes(db));

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      type: 'not_found',
      title: 'Not Found',
      status: 404,
      detail: `Route ${req.method} ${req.path} not found`
    });
  });

  return app;
}

// Start server if run directly
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3002');
  const app = createProcessingService({ port });

  app.listen(port, () => {
    console.log(`[ProcessingService] Listening on port ${port}`);
  });
}

export * from './services/documentService';
export * from './services/redactionService';
export * from './types';
