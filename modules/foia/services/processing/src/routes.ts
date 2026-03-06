/**
 * Govli AI FOIA Module - Processing Service Routes
 * Document triage, review, and redaction endpoints
 */

import { Router } from 'express';
import {
  triageRequest,
  generateRedactions,
  recordRedactionOverride
} from './handlers';

/**
 * Create and configure the processing router
 */
export function createProcessingRouter(): Router {
  const router = Router();

  /**
   * POST /processing/triage/:requestId
   * Triage a FOIA request
   */
  router.post('/triage/:requestId', triageRequest);

  /**
   * POST /processing/redact/:requestId
   * Generate redaction suggestions for documents
   */
  router.post('/redact/:requestId', generateRedactions);

  /**
   * PUT /processing/redact/:documentId/:suggestionId/override
   * Record officer override of AI redaction suggestion
   */
  router.put('/redact/:documentId/:suggestionId/override', recordRedactionOverride);

  return router;
}