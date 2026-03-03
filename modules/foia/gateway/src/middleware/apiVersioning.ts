/**
 * Govli AI FOIA Module - API Versioning Middleware
 * Adds versioning headers and handles deprecation warnings
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Current API version
 */
const CURRENT_VERSION = '1.0';

/**
 * Deprecated versions and their sunset dates
 */
const DEPRECATED_VERSIONS: Record<string, string> = {
  // '0.9': '2026-06-01'  // Example: v0.9 deprecated, sunset date
};

/**
 * API Versioning Middleware
 * Adds version headers to all responses
 */
export function apiVersioning() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add API version header
    res.setHeader('X-API-Version', CURRENT_VERSION);

    // Check if request is for a deprecated version
    const requestedVersion = extractVersionFromPath(req.path);

    if (requestedVersion && DEPRECATED_VERSIONS[requestedVersion]) {
      const sunsetDate = DEPRECATED_VERSIONS[requestedVersion];
      res.setHeader('X-Deprecation', 'true');
      res.setHeader('X-Sunset-Date', sunsetDate);
      res.setHeader('Deprecation', `date="${sunsetDate}"`);
    }

    next();
  };
}

/**
 * Extract version from API path
 * Example: /api/v1/foia/... -> '1'
 */
function extractVersionFromPath(path: string): string | null {
  const match = path.match(/\/api\/v(\d+(?:\.\d+)?)\//);
  return match ? match[1] : null;
}