/**
 * Govli AI FOIA Module - Processing Service Handlers
 * Document review, triage, and redaction with v2.0 enhancements
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { ModelRouter } from '../../../ai-sidecar/src/modelRouter';
import { ApiResponse, GovliEvent } from '@govli/foia-shared';

// Database and Redis connections (should be injected in production)
let dbPool: Pool;
let redisClient: Redis;
let modelRouter: ModelRouter;

export function setDatabasePool(pool: Pool): void {
  dbPool = pool;
}

export function setRedisClient(redis: Redis): void {
  redisClient = redis;
  modelRouter = new ModelRouter(redis, dbPool);
}

/**
 * Redaction suggestion from AI
 */
interface RedactionSuggestion {
  text: string;
  exemption_code: string;
  start_position: number;
  end_position: number;
  confidence: number;
  rationale: string;
}

/**
 * Document chunk for large document processing
 */
interface DocumentChunk {
  chunk_index: number;
  text: string;
  start_char: number;
  end_char: number;
}

/**
 * POST /processing/triage/:requestId
 * Triage a FOIA request (determine complexity, urgency, routing)
 * v2.0: Uses modelRouter for dynamic model selection
 */
export async function triageRequest(
  req: Request<{ requestId: string }>,
  res: Response
): Promise<void> {
  try {
    const { requestId } = req.params;
    const tenantId = (req as any).tenantId || '00000000-0000-0000-0000-000000000000';
    const userId = (req as any).user?.id;

    // Fetch request and complexity score
    const requestResult = await dbPool.query(
      'SELECT * FROM foia_requests WHERE id = $1',
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Request not found'
        },
        timestamp: new Date()
      });
      return;
    }

    const request = requestResult.rows[0];
    const complexityScore = request.complexity_score || 50; // Default to medium

    // v2.0: Use modelRouter to select appropriate model
    const modelSelection = await modelRouter.selectModel(
      tenantId,
      complexityScore,
      'AI-1' // Triage feature
    );

    // v2.0: For large descriptions (>4000 chars), use sampling
    let descriptionForTriage = request.description;
    if (descriptionForTriage && descriptionForTriage.length > 4000) {
      // Sample: first 2000 + last 1000 + middle 1000
      const first = descriptionForTriage.substring(0, 2000);
      const last = descriptionForTriage.substring(descriptionForTriage.length - 1000);
      const middleStart = Math.floor((descriptionForTriage.length - 1000) / 2);
      const middle = descriptionForTriage.substring(middleStart, middleStart + 1000);

      descriptionForTriage = `${first}\n\n[...content sampled...]\n\n${middle}\n\n[...content sampled...]\n\n${last}`;
    }

    // Mock AI triage (in production, call actual AI service)
    const triageResult = {
      suggested_priority: 'MEDIUM',
      estimated_processing_time_hours: 48,
      requires_legal_review: false,
      suggested_routing: 'STANDARD',
      key_issues: ['Requires document search', 'Standard exemptions likely'],
      model_used: modelSelection.model_name,
      complexity_score: complexityScore
    };

    res.json({
      success: true,
      data: triageResult,
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Error triaging request:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TRIAGE_FAILED',
        message: 'Failed to triage request',
        details: error.message
      },
      timestamp: new Date()
    });
  }
}

/**
 * POST /processing/redact/:requestId
 * Generate redaction suggestions for documents
 * v2.0: Supports chunked processing and batch queuing
 */
