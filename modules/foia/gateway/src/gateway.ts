/**
 * Govli AI FOIA Module - API Gateway
 * Express application with security, auth, rate limiting, and tenant isolation
 */

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Pool } from 'pg';
import Redis from 'ioredis';

// Middleware
import { authMiddleware } from './middleware/authMiddleware';
import { tenantIsolation, setDatabasePool } from './middleware/tenantIsolation';
import { createRateLimiter, setRedisClient } from './middleware/rateLimiter';
import { auditLogger, setAuditRedisClient } from './middleware/auditLogger';
import { apiVersioning } from './middleware/apiVersioning';

// Routes
import { createV1Router } from './routes/v1';

/**
 * Gateway Configuration
 */
export interface GatewayConfig {
  dbPool?: Pool;
  redisClient?: Redis;
  corsOrigins?: string[];
  enableRateLimiting?: boolean;
  enableAuditLogging?: boolean;
}

/**
 * Create FOIA API Gateway
 */
export function createGateway(config: GatewayConfig = {}): Express {
  const app = express();

  // ============================================
  // MIDDLEWARE ORDER (CRITICAL - DO NOT CHANGE)
  // ============================================

  // 1. Security headers (Helmet)
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // 2. CORS configuration
  const corsOrigins = config.corsOrigins || [
    process.env.PORTAL_URL || 'http://localhost:3000',
    process.env.ADMIN_URL || 'http://localhost:3001'
  ];

  app.use(cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-User-Role', 'X-User-Id']
  }));

  // 3. HTTP request logging (morgan)
  app.use(morgan('combined'));

  // 4. Body parsing (with large limit for document uploads)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // 5. Rate limiting
  if (config.enableRateLimiting !== false) {
    if (config.redisClient) {
      setRedisClient(config.redisClient);
    }
    app.use(createRateLimiter());
  }

  // 6. Authentication middleware
  app.use(authMiddleware());

  // 7. Tenant isolation (PostgreSQL RLS)
  if (config.dbPool) {
    setDatabasePool(config.dbPool);
  }
  app.use(tenantIsolation());

  // 8. Audit logging
  if (config.enableAuditLogging !== false) {
    if (config.redisClient) {
      setAuditRedisClient(config.redisClient);
    }
    app.use(auditLogger());
  }

  // 9. API versioning headers
  app.use(apiVersioning());

  // ============================================
  // ROUTES
  // ============================================

  // Health check endpoint (before API routes)
  app.get('/health', (req, res) => {
    res.json({
      service: 'foia-gateway',
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date()
    });
  });

  // Mount v1 API routes
  app.use('/api/v1/foia', createV1Router());

  // Root redirect
  app.get('/', (req, res) => {
    res.json({
      service: 'Govli AI FOIA Gateway',
      version: '1.0.0',
      documentation: '/api/v1/foia/docs'
    });
  });

  return app;
}

/**
 * Start the gateway server
 */
export async function startGateway(port: number = 3000, config: GatewayConfig = {}): Promise<void> {
  const app = createGateway(config);

  app.listen(port, () => {
    console.log(`[Gateway] FOIA API Gateway listening on port ${port}`);
    console.log(`[Gateway] Health check: http://localhost:${port}/health`);
    console.log(`[Gateway] API v1: http://localhost:${port}/api/v1/foia`);
  });
}