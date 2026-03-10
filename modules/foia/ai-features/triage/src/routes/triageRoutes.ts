/**
 * AI-2: Autonomous Document Triage - API Routes
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { TriageService } from '../services/triageService';
import { RunTriageInput, TriageOverrideInput } from '../types';

interface AuthRequest extends Request {
  auth?: {
    tenant_id: string;
    user_id: string;
    role: string;
  };
}

export function createTriageRoutes(db: Pool): Router {
  const router = Router();
  const triageService = new TriageService(db);

  /**
   * POST /ai/triage/:requestId/run
   * Run AI triage analysis on documents for a FOIA request
   * Can optionally specify document IDs or triage all untriaged documents
   */
  router.post('/:requestId/run', async (req: AuthRequest, res: Response) => {
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

      // Check role authorization - coordinators and officers can run triage
      const allowedRoles = ['foia_coordinator', 'foia_officer', 'admin'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions. Coordinator or officer role required.'
          },
          timestamp: new Date()
        });
      }

      const { requestId } = req.params;
      const input: RunTriageInput = req.body;

      // Run triage batch
      const batchRun = await triageService.runTriageForRequest(
        req.auth.tenant_id,
        requestId,
        req.auth.user_id,
        input.document_ids,
        input.force_retriage || false
      );

      res.status(201).json({
        success: true,
        data: batchRun,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[TriageRoutes] Run triage error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TRIAGE_FAILED',
          message: error.message || 'Failed to run triage analysis',
          details: error.message
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/triage/:requestId/results
   * Get all triage results for a FOIA request
   */
  router.get('/:requestId/results', async (req: AuthRequest, res: Response) => {
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

      const { requestId } = req.params;

      const results = await triageService.getTriageResultsForRequest(
        req.auth.tenant_id,
        requestId
      );

      res.json({
        success: true,
        data: results,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[TriageRoutes] Get results error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch triage results'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/triage/document/:documentId
   * Get triage result for a specific document
   */
  router.get('/document/:documentId', async (req: AuthRequest, res: Response) => {
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

      const { documentId } = req.params;

      const result = await triageService.getTriageResult(
        req.auth.tenant_id,
        documentId
      );

      if (!result) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'No triage result found for this document'
          },
          timestamp: new Date()
        });
      }

      res.json({
        success: true,
        data: result,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[TriageRoutes] Get document result error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch triage result'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * POST /ai/triage/document/:documentId/override
   * Override AI triage decision with human classification
   * Golden Rule #3: Human-in-the-loop for final decisions
   */
  router.post('/document/:documentId/override', async (req: AuthRequest, res: Response) => {
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
            message: 'Insufficient permissions. Coordinator or officer role required.'
          },
          timestamp: new Date()
        });
      }

      const { documentId } = req.params;
      const input: TriageOverrideInput = req.body;

      // Validate input
      if (!input.human_classification || !input.override_reason || !input.override_category) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: human_classification, override_reason, override_category'
          },
          timestamp: new Date()
        });
      }

      const override = await triageService.overrideTriageResult(
        req.auth.tenant_id,
        documentId,
        req.auth.user_id,
        input
      );

      res.json({
        success: true,
        data: override,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[TriageRoutes] Override error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'OVERRIDE_FAILED',
          message: error.message || 'Failed to override triage result',
          details: error.message
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/triage/:requestId/summary
   * Get summary statistics for triage results
   */
  router.get('/:requestId/summary', async (req: AuthRequest, res: Response) => {
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

      const { requestId } = req.params;

      const summary = await triageService.getSummaryStats(
        req.auth.tenant_id,
        requestId
      );

      res.json({
        success: true,
        data: summary,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[TriageRoutes] Get summary error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch summary statistics'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/triage/batch/:batchId
   * Get batch run information
   */
  router.get('/batch/:batchId', async (req: AuthRequest, res: Response) => {
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

      const { batchId } = req.params;

      const batchRun = await triageService.getBatchRun(batchId);

      res.json({
        success: true,
        data: batchRun,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[TriageRoutes] Get batch error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch batch run information'
        },
        timestamp: new Date()
      });
    }
  });

  return router;
}
