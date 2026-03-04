/**
 * FOIA Compliance Module
 * Entry point for compliance, audit logging, and event consumption
 */

import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { createComplianceRoutes } from './routes/complianceRoutes';
import { authMiddleware } from './middleware/authMiddleware';
import { EventConsumerService } from './services/eventConsumerService';

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'govli',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'foia-compliance' });
});

// Mount compliance routes with auth
app.use('/compliance', authMiddleware, createComplianceRoutes(db));

// Event consumer (runs in background)
let eventConsumer: EventConsumerService | null = null;

// Start server
async function start() {
  try {
    // Test database connection
    await db.query('SELECT NOW()');
    console.log('[Compliance] Database connected');

    // Start event consumer
    eventConsumer = new EventConsumerService(db);
    await eventConsumer.start();
    console.log('[Compliance] Event consumer started');

    app.listen(PORT, () => {
      console.log(`[Compliance] FOIA Compliance service running on port ${PORT}`);
      console.log(`[Compliance] Health: http://localhost:${PORT}/health`);
      console.log(`[Compliance] Event consumer: ${eventConsumer?.isRunning() ? 'RUNNING' : 'STOPPED'}`);
    });
  } catch (error) {
    console.error('[Compliance] Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('[Compliance] Shutting down gracefully...');

  if (eventConsumer) {
    await eventConsumer.stop();
  }

  await db.end();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();

export { app, db, eventConsumer };
