/**
 * AI-1: Intelligent Request Scoping - API Routes
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { ScopingService } from '../services/scopingService';
import { AnalyzeRequestInput, SendClarificationInput } from '../types';

interface AuthRequest extends Request {
  auth?: {
    tenant_id: string;
    user_id: string;
    role: string;
  };
}

export function createScopingRoutes(db: Pool): Router {
  const router = Router();
  const scopingService = new ScopingService(db);

  /**
   * POST /ai/scoping/analyze
   * Analyze a FOIA request for quality and completeness
   * Called automatically after POST /intake/requests succeeds
   */
  router.post('/analyze', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          },
          timestamp: new Date()
        });
      }

      const input: AnalyzeRequestInput = req.body;

      // Validate required fields
      if (!input.foia_request_id || !input.description || !input.requester_category || !input.agencies_requested) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: foia_request_id, description, requester_category, agencies_requested'
          },
          timestamp: new Date()
        });
      }

      // Perform analysis
      const analysis = await scopingService.analyzeRequest(
        req.auth.tenant_id,
        input,
        req.auth.user_id
      );

      res.status(201).json({
        success: true,
        data: analysis,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[ScopingRoutes] Analysis error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYSIS_FAILED',
          message: error.message || 'Failed to analyze request',
          details: error.message
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/scoping/:foiaRequestId/analysis
   * Get stored scoping analysis for coordinator review
   * Auth: foia_coordinator+
   */
  router.get('/:foiaRequestId/analysis', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          },
          timestamp: new Date()
        });
      }

      // Check role authorization
      const allowedRoles = ['foia_coordinator', 'foia_officer', 'admin'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions. Coordinator role required.'
          },
          timestamp: new Date()
        });
      }

      const { foiaRequestId } = req.params;

      const analysis = await scopingService.getAnalysis(
        req.auth.tenant_id,
        foiaRequestId
      );

      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No scoping analysis found for this request'
          },
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        data: analysis,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[ScopingRoutes] Get analysis error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch analysis',
          details: error.message
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * POST /ai/scoping/:foiaRequestId/send-clarification
   * Coordinator approves (or edits) the AI-drafted clarification message
   * Auth: foia_coordinator+
   */
  router.post('/:foiaRequestId/send-clarification', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          },
          timestamp: new Date()
        });
      }

      // Check role authorization
      const allowedRoles = ['foia_coordinator', 'foia_officer', 'admin'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions. Coordinator role required.'
          },
          timestamp: new Date()
        });
      }

      const { foiaRequestId } = req.params;
      const input: SendClarificationInput = req.body;

      // Validate input
      if (!input.message_text || typeof input.send_immediately !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: message_text, send_immediately'
          },
          timestamp: new Date()
        });
      }

      // Send clarification
      await scopingService.sendClarification(
        req.auth.tenant_id,
        foiaRequestId,
        req.auth.user_id,
        input.message_text,
        input.send_immediately
      );

      res.json({
        success: true,
        data: {
          foia_request_id: foiaRequestId,
          clarification_sent: input.send_immediately,
          coordinator_id: req.auth.user_id
        },
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[ScopingRoutes] Send clarification error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SEND_FAILED',
          message: error.message || 'Failed to send clarification',
          details: error.message
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/scoping/dashboard/metrics
   * Get dashboard metrics for quality tracking
   * Auth: foia_coordinator+
   */
  router.get('/dashboard/metrics', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          },
          timestamp: new Date()
        });
      }

      const days = parseInt(req.query.days as string) || 30;

      const metrics = await scopingService.getDashboardMetrics(
        req.auth.tenant_id,
        days
      );

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[ScopingRoutes] Dashboard metrics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch metrics'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/scoping/ab-testing/results
   * Get A/B testing results comparing assist vs no-assist
   * Auth: admin
   */
  router.get('/ab-testing/results', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          },
          timestamp: new Date()
        });
      }

      if (req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Admin role required'
          },
          timestamp: new Date()
        });
      }

      const results = await scopingService.getABTestingResults(req.auth.tenant_id);

      res.json({
        success: true,
        data: results,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[ScopingRoutes] A/B testing results error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch A/B testing results'
        },
        timestamp: new Date()
      });
    }
  });

  return router;
}