export async function generateRedactions(
  req: Request<{ requestId: string }, {}, { document_ids: string[] }>,
  res: Response
): Promise<void> {
  try {
    const { requestId } = req.params;
    const { document_ids } = req.body;
    const tenantId = (req as any).tenantId || '00000000-0000-0000-0000-000000000000';
    const userId = (req as any).user?.id;

    if (!document_ids || document_ids.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'document_ids array is required'
        },
        timestamp: new Date()
      });
      return;
    }

    // Fetch request complexity score
    const requestResult = await dbPool.query(
      'SELECT complexity_score FROM foia_requests WHERE id = $1',
      [requestId]
    );

    if (requestResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Request not found'
        },
        timestamp: new Date()
      });
      return;
    }

    const complexityScore = requestResult.rows[0].complexity_score || 50;

    // v2.0: Batch redaction for high-volume requests (>20 documents)
    if (document_ids.length > 20) {
      // Queue for batch processing
      const batchId = uuidv4();

      await dbPool.query(
        `INSERT INTO foia_batch_jobs (
          id, tenant_id, request_id, job_type, document_count, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [batchId, tenantId, requestId, 'REDACTION', document_ids.length, 'QUEUED']
      );

      // Store document IDs in job metadata
      await dbPool.query(
        `UPDATE foia_batch_jobs
         SET metadata = $1
         WHERE id = $2`,
        [JSON.stringify({ document_ids }), batchId]
      );

      // Emit batch queued event
      console.log(`[BatchRedaction] Queued batch job ${batchId} with ${document_ids.length} documents`);

      res.json({
        success: true,
        data: {
          batch_id: batchId,
          status: 'BATCH_QUEUED',
          document_count: document_ids.length,
          estimated_completion_minutes: Math.ceil(document_ids.length * 2) // 2 min per doc
        },
        timestamp: new Date()
      });
      return;
    }

    // v2.0: Use modelRouter for model selection
    const modelSelection = await modelRouter.selectModel(
      tenantId,
      complexityScore,
      'AI-3' // Redaction feature
    );

    // Process documents synchronously (for <20 documents)
    const results = [];

    for (const docId of document_ids) {
      // Fetch document text
      const docResult = await dbPool.query(
        'SELECT id, text_content FROM foia_documents WHERE id = $1',
        [docId]
      );

      if (docResult.rows.length === 0) {
        results.push({
          document_id: docId,
          error: 'Document not found'
        });
        continue;
      }

      const document = docResult.rows[0];
      const textContent = document.text_content || '';

      // v2.0: Chunked processing for large documents (>8000 chars for redaction)
      let redactionSuggestions: RedactionSuggestion[] = [];

      if (textContent.length > 8000) {
        // Split into chunks with 200-char overlap
        const chunks = chunkText(textContent, 8000, 200);

        for (const chunk of chunks) {
          const chunkSuggestions = await processRedactionChunk(
            chunk.text,
            modelSelection.model_name,
            chunk.start_char
          );

          redactionSuggestions.push(...chunkSuggestions);
        }

        // Merge overlapping redactions
        redactionSuggestions = mergeOverlappingRedactions(redactionSuggestions);
      } else {
        // Process entire document
        redactionSuggestions = await processRedactionChunk(
          textContent,
          modelSelection.model_name,
          0
        );
      }

      // Store redaction suggestions
      await storeRedactionSuggestions(docId, redactionSuggestions, userId);

      results.push({
        document_id: docId,
        redaction_count: redactionSuggestions.length,
        suggestions: redactionSuggestions,
        model_used: modelSelection.model_name
      });
    }

    res.json({
      success: true,
      data: {
        request_id: requestId,
        processed_count: results.length,
        results
      },
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Error generating redactions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REDACTION_FAILED',
        message: 'Failed to generate redactions',
        details: error.message
      },
      timestamp: new Date()
    });
  }
}

/**
 * PUT /processing/redact/:documentId/:suggestionId/override
 * Record officer override of AI redaction suggestion (for confidence calibration)
 * v2.0: Tracks AI confidence vs officer decisions
 */
export async function recordRedactionOverride(
  req: Request<
    { documentId: string; suggestionId: string },
    {},
    { action: 'accept' | 'reject' | 'modify'; notes?: string; modified_exemption?: string }
  >,
  res: Response
): Promise<void> {
  try {
    const { documentId, suggestionId } = req.params;
    const { action, notes, modified_exemption } = req.body;
    const userId = (req as any).user?.id;
    const tenantId = (req as any).tenantId || '00000000-0000-0000-0000-000000000000';

    // Fetch the original suggestion
    const suggestionResult = await dbPool.query(
      'SELECT * FROM foia_redaction_suggestions WHERE id = $1 AND document_id = $2',
      [suggestionId, documentId]
    );

    if (suggestionResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Redaction suggestion not found'
        },
        timestamp: new Date()
      });
      return;
    }

    const suggestion = suggestionResult.rows[0];

    // v2.0: Record override for confidence calibration
    await dbPool.query(
      `INSERT INTO foia_redaction_overrides (
        id, tenant_id, suggestion_id, document_id, officer_id,
        ai_confidence, ai_exemption, officer_action, officer_exemption,
        notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        uuidv4(),
        tenantId,
        suggestionId,
        documentId,
        userId,
        suggestion.confidence,
        suggestion.exemption_code,
        action,
        modified_exemption || suggestion.exemption_code,
        notes || null
      ]
    );

    // Update suggestion status
    await dbPool.query(
      `UPDATE foia_redaction_suggestions
       SET officer_action = $1, officer_id = $2, reviewed_at = NOW()
       WHERE id = $3`,
      [action, userId, suggestionId]
    );

    res.json({
      success: true,
      data: {
        suggestion_id: suggestionId,
        action,
        recorded_at: new Date()
      },
      timestamp: new Date()
    });
  } catch (error: any) {
    console.error('Error recording redaction override:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'OVERRIDE_FAILED',
        message: 'Failed to record redaction override',
        details: error.message
      },
      timestamp: new Date()
    });
  }
}

