/**
 * Govli AI FOIA Module - Audit Logger Middleware
 * Logs all API requests to Redis Streams for analytics and compliance
 */

import { Request, Response, NextFunction} from 'express';
import Redis from 'ioredis';
import { AuthRequest } from './authMiddleware';

/**
 * Redis client for audit logging
 */
let redisClient: Redis | null = null;

/**
 * Set Redis client
 */
export function setAuditRedisClient(client: Redis): void {
  redisClient = client;
}

/**
 * Sensitive routes that require full request body logging
 */
const SENSITIVE_ROUTES = [
  '/api/v1/foia/compliance/',
  '/api/v1/foia/admin/users',
  '/api/v1/foia/admin/tenants'
];

/**
 * Check if route is sensitive
 */
function isSensitiveRoute(path: string): boolean {
  return SENSITIVE_ROUTES.some(route => path.startsWith(route));
}

/**
 * Sanitize request body (remove passwords, tokens, etc.)
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'api_key', 'access_token', 'refresh_token'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Audit Logger Middleware
 */
export function auditLogger() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Log response on finish
    res.on('finish', async () => {
      const responseTimeMs = Date.now() - startTime;

      const auditLog = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        query: req.query,
        tenant_id: req.auth?.tenant_id || 'unknown',
        user_id: req.auth?.user_id || 'anonymous',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        status_code: res.statusCode,
        response_time_ms: responseTimeMs,
        request_id: req.headers['x-request-id'] || crypto.randomUUID()
      };

      // Include request body for sensitive routes
      if (isSensitiveRoute(req.path)) {
        (auditLog as any).request_body = sanitizeBody(req.body);
      }

      // Log to console
      console.log('[AuditLog]', JSON.stringify(auditLog));

      // Emit to Redis Streams for analytics
      if (redisClient) {
        try {
          await redisClient.xadd(
            'foia:api:requests',
            '*',
            'data',
            JSON.stringify(auditLog)
          );
        } catch (error) {
          console.error('[AuditLogger] Failed to emit to Redis Streams:', error);
        }
      }
    });

    next();
  };
}