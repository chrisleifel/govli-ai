/**
 * FOIA Processing - Express Routes
 * All document processing and redaction endpoints
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import multer from 'multer';
import { DocumentService } from '../services/documentService';
import { RedactionService } from '../services/redactionService';
import { AuthRequest } from '../middleware/authMiddleware';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    // Accept only specific file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

export function createProcessingRoutes(db: Pool): Router {
  const router = Router();
  const documentService = new DocumentService(db);
  const redactionService = new RedactionService(db);

  /**
   * POST /processing/requests/:foiaRequestId/search-records
   * Search for records in document repository
   */
  router.post('/requests/:foiaRequestId/search-records', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { foiaRequestId } = req.params;
      const searchParams = req.body;

      const results = await documentService.searchRecords(
        req.auth.tenant_id,
        foiaRequestId,
        searchParams
      );

      res.json({
        success: true,
        data: results,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ProcessingRoutes] Search records error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Search failed'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * POST /processing/requests/:foiaRequestId/documents
   * Upload document (multipart)
   */
  router.post('/requests/:foiaRequestId/documents', upload.single('document'), async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file uploaded' }
        });
      }

      const { foiaRequestId } = req.params;

      const result = await documentService.uploadDocument(
        req.auth.tenant_id,
        foiaRequestId,
        req.file,
        req.auth.user_id
      );

      res.status(201).json({
        success: true,
        data: result,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ProcessingRoutes] Upload error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: error instanceof Error ? error.message : 'Upload failed'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * PUT /processing/documents/:documentId/responsiveness
   * Update document responsiveness determination
   */
  router.put('/documents/:documentId/responsiveness', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { documentId } = req.params;
      const { is_responsive, confidence, reason } = req.body;

      // Validation
      if (typeof is_responsive !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'is_responsive must be boolean' }
        });
      }

      const document = await documentService.updateResponsiveness(
        req.auth.tenant_id,
        documentId,
        is_responsive,
        confidence || 1.0,
        reason || 'Manual review',
        req.auth.user_id
      );

      res.json({
        success: true,
        data: document,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ProcessingRoutes] Update responsiveness error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Update failed'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * POST /processing/requests/:foiaRequestId/redaction/initiate
   * Initiate AI-powered redaction analysis
   */
  router.post('/requests/:foiaRequestId/redaction/initiate', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { foiaRequestId } = req.params;

      const result = await redactionService.initiateRedaction(
        req.auth.tenant_id,
        foiaRequestId,
        req.auth.user_id
      );

      res.json({
        success: true,
        data: result,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ProcessingRoutes] Initiate redaction error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REDACTION_FAILED',
          message: error instanceof Error ? error.message : 'Redaction initiation failed'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /processing/documents/:documentId/redaction-review
   * Get redaction proposals for review
   */
  router.get('/documents/:documentId/redaction-review', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { documentId } = req.params;

      const proposals = await redactionService.getRedactionProposals(
        req.auth.tenant_id,
        documentId
      );

      res.json({
        success: true,
        data: {
          document_id: documentId,
          proposals,
          total_count: proposals.length
        },
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ProcessingRoutes] Get redaction review error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch redaction proposals'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * PUT /processing/documents/:documentId/redaction-review
   * Review and update redaction proposals
   */
  router.put('/documents/:documentId/redaction-review', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { documentId } = req.params;
      const { proposal_id, status, modified_text_span, modified_exemption_code } = req.body;

      // Validation
      if (!proposal_id || !status) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'proposal_id and status are required' }
        });
      }

      if (!['APPROVED', 'REJECTED', 'MODIFIED'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: 'status must be APPROVED, REJECTED, or MODIFIED' }
        });
      }

      const proposal = await redactionService.reviewRedactionProposal(
        req.auth.tenant_id,
        proposal_id,
        status,
        req.auth.user_id,
        modified_text_span,
        modified_exemption_code
      );

      res.json({
        success: true,
        data: proposal,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ProcessingRoutes] Review redaction error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REVIEW_FAILED',
          message: error instanceof Error ? error.message : 'Redaction review failed'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * POST /processing/documents/:documentId/redaction/finalize
   * Finalize redactions for a document
   */
  router.post('/documents/:documentId/redaction/finalize', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { documentId } = req.params;

      await redactionService.finalizeDocumentRedactions(
        req.auth.tenant_id,
        documentId,
        req.auth.user_id
      );

      res.json({
        success: true,
        data: { document_id: documentId, status: 'FINALIZED' },
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ProcessingRoutes] Finalize redaction error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FINALIZE_FAILED',
          message: error instanceof Error ? error.message : 'Finalization failed'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * POST /processing/requests/:foiaRequestId/package
   * Package responsive documents for release
   */
  router.post('/requests/:foiaRequestId/package', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { foiaRequestId } = req.params;
      const packageOptions = req.body;

      // Set defaults
      const options = {
        include_responsive_only: packageOptions.include_responsive_only !== false,
        include_redaction_log: packageOptions.include_redaction_log === true,
        format: packageOptions.format || 'PDF'
      };

      const result = await documentService.packageDocuments(
        req.auth.tenant_id,
        foiaRequestId,
        options,
        req.auth.user_id
      );

      res.json({
        success: true,
        data: result,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ProcessingRoutes] Package documents error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PACKAGE_FAILED',
          message: error instanceof Error ? error.message : 'Packaging failed'
        },
        timestamp: new Date()
      });
    }
  });

  /**
   * GET /processing/requests/:foiaRequestId/documents
   * Get all documents for a request
   */
  router.get('/requests/:foiaRequestId/documents', async (req: AuthRequest, res: Response) => {
    try {
      if (!req.auth) {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      }

      const { foiaRequestId } = req.params;

      const documents = await documentService.getDocumentsByRequest(
        req.auth.tenant_id,
        foiaRequestId
      );

      res.json({
        success: true,
        data: documents,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[ProcessingRoutes] Get documents error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch documents'
        },
        timestamp: new Date()
      });
    }
  });

  return router;
}
