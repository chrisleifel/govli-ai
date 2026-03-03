/**
 * Govli AI FOIA Module - Intake Service Routes
 * Express routes with validation and RBAC middleware
 */

import { Router } from 'express';
import { z } from 'zod';
import type { Role } from '@govli/foia-shared';
import {
  submitRequest,
  getRequestStatus,
  validateRequest,
  acknowledgeRequest,
  getStaffQueue,
  checkDuplicates
} from './handlers';
import {
  SubmitRequestSchema,
  RequestStatusQuerySchema,
  ValidateRequestSchema,
  AcknowledgeRequestSchema,
  StaffQueueFiltersSchema,
  DuplicateCheckSchema
} from './schemas';

/**
 * Middleware to validate request body against Zod schema
 */
function validateBody(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          },
          timestamp: new Date()
        });
      } else {
        next(error);
      }
    }
  };
}

/**
 * Middleware to validate query parameters against Zod schema
 */
function validateQuery(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: error.errors
          },
          timestamp: new Date()
        });
      } else {
        next(error);
      }
    }
  };
}

/**
 * Mock RBAC middleware - requires specific role
 * In production, this would check JWT token and verify role
 */
function requireRole(...roles: Role[]) {
  return (req: any, res: any, next: any) => {
    // Mock implementation - in production, extract from JWT
    const userRole = req.headers['x-user-role'] as Role;

    if (!userRole) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        },
        timestamp: new Date()
      });
      return;
    }

    if (!roles.includes(userRole) && userRole !== 'ADMIN') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of the following roles: ${roles.join(', ')}`
        },
        timestamp: new Date()
      });
      return;
    }

    // Mock user object
    req.user = {
      id: req.headers['x-user-id'] || '00000000-0000-0000-0000-000000000001',
      role: userRole
    };

    next();
  };
}

/**
 * Create and configure the intake router
 */
export function createIntakeRouter(): Router {
  const router = Router();

  // PUBLIC ENDPOINTS

  /**
   * POST /intake/requests
   * Submit a new FOIA request (public endpoint)
   */
  router.post(
    '/requests',
    validateBody(SubmitRequestSchema),
    submitRequest
  );

  /**
   * GET /intake/requests/:id/status
   * Get request status (public + staff views)
   * Public can use confirmation_number query param
   * Staff can use ID directly
   */
  router.get(
    '/requests/:id/status',
    validateQuery(RequestStatusQuerySchema),
    getRequestStatus
  );

  // STAFF-ONLY ENDPOINTS

  /**
   * PUT /intake/requests/:id/validate
   * Validate/review a request (staff only)
   */
  router.put(
    '/requests/:id/validate',
    requireRole('FOIA_OFFICER', 'REVIEWER', 'ANALYST'),
    validateBody(ValidateRequestSchema),
    validateRequest
  );

  /**
   * POST /intake/requests/:id/acknowledge
   * Send acknowledgment to requester (staff only)
   */
  router.post(
    '/requests/:id/acknowledge',
    requireRole('FOIA_OFFICER', 'CLERK'),
    validateBody(AcknowledgeRequestSchema),
    acknowledgeRequest
  );

  /**
   * GET /intake/requests
   * Get staff queue with filters (staff only)
   */
  router.get(
    '/requests',
    requireRole('FOIA_OFFICER', 'REVIEWER', 'ANALYST', 'CLERK', 'READ_ONLY'),
    validateQuery(StaffQueueFiltersSchema),
    getStaffQueue
  );

  /**
   * POST /intake/requests/:id/duplicate-check
   * Check for duplicate or similar requests (staff only)
   */
  router.post(
    '/requests/:id/duplicate-check',
    requireRole('FOIA_OFFICER', 'ANALYST'),
    validateBody(DuplicateCheckSchema),
    checkDuplicates
  );

  return router;
}
