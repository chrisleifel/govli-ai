/**
 * Govli AI FOIA Module - Rate Limiter Middleware
 * Tiered rate limiting with Redis store
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import { AuthRequest } from './authMiddleware';
import { emit } from '@govli/foia-shared';

/**
 * Tenant Tier Type
 */
export type TenantTier = 'small' | 'mid' | 'enterprise' | 'migration';

/**
 * Rate Limit Configuration
 */
const RATE_LIMITS: Record<TenantTier | 'public', number> = {
  public: 10,        // 10 req/min per IP (no auth)
  small: 100,        // 100 req/min per tenant
  mid: 500,          // 500 req/min per tenant
  enterprise: 2000,  // 2000 req/min per tenant
  migration: 5000    // 5000 req/min (time-limited token)
};

/**
 * Redis client for rate limiting
 */
let redisClient: Redis | null = null;

/**
 * Set Redis client
 */
export function setRedisClient(client: Redis): void {
  redisClient = client;
}

/**
 * Get tenant tier (from JWT claims or DB lookup)
 */
function getTenantTier(req: AuthRequest): TenantTier {
  // Check JWT claims
  if (req.auth && (req.auth as any).tenant_tier) {
    return (req.auth as any).tenant_tier;
  }

  // Check for migration token
  if (req.auth && req.auth.roles.includes('migration_api')) {
    return 'migration';
  }

  // Default to small tier
  return 'small';
}

/**
 * Get rate limit key
 */
function getRateLimitKey(req: AuthRequest): string {
  // For authenticated requests, use tenant_id
  if (req.auth && req.auth.tenant_id && req.auth.tenant_id !== 'public') {
    return `rate_limit:tenant:${req.auth.tenant_id}`;
  }

  // For public requests, use IP address
  return `rate_limit:ip:${req.ip}`;
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter() {
  // If no Redis client, use memory store (development)
  if (!redisClient) {
    console.warn('[RateLimiter] No Redis client configured, using memory store');

    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: (req: Request) => {
        const authReq = req as AuthRequest;
        if (authReq.auth && authReq.auth.tenant_id && authReq.auth.tenant_id !== 'public') {
          const tier = getTenantTier(authReq);
          return RATE_LIMITS[tier];
        }
        return RATE_LIMITS.public;
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            retry_after: Math.ceil(res.getHeader('Retry-After') as number)
          },
          timestamp: new Date()
        });
      }
    });
  }

  // Production: Use Redis store
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: (req: Request) => {
      const authReq = req as AuthRequest;
      if (authReq.auth && authReq.auth.tenant_id && authReq.auth.tenant_id !== 'public') {
        const tier = getTenantTier(authReq);
        return RATE_LIMITS[tier];
      }
      return RATE_LIMITS.public;
    },
    standardHeaders: true,
    legacyHeaders: false,
    // @ts-ignore - RedisStore type compatibility
    store: new RedisStore({
      // @ts-ignore
      client: redisClient!,
      prefix: 'foia_rl:',
      // @ts-ignore - Type compatibility between ioredis and rate-limit-redis
      sendCommand: (...args: string[]) => redisClient!.call(...args as any)
    }),
    keyGenerator: (req: Request) => {
      return getRateLimitKey(req as AuthRequest);
    },
    handler: async (req: Request, res: Response) => {
      const authReq = req as AuthRequest;

      // Log rate limit hit to analytics
      try {
        await emit({
          id: crypto.randomUUID(),
          tenant_id: authReq.auth?.tenant_id || 'unknown',
          event_type: 'foia.rate_limit.exceeded',
          entity_id: getRateLimitKey(authReq),
          entity_type: 'rate_limit',
          user_id: authReq.auth?.user_id,
          metadata: {
            path: req.path,
            method: req.method,
            tier: getTenantTier(authReq),
            ip: req.ip
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('[RateLimiter] Failed to emit analytics event:', error);
      }

      const retryAfter = Math.ceil((res.getHeader('Retry-After') as number) || 60);

      res.status(429)
        .setHeader('Retry-After', retryAfter)
        .json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            retry_after: retryAfter
          },
          timestamp: new Date()
        });
    }
  });
}