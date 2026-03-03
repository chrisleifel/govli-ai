/**
 * @govli/foia-gateway
 * Built by Govli AI FOIA Build Guide v2/v3
 *
 * Main entry point for the FOIA API Gateway
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { createGateway, startGateway } from './gateway';

// Export gateway factory
export { createGateway, startGateway } from './gateway';

// Export all middleware
export * from './middleware/authMiddleware';
export * from './middleware/tenantIsolation';
export * from './middleware/rateLimiter';
export * from './middleware/rbacMiddleware';
export * from './middleware/validation';
export * from './middleware/auditLogger';
export * from './middleware/apiVersioning';

// Start server if run directly
if (require.main === module) {
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Create database pool
  const dbPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'govli_ai',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  });

  // Create Redis client (optional)
  let redisClient: Redis | undefined;
  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL);
    redisClient.on('error', (err) => {
      console.error('[Redis] Error:', err);
    });
    redisClient.on('connect', () => {
      console.log('[Redis] Connected');
    });
  }

  // Start gateway
  startGateway(PORT, {
    dbPool,
    redisClient,
    enableRateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
    enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false'
  }).catch(error => {
    console.error('[Gateway] Failed to start:', error);
    process.exit(1);
  });
}
