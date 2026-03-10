/**
 * AI-1: Intelligent Request Scoping Module
 * Entry point for scoping analysis service
 * Built by Govli AI FOIA Build Guide v2/v3 - Phase 4a
 */

import express from 'express';
import { Pool } from 'pg';
import { createScopingRoutes } from './routes/scopingRoutes';

const app = express();
const PORT = process.env.SCOPING_PORT || 3010;

// Middleware
app.use(express.json());

// Database connection
const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'govli',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'foia-scoping' });
});

// Mount scoping routes
app.use('/ai/scoping', createScopingRoutes(db));

// Start server
async function start() {
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    console.log('[Scoping] Database connected');

    app.listen(PORT, () => {
      console.log(`[Scoping] AI-1 Scoping service running on port ${PORT}`);
      console.log(`[Scoping] Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('[Scoping] Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Scoping] SIGTERM received, shutting down gracefully...');
  await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Scoping] SIGINT received, shutting down gracefully...');
  await db.end();
  process.exit(0);
});

// Only start if run directly (not when imported for testing)
if (require.main === module) {
  start();
}

export { app, db };
export { ScopingService } from './services/scopingService';
export * from './types';
