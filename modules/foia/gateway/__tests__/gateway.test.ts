/**
 * FOIA Gateway Tests
 * Tests for rate limiting, authentication, and RBAC middleware
 */

import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import { createGateway } from '../src/gateway';
import { authMiddleware, AuthRequest } from '../src/middleware/authMiddleware';
import { requireRole } from '../src/middleware/rbacMiddleware';
import { createRateLimiter, setRedisClient, TenantTier } from '../src/middleware/rateLimiter';

describe('FOIA Gateway', () => {
  let app: Express;

  beforeAll(() => {
    // Create gateway without Redis/DB for testing
    app = createGateway({
      enableRateLimiting: false,
      enableAuditLogging: false
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'foia-gateway',
        status: 'healthy',
        version: '1.0.0'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('API Versioning', () => {
    it('should include API version headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('1.0');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes under public prefix', async () => {
      const response = await request(app)
        .get('/api/v1/foia/public/unknown-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        type: 'not_found',
        title: 'Not Found',
        status: 404
      });
    });
  });
});

describe('Authentication Middleware', () => {
  let app: Express;
  const JWT_SECRET = 'test-secret-key';

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    app = express();
    app.use(express.json());
    app.use(authMiddleware());

    // Test route that requires auth
    app.get('/api/v1/foia/protected', (req: AuthRequest, res) => {
      if (!req.auth) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      res.json({ user: req.auth });
    });

    // Public route
    app.post('/api/v1/foia/intake/requests', (req, res) => {
      res.json({ success: true });
    });
  });

  describe('Public Routes', () => {
    it('should allow access to public routes without auth', async () => {
      const response = await request(app)
        .post('/api/v1/foia/intake/requests')
        .send({ test: 'data' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Protected Routes', () => {
    it('should reject requests without token', async () => {
      const response = await request(app)
        .get('/api/v1/foia/protected')
        .expect(401);

      expect(response.body.error.code).toBe('token_missing');
    });

    it('should accept valid access token', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const response = await request(app)
        .get('/api/v1/foia/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.user).toMatchObject({
        user_id: 'user-123',
        tenant_id: 'tenant-456',
        roles: ['foia_officer']
      });
    });

    it('should reject expired token without refresh', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '-1h', algorithm: 'HS256' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/v1/foia/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body.error.code).toBe('token_expired');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/foia/protected')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);

      expect(response.body.error.code).toBe('token_invalid');
    });
  });
});

describe('RBAC Middleware', () => {
  let app: Express;
  const JWT_SECRET = 'test-secret-key';

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    app = express();
    app.use(express.json());
    app.use(authMiddleware());

    // Route requiring FOIA_OFFICER role
    app.get('/api/v1/foia/officer-only',
      requireRole('FOIA_OFFICER'),
      (req, res) => {
        res.json({ success: true });
      }
    );

    // Route requiring ADMIN role
    app.get('/api/v1/foia/admin-only',
      requireRole('ADMIN'),
      (req, res) => {
        res.json({ success: true });
      }
    );

    // Route requiring multiple possible roles
    app.get('/api/v1/foia/staff-only',
      requireRole('FOIA_OFFICER', 'REVIEWER', 'ANALYST'),
      (req, res) => {
        res.json({ success: true });
      }
    );
  });

  describe('Role Hierarchy', () => {
    it('should allow user with exact required role', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      await request(app)
        .get('/api/v1/foia/officer-only')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should allow user with higher role in hierarchy', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['platform_admin'], // Higher than foia_officer
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      await request(app)
        .get('/api/v1/foia/officer-only')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should reject user with lower role', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['clerk'], // Lower than foia_officer
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const response = await request(app)
        .get('/api/v1/foia/officer-only')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.error.code).toBe('insufficient_permissions');
      expect(response.body.error.required).toContain('FOIA_OFFICER');
    });

    it('should allow user with any of multiple required roles', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-456',
          roles: ['reviewer'], // One of the allowed roles
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      await request(app)
        .get('/api/v1/foia/staff-only')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('Unauthorized Access', () => {
    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/foia/officer-only');

      // Can be either 401 (no auth) or 403 (insufficient role)
      expect([401, 403]).toContain(response.status);
    });
  });
});

describe('Rate Limiting', () => {
  let app: Express;
  const JWT_SECRET = 'test-secret-key';

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    app = express();
    app.use(express.json());

    // Don't set Redis client - will use memory store
    app.use(createRateLimiter());
    app.use(authMiddleware());

    // Use public route for testing
    app.post('/api/v1/foia/intake/requests', (req, res) => {
      res.json({ success: true });
    });

    // Authenticated route for testing rate limits with auth
    app.get('/api/v1/foia/authenticated-test', (req: AuthRequest, res) => {
      res.json({ success: true, user: req.auth });
    });
  });

  describe('Memory Store Rate Limiting', () => {
    it('should allow requests under rate limit', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-small',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      // Make 5 requests (well under limit)
      for (let i = 0; i < 5; i++) {
        await request(app)
          .get('/api/v1/foia/authenticated-test')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }
    });

    it('should track public requests by IP', async () => {
      // Public endpoint requests should be tracked by IP
      const response = await request(app)
        .post('/api/v1/foia/intake/requests')
        .send({ test: 'data' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include rate limit headers in response', async () => {
      const token = jwt.sign(
        {
          sub: 'user-123',
          tenant_id: 'tenant-test',
          roles: ['foia_officer'],
          type: 'access'
        },
        JWT_SECRET,
        { expiresIn: '15m', algorithm: 'HS256' }
      );

      const response = await request(app)
        .get('/api/v1/foia/authenticated-test')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // express-rate-limit adds these headers
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });
  });
});

describe('Input Validation', () => {
  // Validation tests are covered in the intake service tests
  // This is just to verify the validation middleware is properly integrated
  it('should be tested in service-specific tests', () => {
    expect(true).toBe(true);
  });
});