/**
 * Helper: Chunk text into overlapping segments
 * v2.0: For large document processing
 */
function chunkText(text: string, chunkSize: number, overlap: number): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let startChar = 0;
  let chunkIndex = 0;

  while (startChar < text.length) {
    const endChar = Math.min(startChar + chunkSize, text.length);
    const chunkText = text.substring(startChar, endChar);

    chunks.push({
      chunk_index: chunkIndex,
      text: chunkText,
      start_char: startChar,
      end_char: endChar
    });

    // Move start position forward, accounting for overlap
    startChar = endChar - overlap;
    if (startChar >= text.length - overlap) {
      break;
    }

    chunkIndex++;
  }

  return chunks;
}

/**
 * Helper: Process redaction for a single chunk
 * Mock implementation - in production, call AI service
 */
async function processRedactionChunk(
  text: string,
  modelName: string,
  startOffset: number
): Promise<RedactionSuggestion[]> {
  // Mock AI redaction (in production, call actual AI service)
  const suggestions: RedactionSuggestion[] = [];

  // Simple mock: detect SSN patterns
  const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/g;
  let match;

  while ((match = ssnPattern.exec(text)) !== null) {
    suggestions.push({
      text: match[0],
      exemption_code: '(b)(6)',
      start_position: startOffset + match.index,
      end_position: startOffset + match.index + match[0].length,
      confidence: 0.95,
      rationale: 'Personal privacy - Social Security Number'
    });
  }

  return suggestions;
}

/**
 * Helper: Merge overlapping redactions from multiple chunks
 */
function mergeOverlappingRedactions(
  suggestions: RedactionSuggestion[]
): RedactionSuggestion[] {
  if (suggestions.length === 0) return [];

  // Sort by start position
  suggestions.sort((a, b) => a.start_position - b.start_position);

  const merged: RedactionSuggestion[] = [suggestions[0]];

  for (let i = 1; i < suggestions.length; i++) {
    const current = suggestions[i];
    const last = merged[merged.length - 1];

    // Check if overlapping
    if (current.start_position <= last.end_position) {
      // Merge: extend end position if needed
      if (current.end_position > last.end_position) {
        last.end_position = current.end_position;
      }
      // Keep higher confidence
      if (current.confidence > last.confidence) {
        last.confidence = current.confidence;
        last.rationale = current.rationale;
      }
    } else {
      // No overlap, add as new suggestion
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Helper: Store redaction suggestions in database
 */
async function storeRedactionSuggestions(
  documentId: string,
  suggestions: RedactionSuggestion[],
  userId?: string
): Promise<void> {
  for (const suggestion of suggestions) {
    await dbPool.query(
      `INSERT INTO foia_redaction_suggestions (
        id, document_id, text, exemption_code, start_position, end_position,
        confidence, rationale, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        uuidv4(),
        documentId,
        suggestion.text,
        suggestion.exemption_code,
        suggestion.start_position,
        suggestion.end_position,
        suggestion.confidence,
        suggestion.rationale,
        userId || null
      ]
    );
  }
}
