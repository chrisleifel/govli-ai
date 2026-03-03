/**
 * Govli AI FOIA Module - Tenant Isolation Middleware
 * Implements PostgreSQL Row Level Security (RLS) for multi-tenant isolation
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { AuthRequest } from './authMiddleware';

/**
 * Database pool (should be injected)
 */
let dbPool: Pool | null = null;

/**
 * Set database pool
 */
export function setDatabasePool(pool: Pool): void {
  dbPool = pool;
}

/**
 * Tenant Isolation Middleware
 * Sets the current tenant context in PostgreSQL for RLS
 */
export function tenantIsolation() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.auth?.tenant_id;

      if (!tenantId) {
        // Log warning but don't block - some public endpoints may not have tenant
        console.warn('[TenantIsolation] No tenant_id found in request', {
          path: req.path,
          method: req.method
        });
        return next();
      }

      // Skip tenant isolation for public non-database routes
      if (req.path.startsWith('/health') || req.path.startsWith('/api/health')) {
        return next();
      }

      if (!dbPool) {
        console.error('[TenantIsolation] Database pool not configured');
        return next(); // Continue without tenant isolation (dev mode)
      }

      // Get a client from the pool for this request
      const client = await dbPool.connect();

      try {
        // Set the tenant context variable for Row Level Security
        // This variable is used in RLS policies: app.current_tenant
        await client.query(
          'SET LOCAL app.current_tenant = $1',
          [tenantId]
        );

        // Attach client to request for use in handlers
        (req as any).dbClient = client;

        // Ensure client is released after response
        let released = false;

        const releaseClient = () => {
          if (!released) {
            released = true;
            client.release();
          }
        };

        res.on('finish', releaseClient);
        res.on('close', releaseClient);

        next();
      } catch (error) {
        client.release();
        throw error;
      }
    } catch (error: any) {
      console.error('[TenantIsolation] Error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'TENANT_ISOLATION_ERROR',
          message: 'Failed to set tenant context',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        timestamp: new Date()
      });
    }
  };
}

/**
 * Subdomain-to-Tenant ID lookup (cached)
 * In production, this would query the database or cache
 */
const subdomainCache = new Map<string, string>();

export async function lookupTenantBySubdomain(subdomain: string): Promise<string | null> {
  // Check cache first
  if (subdomainCache.has(subdomain)) {
    return subdomainCache.get(subdomain)!;
  }

  // In production, query database
  if (dbPool) {
    try {
      const result = await dbPool.query(
        'SELECT id FROM tenants WHERE subdomain = $1 AND active = true',
        [subdomain]
      );

      if (result.rows.length > 0) {
        const tenantId = result.rows[0].id;
        subdomainCache.set(subdomain, tenantId);
        return tenantId;
      }
    } catch (error) {
      console.error('[TenantIsolation] Tenant lookup error:', error);
    }
  }

  return null;
}