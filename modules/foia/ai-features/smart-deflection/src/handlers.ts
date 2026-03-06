/**
 * Govli AI FOIA Module - Smart Deflection Handlers
 * AI-powered deflection to existing FAQ/docs before request creation
 */

import { Request, Response } from 'express';
import { Pool } from 'pg';

/**
 * Deflection search result
 */
export interface DeflectionResult {
  id: string;
  type: 'faq' | 'doc' | 'guide' | 'previous_request';
  title: string;
  summary: string;
  url?: string;
  relevance_score: number;
  metadata?: any;
}

/**
 * Deflection search response
 */
export interface DeflectionResponse {
  success: boolean;
  data?: {
    query: string;
    results: DeflectionResult[];
    deflection_confidence: number;
    recommendation: 'deflect' | 'allow_submission' | 'suggest_refinement';
    suggested_message?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: string;
  };
  timestamp: Date;
}

// Database pool (should be injected in production)
let dbPool: Pool;

export function setDatabasePool(pool: Pool): void {
  dbPool = pool;
}

/**
 * POST /ai/deflection/search
 * Search for existing content that might answer the user's question
 */
export async function searchDeflection(
  req: Request<{}, {}, { description: string; tenant_id?: string }>,
  res: Response
): Promise<void> {
  try {
    const { description, tenant_id } = req.body;
    const effectiveTenantId = tenant_id || (req as any).tenantId || '00000000-0000-0000-0000-000000000000';

    if (!description || description.trim().length < 10) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Description must be at least 10 characters'
        },
        timestamp: new Date()
      });
      return;
    }

    // In production, this would:
    // 1. Call AI service to extract keywords
    // 2. Search vector database for similar FAQs/docs
    // 3. Search for similar previous requests
    // 4. Rank results by relevance

    // Mock implementation with database search
    const results = await searchExistingContent(effectiveTenantId, description);

    // Calculate deflection confidence
    const deflection_confidence = calculateDeflectionConfidence(results);

    // Determine recommendation
    let recommendation: 'deflect' | 'allow_submission' | 'suggest_refinement';
    let suggested_message: string | undefined;

    if (deflection_confidence > 0.75) {
      recommendation = 'deflect';
      suggested_message = 'We found several resources that may answer your question. Please review these before submitting your request.';
    } else if (deflection_confidence > 0.4) {
      recommendation = 'suggest_refinement';
      suggested_message = 'We found some related resources. You can review these or refine your request for better results.';
    } else {
      recommendation = 'allow_submission';
    }

    const response: DeflectionResponse = {
      success: true,
      data: {
        query: description,
        results,
        deflection_confidence,
        recommendation,
        suggested_message
      },
      timestamp: new Date()
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error searching deflection:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DEFLECTION_SEARCH_FAILED',
        message: 'Failed to search for deflection content',
        details: error.message
      },
      timestamp: new Date()
    });
  }
}

/**
 * Helper: Search existing content
 */
async function searchExistingContent(
  tenantId: string,
  description: string
): Promise<DeflectionResult[]> {
  const results: DeflectionResult[] = [];

  try {
    // Search FAQs
    const faqQuery = `
      SELECT id, question as title, answer as summary, 'faq' as type,
             similarity(question || ' ' || answer, $1) as relevance_score
      FROM foia_faqs
      WHERE tenant_id = $2
        AND similarity(question || ' ' || answer, $1) > 0.3
      ORDER BY relevance_score DESC
      LIMIT 5
    `;

    const faqResult = await dbPool.query(faqQuery, [description, tenantId]);

    for (const row of faqResult.rows) {
      results.push({
        id: row.id,
        type: 'faq',
        title: row.title,
        summary: row.summary.substring(0, 200) + '...',
        relevance_score: row.relevance_score,
        url: `/faq/${row.id}`
      });
    }

    // Search previous requests (only fulfilled ones with public info)
    const requestQuery = `
      SELECT id, subject as title, description as summary, 'previous_request' as type,
             similarity(subject || ' ' || description, $1) as relevance_score
      FROM foia_requests
      WHERE tenant_id = $2
        AND status = 'FULFILLED'
        AND is_public = true
        AND similarity(subject || ' ' || description, $1) > 0.4
      ORDER BY relevance_score DESC
      LIMIT 3
    `;

    const requestResult = await dbPool.query(requestQuery, [description, tenantId]);

    for (const row of requestResult.rows) {
      results.push({
        id: row.id,
        type: 'previous_request',
        title: row.title,
        summary: row.summary.substring(0, 200) + '...',
        relevance_score: row.relevance_score,
        url: `/requests/${row.id}/public`
      });
    }
  } catch (error: any) {
    // If tables don't exist yet, return empty results
    console.warn('Could not search deflection content:', error.message);
  }

  // Sort by relevance and return top 10
  return results
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 10);
}

/**
 * Helper: Calculate deflection confidence
 */
function calculateDeflectionConfidence(results: DeflectionResult[]): number {
  if (results.length === 0) return 0;

  // Weight top results more heavily
  const weights = [0.5, 0.25, 0.15, 0.05, 0.05];
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < Math.min(results.length, weights.length); i++) {
    weightedSum += results[i].relevance_score * weights[i];
    totalWeight += weights[i];
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
