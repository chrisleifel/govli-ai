/**
 * AI-3: Cross-Request Pattern Intelligence - API Routes
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { PatternService } from '../services/patternService';
import { ProactiveService } from '../services/proactiveService';
import {
  AnalyzePatternsInput,
  ScanProactiveInput,
  GetClustersFilters,
  GetProactiveCandidatesFilters,
  ProactiveCandidateDecisionInput
} from '../types';

interface AuthRequest extends Request {
  auth?: {
    tenant_id: string;
    user_id: string;
    role: string;
  };
}

export function createPatternsRoutes(db: Pool): Router {
  const router = Router();
  const patternService = new PatternService(db);
  const proactiveService = new ProactiveService(db);

  // ============================================================================
  // AI-3: Pattern Analysis Endpoints
  // ============================================================================

  /**
   * POST /ai/patterns/analyze
   * Run pattern analysis on historical requests (typically via cron)
   * Auth: system or foia_supervisor+
   */
  router.post('/analyze', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date()
        });
      }

      // Require supervisor or admin role
      const allowedRoles = ['foia_supervisor', 'admin', 'system'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Supervisor role required' },
          timestamp: new Date()
        });
      }

      const input: AnalyzePatternsInput = req.body;

      const job = await patternService.analyzePatterns(req.auth.tenant_id, input);

      res.status(201).json({
        success: true,
        data: job,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[PatternsRoutes] Analyze patterns error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYSIS_FAILED',
          message: error.message || 'Failed to analyze patterns'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/patterns/clusters
   * Get pattern clusters with filtering
   * Auth: foia_supervisor+
   */
  router.get('/clusters', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date()
        });
      }

      const allowedRoles = ['foia_supervisor', 'admin'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Supervisor role required' },
          timestamp: new Date()
        });
      }

      const filters: GetClustersFilters = {
        department: req.query.department as string,
        trend: req.query.trend as any,
        min_request_count: req.query.min_request_count
          ? parseInt(req.query.min_request_count as string)
          : undefined
      };

      const clusters = await patternService.getClusters(req.auth.tenant_id, filters);

      res.json({
        success: true,
        data: clusters,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[PatternsRoutes] Get clusters error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch clusters'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/patterns/repeat-requesters
   * Identify repeat requesters for proactive outreach
   * Auth: foia_supervisor+
   */
  router.get('/repeat-requesters', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date()
        });
      }

      const allowedRoles = ['foia_supervisor', 'admin'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Supervisor role required' },
          timestamp: new Date()
        });
      }

      const requesters = await patternService.getRepeatRequesters(req.auth.tenant_id);

      res.json({
        success: true,
        data: requesters,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[PatternsRoutes] Get repeat requesters error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch repeat requesters'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/patterns/routing-optimization
   * Get routing optimization recommendations
   * Auth: foia_supervisor+
   */
  router.get('/routing-optimization', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date()
        });
      }

      const allowedRoles = ['foia_supervisor', 'admin'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Supervisor role required' },
          timestamp: new Date()
        });
      }

      const optimizations = await patternService.getRoutingOptimizations(req.auth.tenant_id);

      res.json({
        success: true,
        data: optimizations,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[PatternsRoutes] Get routing optimizations error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch routing optimizations'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/patterns/dashboard
   * Get pattern analysis dashboard metrics
   * Auth: foia_supervisor+
   */
  router.get('/dashboard', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date()
        });
      }

      const allowedRoles = ['foia_supervisor', 'admin'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Supervisor role required' },
          timestamp: new Date()
        });
      }

      const metrics = await patternService.getDashboardMetrics(req.auth.tenant_id);

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[PatternsRoutes] Get dashboard metrics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch dashboard metrics'
        },
        timestamp: new Date()
      });
    }
  });

  // ============================================================================
  // AI-11: Proactive Disclosure Endpoints
  // ============================================================================

  /**
   * POST /ai/proactive/scan
   * Scan for proactive disclosure candidates (typically via cron)
   * Auth: system or foia_supervisor+
   */
  router.post('/proactive/scan', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date()
        });
      }

      const allowedRoles = ['foia_supervisor', 'admin', 'system'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Supervisor role required' },
          timestamp: new Date()
        });
      }

      const input: ScanProactiveInput = req.body;

      const job = await proactiveService.scanProactiveCandidates(req.auth.tenant_id, input);

      res.status(201).json({
        success: true,
        data: job,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[PatternsRoutes] Scan proactive candidates error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SCAN_FAILED',
          message: error.message || 'Failed to scan proactive candidates'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/proactive/candidates
   * Get proactive disclosure candidates
   * Auth: foia_supervisor+
   */
  router.get('/proactive/candidates', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date()
        });
      }

      const allowedRoles = ['foia_supervisor', 'admin'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Supervisor role required' },
          timestamp: new Date()
        });
      }

      const filters: GetProactiveCandidatesFilters = {
        status: req.query.status as any,
        should_publish_only: req.query.should_publish_only === 'true',
        min_frequency_score: req.query.min_frequency_score
          ? parseInt(req.query.min_frequency_score as string)
          : undefined
      };

      const candidates = await proactiveService.getCandidates(req.auth.tenant_id, filters);

      res.json({
        success: true,
        data: candidates,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[PatternsRoutes] Get candidates error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch candidates'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * POST /ai/proactive/candidates/:id/decision
   * Make decision on proactive disclosure candidate
   * Auth: foia_supervisor+
   */
  router.post('/proactive/candidates/:id/decision', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date()
        });
      }

      const allowedRoles = ['foia_supervisor', 'admin'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Supervisor role required' },
          timestamp: new Date()
        });
      }

      const { id } = req.params;
      const input: ProactiveCandidateDecisionInput = req.body;

      if (!input.decision || !['approve', 'dismiss'].includes(input.decision)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'decision must be "approve" or "dismiss"'
          },
          timestamp: new Date()
        });
      }

      const candidate = await proactiveService.makeDecision(
        req.auth.tenant_id,
        id,
        req.auth.user_id,
        input
      );

      res.json({
        success: true,
        data: candidate,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[PatternsRoutes] Make decision error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DECISION_FAILED',
          message: error.message || 'Failed to make decision'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/proactive/reading-room-impact
   * Get impact metrics for proactive disclosures
   * Auth: foia_officer+
   */
  router.get('/proactive/reading-room-impact', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date()
        });
      }

      const allowedRoles = ['foia_officer', 'foia_supervisor', 'admin'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Officer role required' },
          timestamp: new Date()
        });
      }

      const impact = await proactiveService.getReadingRoomImpact(req.auth.tenant_id);

      res.json({
        success: true,
        data: impact,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[PatternsRoutes] Get reading room impact error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch impact metrics'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /ai/proactive/dashboard
   * Get proactive disclosure dashboard metrics
   * Auth: foia_supervisor+
   */
  router.get('/proactive/dashboard', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
          timestamp: new Date()
        });
      }

      const allowedRoles = ['foia_supervisor', 'admin'];
      if (!allowedRoles.includes(req.auth.role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Supervisor role required' },
          timestamp: new Date()
        });
      }

      const metrics = await proactiveService.getDashboardMetrics(req.auth.tenant_id);

      res.json({
        success: true,
        data: metrics,
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error('[PatternsRoutes] Get proactive dashboard metrics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error.message || 'Failed to fetch dashboard metrics'
        },
        timestamp: new Date()
      });
    }
  });

  return router;
}
