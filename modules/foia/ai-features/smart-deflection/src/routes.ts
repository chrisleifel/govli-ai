/**
 * Govli AI FOIA Module - Smart Deflection Routes
 * Express routes for deflection API
 */

import { Router } from 'express';
import { searchDeflection } from './handlers';

/**
 * Create and configure the smart deflection router
 */
export function createDeflectionRouter(): Router {
  const router = Router();

  /**
   * POST /ai/deflection/search
   * Search for existing content that might deflect the user's request
   */
  router.post('/search', searchDeflection);

  return router;
}