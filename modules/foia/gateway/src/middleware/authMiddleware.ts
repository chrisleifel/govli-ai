/**
 * Govli AI FOIA Module - Authentication Middleware
 * JWT verification with RS256 and auto-refresh
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

/**
 * Extended Request with auth information
 */
export interface AuthRequest extends Request {
  auth?: {
    tenant_id: string;
    user_id: string;
    roles: string[];
    email?: string;
    name?: string;
  };
}

/**
 * JWT Token Payload
 */
interface JWTPayload {
  sub: string; // user_id
  tenant_id: string;
  roles: string[];
  email?: string;
  name?: string;
  exp: number;
  iat: number;
  type: 'access' | 'refresh';
}

/**
 * Auth Error Types
 */
export enum AuthErrorType {
  TOKEN_MISSING = 'token_missing',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_INVALID = 'token_invalid',
  REFRESH_FAILED = 'refresh_failed'
}

/**
 * JWKS Client for fetching public keys
 */
const jwksClientInstance = jwksClient({
  jwksUri: process.env.JWKS_URI || 'https://auth.govli.ai/.well-known/jwks.json',
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

/**
 * Get signing key from JWKS
 */
async function getSigningKey(kid: string): Promise<string> {
  const key = await jwksClientInstance.getSigningKey(kid);
  return key.getPublicKey();
}

/**
 * Verify JWT token
 */
async function verifyToken(token: string): Promise<JWTPayload> {
  return new Promise((resolve, reject) => {
    // Decode header to get kid (key ID)
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header.kid) {
      return reject(new Error('Invalid token structure'));
    }

    // Get signing key and verify
    getSigningKey(decoded.header.kid)
      .then(publicKey => {
        jwt.verify(
          token,
          publicKey,
          {
            algorithms: ['RS256'],
            clockTolerance: 30 // 30 seconds clock skew tolerance
          },
          (err, payload) => {
            if (err) {
              return reject(err);
            }
            resolve(payload as JWTPayload);
          }
        );
      })
      .catch(reject);
  });
}

/**
 * Extract token from request
 */
function extractToken(req: Request): { accessToken?: string; refreshToken?: string } {
  let accessToken: string | undefined;
  let refreshToken: string | undefined;

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7);
  }

  // Check cookies
  if (req.cookies) {
    accessToken = accessToken || req.cookies.access_token;
    refreshToken = req.cookies.refresh_token;
  }

  return { accessToken, refreshToken };
}

/**
 * Issue new access token using refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  // Verify refresh token
  const payload = await verifyToken(refreshToken);

  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  // In production, this would call your auth service to issue a new access token
  // For now, we'll create a new token with the same claims
  const newAccessToken = jwt.sign(
    {
      sub: payload.sub,
      tenant_id: payload.tenant_id,
      roles: payload.roles,
      email: payload.email,
      name: payload.name,
      type: 'access'
    },
    process.env.JWT_SECRET || 'development-secret-key-change-in-production',
    {
      algorithm: 'HS256', // In production, use RS256 with private key
      expiresIn: '15m'
    }
  );

  return newAccessToken;
}

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = [
  '/api/v1/foia/public/',
  '/api/v1/foia/intake/requests', // POST submission
  '/api/v1/foia/intake/requests/:id/status', // GET status with confirmation number
  '/health',
  '/api/health'
];

/**
 * Check if route is public
 */
function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    if (route.endsWith('/')) {
      return path.startsWith(route);
    }
    // Handle parameterized routes
    const regex = new RegExp('^' + route.replace(/:[^/]+/g, '[^/]+') + '$');
    return regex.test(path);
  });
}

/**
 * Extract tenant from subdomain
 */
function extractTenantFromSubdomain(req: Request): string | undefined {
  const host = req.hostname;

  // Example: cityname.govli.ai -> cityname
  const parts = host.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain !== 'www' && subdomain !== 'api') {
      return subdomain; // In production, lookup tenant_id by subdomain
    }
  }

  // Check X-Tenant-Id header
  return req.headers['x-tenant-id'] as string;
}

/**
 * Authentication Middleware
 */
export function authMiddleware() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Skip authentication for public routes
      if (isPublicRoute(req.path)) {
        // Still extract tenant from subdomain for public routes
        const tenantSubdomain = extractTenantFromSubdomain(req);
        if (tenantSubdomain) {
          req.auth = {
            tenant_id: tenantSubdomain,
            user_id: 'public',
            roles: ['public']
          };
        }
        return next();
      }

      // Extract tokens
      const { accessToken, refreshToken } = extractToken(req);

      if (!accessToken) {
        return res.status(401).json({
          success: false,
          error: {
            code: AuthErrorType.TOKEN_MISSING,
            message: 'Authentication required'
          },
          timestamp: new Date()
        });
      }

      try {
        // Verify access token
        const payload = await verifyToken(accessToken);

        if (payload.type !== 'access') {
          throw new Error('Invalid token type');
        }

        // Attach auth info to request
        req.auth = {
          tenant_id: payload.tenant_id,
          user_id: payload.sub,
          roles: payload.roles,
          email: payload.email,
          name: payload.name
        };

        next();
      } catch (err: any) {
        // Token expired - attempt auto-refresh
        if (err.name === 'TokenExpiredError' && refreshToken) {
          try {
            const newAccessToken = await refreshAccessToken(refreshToken);

            // Verify new token and attach auth info
            const payload = await verifyToken(newAccessToken);
            req.auth = {
              tenant_id: payload.tenant_id,
              user_id: payload.sub,
              roles: payload.roles,
              email: payload.email,
              name: payload.name
            };

            // Set new access token in response header
            res.setHeader('X-New-Access-Token', newAccessToken);

            // Optionally set cookie
            if (req.cookies && req.cookies.access_token) {
              res.cookie('access_token', newAccessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 15 * 60 * 1000 // 15 minutes
              });
            }

            next();
          } catch (refreshErr) {
            return res.status(401).json({
              success: false,
              error: {
                code: AuthErrorType.REFRESH_FAILED,
                message: 'Token refresh failed. Please login again.'
              },
              timestamp: new Date()
            });
          }
        } else {
          // Token invalid or expired without refresh token
          const errorCode = err.name === 'TokenExpiredError'
            ? AuthErrorType.TOKEN_EXPIRED
            : AuthErrorType.TOKEN_INVALID;

          return res.status(401).json({
            success: false,
            error: {
              code: errorCode,
              message: errorCode === AuthErrorType.TOKEN_EXPIRED
                ? 'Access token expired. Please refresh or login again.'
                : 'Invalid access token'
            },
            timestamp: new Date()
          });
        }
      }
    } catch (error: any) {
      console.error('[AuthMiddleware] Error:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_ERROR',
          message: 'Authentication failed',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        timestamp: new Date()
      });
    }
  };
}

/**
 * Require authentication (use on routes that must be authenticated)
 */
export function requireAuth() {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !req.auth.user_id || req.auth.user_id === 'public') {
      return res.status(401).json({
        success: false,
        error: {
          code: AuthErrorType.TOKEN_MISSING,
          message: 'Authentication required'
        },
        timestamp: new Date()
      });
    }
    next();
  };
}