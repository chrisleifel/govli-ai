/**
 * Govli AI FOIA Module - API v1 Routes
 * Mounts all service routers and handles global errors
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createIntakeRouter } from '../../../services/intake/src/routes';

/**
 * Create v1 API router
 */
export function createV1Router(): Router {
  const router = Router();

  // Mount service routers
  // Note: In production, these would be separate microservices
  // For now, we're importing from the services directory

  // Intake Service (A-1)
  router.use('/intake', createIntakeRouter());

  // Processing Service (A-2) - TODO: implement
  // router.use('/processing', createProcessingRouter());

  // Tracking Service (A-3) - TODO: implement
  // router.use('/tracking', createTrackingRouter());

  // Response Service (A-4) - TODO: implement
  // router.use('/response', createResponseRouter());

  // Compliance Service (A-5) - TODO: implement
  // router.use('/compliance', createComplianceRouter());

  // AI Features (A-6) - TODO: implement
  // router.use('/ai', createAIRouter());

  // Migration API - TODO: implement
  // router.use('/migration', createMigrationRouter());

  // Public Dashboard endpoints - TODO: implement
  // router.use('/public', createPublicRouter());

  // Compatibility Layer - TODO: implement
  // router.use('../../compat/govqa', createGovQACompatRouter());

  // 404 handler for unknown routes
  router.use((req: Request, res: Response) => {
    res.status(404).json({
      type: 'not_found',
      title: 'Not Found',
      status: 404,
      detail: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date()
    });
  });

  // Global error handler (RFC 7807 Problem+JSON format)
  router.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('[GlobalErrorHandler]', err);

    // Determine status code
    const statusCode = err.statusCode || err.status || 500;

    // Create Problem+JSON response
    const problemDetails = {
      type: err.type || 'internal_error',
      title: err.title || 'Internal Server Error',
      status: statusCode,
      detail: err.message || 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      timestamp: new Date()
    };

    res.status(statusCode).json(problemDetails);
  });

  return router;
}