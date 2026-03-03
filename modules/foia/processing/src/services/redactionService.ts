/**
 * FOIA Processing - AI Redaction Service
 * Uses shared AI client - never instantiate Anthropic directly
 */

import { Pool } from 'pg';
import { getSharedAIClient } from '@govli/foia-shared';
import { RedactionProposal, Document } from '../types';
import { emit } from '@govli/foia-shared';
import crypto from 'crypto';

/**
 * AI Redaction Service
 * Analyzes documents and proposes redactions based on exemptions
 */
export class RedactionService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Initiate AI-powered redaction analysis for all documents in a request
   */
  async initiateRedaction(
    tenant_id: string,
    foia_request_id: string,
    user_id: string
  ): Promise<{ document_count: number; proposals_generated: number }> {
    // Get all documents for this request
    const documentsResult = await this.db.query(
      `SELECT * FROM foia_documents
       WHERE tenant_id = $1 AND foia_request_id = $2 AND is_responsive = true`,
      [tenant_id, foia_request_id]
    );

    const documents = documentsResult.rows as Document[];

    if (documents.length === 0) {
      throw new Error('No responsive documents found for redaction');
    }

    let total_proposals = 0;

    // Process each document
    for (const doc of documents) {
      // Update status to AI_ANALYSIS_PENDING
      await this.db.query(
        `UPDATE foia_documents
         SET redaction_status = 'AI_ANALYSIS_PENDING', updated_at = NOW()
         WHERE id = $1`,
        [doc.id]
      );

      // Emit event
      await emit({
        id: crypto.randomUUID(),
        tenant_id,
        event_type: 'foia.document.redaction.initiated',
        entity_id: doc.id,
        entity_type: 'document',
        user_id,
        metadata: {
          foia_request_id,
          filename: doc.filename
        },
        timestamp: new Date()
      });

      // Analyze document with AI
      try {
        const proposals = await this.analyzeDocumentForRedactions(
          tenant_id,
          doc,
          foia_request_id
        );

        total_proposals += proposals.length;

        // Update status to AI_ANALYSIS_COMPLETE
        await this.db.query(
          `UPDATE foia_documents
           SET redaction_status = 'AI_ANALYSIS_COMPLETE', updated_at = NOW()
           WHERE id = $1`,
          [doc.id]
        );

        // Emit completion event
        await emit({
          id: crypto.randomUUID(),
          tenant_id,
          event_type: 'foia.document.redaction.ai_complete',
          entity_id: doc.id,
          entity_type: 'document',
          user_id,
          metadata: {
            foia_request_id,
            proposals_count: proposals.length
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error(`[RedactionService] Error analyzing document ${doc.id}:`, error);

        // Emit error event
        await emit({
          id: crypto.randomUUID(),
          tenant_id,
          event_type: 'foia.document.redaction.ai_failed',
          entity_id: doc.id,
          entity_type: 'document',
          user_id,
          metadata: {
            foia_request_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          timestamp: new Date()
        });

        // Continue with other documents
        continue;
      }
    }

    return {
      document_count: documents.length,
      proposals_generated: total_proposals
    };
  }

  /**
   * Analyze a single document and generate redaction proposals
   * IMPORTANT: Uses shared AI client - never instantiate Anthropic directly
   */
  private async analyzeDocumentForRedactions(
    tenant_id: string,
    document: Document,
    foia_request_id: string
  ): Promise<RedactionProposal[]> {
    if (!document.extracted_text) {
      throw new Error('Document has no extracted text');
    }

    // Get jurisdiction-specific exemptions
    const exemptionsResult = await this.db.query(
      `SELECT exemption_code, exemption_name, definition
       FROM foia_exemptions
       WHERE tenant_id = $1
       ORDER BY exemption_code`,
      [tenant_id]
    );

    const exemptions = exemptionsResult.rows;

    // Build system prompt for AI redaction
    const systemPrompt = this.buildRedactionSystemPrompt(exemptions);

    // Use shared AI client (never instantiate Anthropic directly)
    const aiClient = getSharedAIClient();

    const prompt = `Analyze the following document text and identify any content that should be redacted based on the provided FOIA exemptions.

Document: ${document.filename}
Page Count: ${document.page_count}

Text:
${document.extracted_text.substring(0, 50000)} ${document.extracted_text.length > 50000 ? '...(truncated)' : ''}

Return a JSON array of redaction proposals. Each proposal must have:
- text_span: The exact text to redact
- start_char: Character offset where the text starts
- end_char: Character offset where the text ends
- exemption_code: The applicable exemption code
- confidence: Confidence score (0.0 to 1.0)
- reason: Brief explanation for why this should be redacted

Be conservative - only propose redactions for clear exemption matches. When in doubt, do not redact.

Return ONLY the JSON array, no additional commentary.`;

    // Call AI with complexity score for document review (AI-2)
    const result = await aiClient.callWithAudit(
      {
        prompt,
        systemPrompt,
        maxTokens: 8000,
        model: 'claude-3-5-sonnet-20250122' // Use Sonnet for redaction analysis
      },
      'AI-2', // Document Review feature
      tenant_id,
      foia_request_id,
      {
        foia_request_id,
        score: 60,
        factors: {
          date_range_years: 0,
          agency_count: 1,
          estimated_volume: 'MEDIUM',
          requester_category: 'OTHER',
          keyword_complexity: 50
        },
        calculated_at: new Date()
      } // Medium-high complexity for redaction
    );

    // Parse AI response
    let proposals: any[];
    try {
      // Extract JSON from response (may have markdown code blocks)
      const jsonMatch = result.content.match(/```json\n([\s\S]*?)\n```/) ||
                       result.content.match(/\[([\s\S]*?)\]/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        proposals = JSON.parse(jsonStr);
      } else {
        proposals = JSON.parse(result.content);
      }
    } catch (error) {
      console.error('[RedactionService] Failed to parse AI response:', error);
      throw new Error('Failed to parse AI redaction proposals');
    }

    // Validate and store proposals
    const redactionProposals: RedactionProposal[] = [];

    for (const proposal of proposals) {
      // Validate proposal structure
      if (!proposal.text_span || !proposal.exemption_code || typeof proposal.confidence !== 'number') {
        console.warn('[RedactionService] Skipping invalid proposal:', proposal);
        continue;
      }

      // Insert into database
      const insertResult = await this.db.query(
        `INSERT INTO foia_redaction_proposals (
          id, document_id, text_span, start_char, end_char,
          exemption_code, confidence, reason, proposed_by, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING *`,
        [
          crypto.randomUUID(),
          document.id,
          proposal.text_span,
          proposal.start_char || 0,
          proposal.end_char || proposal.text_span.length,
          proposal.exemption_code,
          proposal.confidence,
          proposal.reason || 'AI-identified exemption match',
          'AI',
          'PENDING'
        ]
      );

      redactionProposals.push(insertResult.rows[0] as RedactionProposal);
    }

    // Update document status to require human review
    await this.db.query(
      `UPDATE foia_documents
       SET redaction_status = 'HUMAN_REVIEW_PENDING', updated_at = NOW()
       WHERE id = $1`,
      [document.id]
    );

    return redactionProposals;
  }

  /**
   * Build system prompt for AI redaction analysis
   */
  private buildRedactionSystemPrompt(exemptions: any[]): string {
    const exemptionsList = exemptions.map(ex =>
      `- ${ex.exemption_code}: ${ex.exemption_name}\n  ${ex.definition}`
    ).join('\n\n');

    return `You are a FOIA redaction specialist AI. Your role is to analyze documents and propose redactions based on legal exemptions.

IMPORTANT GUIDELINES:
1. Be CONSERVATIVE - only propose redactions for clear, unambiguous exemption matches
2. NEVER redact information that is already public or non-sensitive
3. Provide specific, detailed reasons for each redaction
4. Assign confidence scores honestly (0.7-0.9 for strong matches, 0.5-0.7 for possible matches)
5. When in doubt, DO NOT redact - let human reviewers decide

EXEMPTIONS APPLICABLE TO THIS JURISDICTION:

${exemptionsList}

Remember: ALL redaction proposals require human review and approval. You are assisting, not making final decisions.`;
  }

  /**
   * Get redaction proposals for a document
   */
  async getRedactionProposals(
    tenant_id: string,
    document_id: string
  ): Promise<RedactionProposal[]> {
    const result = await this.db.query(
      `SELECT rp.*
       FROM foia_redaction_proposals rp
       JOIN foia_documents d ON d.id = rp.document_id
       WHERE d.tenant_id = $1 AND rp.document_id = $2
       ORDER BY rp.start_char ASC`,
      [tenant_id, document_id]
    );

    return result.rows as RedactionProposal[];
  }

  /**
   * Update redaction proposal status (human review)
   */
  async reviewRedactionProposal(
    tenant_id: string,
    proposal_id: string,
    status: 'APPROVED' | 'REJECTED' | 'MODIFIED',
    reviewer_id: string,
    modified_text_span?: string,
    modified_exemption_code?: string
  ): Promise<RedactionProposal> {
    // Verify tenant ownership
    const checkResult = await this.db.query(
      `SELECT rp.id
       FROM foia_redaction_proposals rp
       JOIN foia_documents d ON d.id = rp.document_id
       WHERE rp.id = $1 AND d.tenant_id = $2`,
      [proposal_id, tenant_id]
    );

    if (checkResult.rows.length === 0) {
      throw new Error('Redaction proposal not found or access denied');
    }

    // Update proposal
    const updateResult = await this.db.query(
      `UPDATE foia_redaction_proposals
       SET status = $1,
           text_span = COALESCE($2, text_span),
           exemption_code = COALESCE($3, exemption_code),
           reviewed_by = $4,
           reviewed_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [status, modified_text_span, modified_exemption_code, reviewer_id, proposal_id]
    );

    const proposal = updateResult.rows[0] as RedactionProposal;

    // Emit review event
    await emit({
      id: crypto.randomUUID(),
      tenant_id,
      event_type: 'foia.redaction.proposal.reviewed',
      entity_id: proposal_id,
      entity_type: 'redaction_proposal',
      user_id: reviewer_id,
      metadata: {
        document_id: proposal.document_id,
        status,
        was_modified: !!modified_text_span || !!modified_exemption_code
      },
      timestamp: new Date()
    });

    return proposal;
  }

  /**
   * Finalize redactions for a document (mark as complete)
   */
  async finalizeDocumentRedactions(
    tenant_id: string,
    document_id: string,
    user_id: string
  ): Promise<void> {
    // Verify all proposals have been reviewed
    const pendingResult = await this.db.query(
      `SELECT COUNT(*) as pending_count
       FROM foia_redaction_proposals rp
       JOIN foia_documents d ON d.id = rp.document_id
       WHERE d.tenant_id = $1 AND rp.document_id = $2 AND rp.status = 'PENDING'`,
      [tenant_id, document_id]
    );

    if (parseInt(pendingResult.rows[0].pending_count) > 0) {
      throw new Error('Cannot finalize: pending redaction proposals remain');
    }

    // Update document status
    await this.db.query(
      `UPDATE foia_documents
       SET redaction_status = 'FINALIZED', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [document_id, tenant_id]
    );

    // Emit finalization event
    await emit({
      id: crypto.randomUUID(),
      tenant_id,
      event_type: 'foia.document.redaction.finalized',
      entity_id: document_id,
      entity_type: 'document',
      user_id,
      metadata: {
        finalized_at: new Date()
      },
      timestamp: new Date()
    });
  }
}
