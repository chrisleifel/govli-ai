/**
 * FOIA Compliance Routes
 * All compliance, audit logging, and reporting endpoints
 */

import { Router, Response } from 'express';
import { Pool } from 'pg';
import { AuditLogService } from '../services/auditLogService';
import { LitigationHoldService } from '../services/litigationHoldService';
import { ReportService } from '../services/reportService';
import { AuthRequest } from '../middleware/authMiddleware';
import { AuditLogFilters } from '../types';

export function createComplianceRoutes(db: Pool): Router {
  const router = Router();
  const auditLogService = new AuditLogService(db);
  const litigationHoldService = new LitigationHoldService(db);
  const reportService = new ReportService(db);

  /**
   * GET /compliance/audit-log
   * Query audit logs with filters and pagination
   */
  router.get('/audit-log', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      const filters: AuditLogFilters = {
        tenant_id: req.auth.tenant_id,
        entity_id: req.query.entity_id as string,
        entity_type: req.query.entity_type as string,
        event_type: req.query.event_type as string,
        user_id: req.query.user_id as string,
        start_date: req.query.start_date ? new Date(req.query.start_date as string) : undefined,
        end_date: req.query.end_date ? new Date(req.query.end_date as string) : undefined,
        hold_flag: req.query.hold_flag === 'true' ? true : req.query.hold_flag === 'false' ? false : undefined,
        archived: req.query.archived === 'true' ? true : req.query.archived === 'false' ? false : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100
      };

      const result = await auditLogService.queryAuditLogs(filters);

      res.json({
        success: true,
        data: result,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ComplianceRoutes] Audit log query error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'QUERY_FAILED',
          message: error instanceof Error ? error.message : 'Failed to query audit logs'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * POST /compliance/requests/:id/litigation-hold
   * Create litigation hold
   */
  router.post('/requests/:id/litigation-hold', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      const { id } = req.params;
      const { reason, case_number } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'reason is required' }
        });
      }

      const hold = await litigationHoldService.createLitigationHold(
        req.auth.tenant_id,
        id,
        reason,
        case_number,
        req.auth.user_id
      );

      res.json({
        success: true,
        data: hold,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ComplianceRoutes] Create hold error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'HOLD_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create litigation hold'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * DELETE /compliance/requests/:id/litigation-hold
   * Release litigation hold
   */
  router.delete('/requests/:id/litigation-hold', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      const { id } = req.params;

      const hold = await litigationHoldService.releaseLitigationHold(
        req.auth.tenant_id,
        id,
        req.auth.user_id
      );

      res.json({
        success: true,
        data: hold,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ComplianceRoutes] Release hold error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'HOLD_RELEASE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to release litigation hold'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /compliance/annual-report
   * Generate DOJ format annual report
   */
  router.get('/annual-report', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

      const report = await reportService.generateAnnualReport(req.auth.tenant_id, year);

      res.json({
        success: true,
        data: report,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ComplianceRoutes] Annual report error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REPORT_GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to generate annual report'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /compliance/sla-summary
   * Generate SLA summary for a period
   */
  router.get('/sla-summary', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      // Default to current year if not specified
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const period_start = req.query.start_date
        ? new Date(req.query.start_date as string)
        : new Date(`${year}-01-01`);
      const period_end = req.query.end_date
        ? new Date(req.query.end_date as string)
        : new Date(`${year}-12-31 23:59:59`);

      const summary = await reportService.generateSLASummary(
        req.auth.tenant_id,
        period_start,
        period_end
      );

      res.json({
        success: true,
        data: summary,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ComplianceRoutes] SLA summary error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SLA_SUMMARY_FAILED',
          message: error instanceof Error ? error.message : 'Failed to generate SLA summary'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /compliance/audit-log/export
   * Export audit logs (foia_admin only)
   */
  router.get('/audit-log/export', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      // Admin only
      if (req.auth.role !== 'foia_admin' && req.auth.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' }
        });
      }

      const start_date = req.query.start_date
        ? new Date(req.query.start_date as string)
        : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Default: last year

      const end_date = req.query.end_date
        ? new Date(req.query.end_date as string)
        : new Date();

      const include_encrypted = req.query.include_encrypted === 'true';

      const logs = await auditLogService.exportAuditLogs(
        req.auth.tenant_id,
        start_date,
        end_date,
        include_encrypted
      );

      res.json({
        success: true,
        data: {
          logs,
          count: logs.length,
          start_date,
          end_date,
          exported_at: new Date()
        },
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ComplianceRoutes] Export error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to export audit logs'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /compliance/audit-log/statistics
   * Get audit log statistics
   */
  router.get('/audit-log/statistics', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      const start_date = req.query.start_date ? new Date(req.query.start_date as string) : undefined;
      const end_date = req.query.end_date ? new Date(req.query.end_date as string) : undefined;

      const stats = await auditLogService.getStatistics(
        req.auth.tenant_id,
        start_date,
        end_date
      );

      res.json({
        success: true,
        data: stats,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ComplianceRoutes] Statistics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'STATISTICS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get statistics'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /compliance/requests/:id/litigation-holds
   * Get all litigation holds for a request
   */
  router.get('/requests/:id/litigation-holds', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
      }

      const { id } = req.params;

      const holds = await litigationHoldService.getAllHolds(req.auth.tenant_id, id);

      res.json({
        success: true,
        data: holds,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ComplianceRoutes] Get holds error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch litigation holds'
        },
        timestamp: new Date()
      });
    }
  });

  return router;
}
