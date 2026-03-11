/**
 * AI-3: Cross-Request Pattern Intelligence & AI-11: Proactive Disclosure
 * Entry point for patterns and proactive disclosure services
 * Built by Govli AI FOIA Build Guide v2/v3 - Phase 4c
 */

import express from 'express';
import { Pool } from 'pg';
import { createPatternsRoutes } from './routes/patternsRoutes';

const app = express();
const PORT = process.env.PATTERNS_PORT || 3012;

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
  res.json({ status: 'ok', service: 'foia-patterns' });
});

// Mount patterns and proactive routes
app.use('/ai', createPatternsRoutes(db));

// Start server
async function start() {
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    console.log('[Patterns] Database connected');

    app.listen(PORT, () => {
      console.log(`[Patterns] AI-3 + AI-11 Patterns service running on port ${PORT}`);
      console.log(`[Patterns] Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('[Patterns] Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Patterns] SIGTERM received, shutting down gracefully...');
  await db.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Patterns] SIGINT received, shutting down gracefully...');
  await db.end();
  process.exit(0);
});

// Only start if run directly (not when imported for testing)
if (require.main === module) {
  start();
}

export { app, db };
export { PatternService } from './services/patternService';
export { ProactiveService } from './services/proactiveService';
export * from './types';
