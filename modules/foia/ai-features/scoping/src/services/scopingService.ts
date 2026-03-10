/**
 * AI-1: Intelligent Request Scoping Service
 * Uses shared AI client - never instantiate Anthropic directly
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { getSharedAIClient, emit } from '@govli/foia-shared';
import {
  AnalyzeRequestInput,
  ScopingAnalysis,
  ScopingAnalysisResult,
  ScopingMetrics,
  DashboardMetrics,
  ABTestingResults
} from '../types';

export class ScopingService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Analyze a FOIA request for quality and completeness using AI
   * IMPORTANT: Uses shared AI client - never instantiate Anthropic directly
   */
  async analyzeRequest(
    tenant_id: string,
    input: AnalyzeRequestInput,
    user_id?: string
  ): Promise<ScopingAnalysis> {
    const startTime = Date.now();

    // Build AI prompt
    const prompt = this.buildAnalysisPrompt(input);
    const systemPrompt = this.buildSystemPrompt();

    // Use shared AI client (Golden Rule #1)
    const aiClient = getSharedAIClient();

    try {
      // Call AI with audit logging (Golden Rule #4)
      const result = await aiClient.callWithAudit(
        {
          prompt,
          systemPrompt,
          maxTokens: 2000,
          temperature: 0.3, // Lower temperature for consistent analysis
          model: 'claude-3-5-sonnet-20241022' // Sonnet for quality analysis
        },
        'AI-1', // Intelligent Request Scoping feature
        tenant_id,
        input.foia_request_id,
        {
          foia_request_id: input.foia_request_id,
          score: 50, // Medium complexity for scoping analysis
          factors: {
            date_range_years: 0,
            agency_count: input.agencies_requested.length,
            estimated_volume: 'MEDIUM',
            requester_category: input.requester_category,
            keyword_complexity: 50
          },
          calculated_at: new Date()
        }
      );

      const latencyMs = Date.now() - startTime;

      // Parse AI response (Golden Rule #2 - handles JSON parsing failures)
      let analysisResult: ScopingAnalysisResult;
      try {
        // Extract JSON from response (may have markdown code fences)
        const jsonMatch = result.content.match(/```json\n([\s\S]*?)\n```/) ||
                         result.content.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          analysisResult = JSON.parse(jsonStr);
        } else {
          analysisResult = JSON.parse(result.content);
        }
      } catch (error) {
        console.error('[ScopingService] Failed to parse AI response:', error);
        throw new Error('Failed to parse AI scoping analysis');
      }

      // Validate analysis result structure
      if (!this.isValidAnalysisResult(analysisResult)) {
        throw new Error('Invalid AI analysis result structure');
      }

      // Store analysis in database
      const analysisId = crypto.randomUUID();

      const insertResult = await this.db.query(
        `INSERT INTO "FoiaScopingAnalyses" (
          id, foia_request_id, tenant_id,
          overall_quality, is_well_scoped, estimated_complexity,
          scoping_flags, suggested_clarification, narrowing_suggestions, reasoning,
          model_used, prompt_tokens, completion_tokens, latency_ms,
          clarification_sent, "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        RETURNING *`,
        [
          analysisId,
          input.foia_request_id,
          tenant_id,
          analysisResult.overall_quality,
          analysisResult.is_well_scoped,
          analysisResult.estimated_complexity,
          JSON.stringify(analysisResult.scoping_flags),
          analysisResult.suggested_clarification,
          JSON.stringify(analysisResult.narrowing_suggestions),
          analysisResult.reasoning,
          result.model,
          result.usage?.inputTokens || 0,
          result.usage?.outputTokens || 0,
          latencyMs,
          false
        ]
      );

      const analysis = this.mapToScopingAnalysis(insertResult.rows[0]);

      // Update request with scoping flag if not well-scoped
      if (!analysisResult.is_well_scoped) {
        const primaryFlag = analysisResult.scoping_flags[0]?.type || 'NEEDS_CLARIFICATION';
        await this.db.query(
          `UPDATE "FoiaRequests" SET scoping_flag = $1 WHERE id = $2`,
          [primaryFlag, input.foia_request_id]
        );
      } else {
        await this.db.query(
          `UPDATE "FoiaRequests" SET scoping_flag = $1 WHERE id = $2`,
          ['WELL_SCOPED', input.foia_request_id]
        );
      }

      // Create A/B testing metrics record
      await this.db.query(
        `INSERT INTO "FoiaScopingMetrics" (
          id, foia_request_id, tenant_id,
          scoping_assist_used, clarification_needed, clarification_rounds,
          "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          crypto.randomUUID(),
          input.foia_request_id,
          tenant_id,
          true, // scoping_assist_used
          !analysisResult.is_well_scoped, // clarification_needed
          0 // initial clarification_rounds
        ]
      );

      // Emit event for analytics (Golden Rule #4)
      await emit({
        id: crypto.randomUUID(),
        tenant_id,
        event_type: 'foia.ai.scoping.analyzed',
        entity_id: input.foia_request_id,
        entity_type: 'foia_request',
        user_id,
        metadata: {
          analysis_id: analysisId,
          quality_score: analysisResult.overall_quality,
          flag_count: analysisResult.scoping_flags.length,
          is_well_scoped: analysisResult.is_well_scoped,
          estimated_complexity: analysisResult.estimated_complexity
        },
        timestamp: new Date()
      });

      return analysis;
    } catch (error) {
      console.error('[ScopingService] Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get scoping analysis by request ID
   */
  async getAnalysis(
    tenant_id: string,
    foia_request_id: string
  ): Promise<ScopingAnalysis | null> {
    const result = await this.db.query(
      `SELECT sa.* FROM "FoiaScopingAnalyses" sa
       JOIN "FoiaRequests" fr ON fr.id = sa.foia_request_id
       WHERE sa.foia_request_id = $1 AND fr.tenant_id = $2`,
      [foia_request_id, tenant_id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapToScopingAnalysis(result.rows[0]);
  }

  /**
   * Send clarification message to requester
   * Golden Rule #3: Human-in-the-loop - coordinator approves/edits before sending
   */
  async sendClarification(
    tenant_id: string,
    foia_request_id: string,
    coordinator_id: string,
    message_text: string,
    send_immediately: boolean
  ): Promise<void> {
    // Get the analysis
    const analysis = await this.getAnalysis(tenant_id, foia_request_id);
    if (!analysis) {
      throw new Error('No scoping analysis found for this request');
    }

    // Determine coordinator action
    const wasEdited = message_text !== analysis.suggested_clarification;
    const coordinatorAction = wasEdited ? 'EDITED' : 'APPROVED';

    // Update analysis with coordinator action
    await this.db.query(
      `UPDATE "FoiaScopingAnalyses"
       SET coordinator_action = $1,
           coordinator_id = $2,
           coordinator_action_at = NOW(),
           edited_clarification = $3,
           clarification_sent = $4,
           clarification_sent_at = CASE WHEN $4 THEN NOW() ELSE NULL END,
           "updatedAt" = NOW()
       WHERE foia_request_id = $5`,
      [
        coordinatorAction,
        coordinator_id,
        wasEdited ? message_text : null,
        send_immediately,
        foia_request_id
      ]
    );

    // Update request status to AWAITING_CLARIFICATION if sent
    if (send_immediately) {
      await this.db.query(
        `UPDATE "FoiaRequests"
         SET status = 'AWAITING_CLARIFICATION', "updatedAt" = NOW()
         WHERE id = $1`,
        [foia_request_id]
      );

      // TODO: In production, actually send email/notification to requester
      console.log(`[ScopingService] Clarification sent to requester for request ${foia_request_id}`);

      // Update metrics
      await this.db.query(
        `UPDATE "FoiaScopingMetrics"
         SET clarification_rounds = clarification_rounds + 1,
             time_to_clarification_hours = EXTRACT(EPOCH FROM (NOW() - "createdAt")) / 3600,
             "updatedAt" = NOW()
         WHERE foia_request_id = $1`,
        [foia_request_id]
      );
    }

    // Emit event
    await emit({
      id: crypto.randomUUID(),
      tenant_id,
      event_type: 'foia.ai.scoping.clarification_sent',
      entity_id: foia_request_id,
      entity_type: 'foia_request',
      user_id: coordinator_id,
      metadata: {
        was_edited: wasEdited,
        sent_immediately: send_immediately,
        message_length: message_text.length
      },
      timestamp: new Date()
    });
  }

  /**
   * Get dashboard metrics for quality tracking
   */
  async getDashboardMetrics(
    tenant_id: string,
    days: number = 30
  ): Promise<DashboardMetrics> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get overall stats
    const statsResult = await this.db.query(
      `SELECT
        AVG(overall_quality) as avg_quality,
        COUNT(*) as total_analyses,
        SUM(CASE WHEN is_well_scoped THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as well_scoped_pct,
        SUM(CASE WHEN clarification_sent THEN 1 ELSE 0 END) as clarifications_sent
       FROM "FoiaScopingAnalyses" sa
       JOIN "FoiaRequests" fr ON fr.id = sa.foia_request_id
       WHERE fr.tenant_id = $1 AND sa."createdAt" >= $2`,
      [tenant_id, cutoffDate]
    );

    const stats = statsResult.rows[0];

    // Get flag distribution
    const flagsResult = await this.db.query(
      `SELECT scoping_flags
       FROM "FoiaScopingAnalyses" sa
       JOIN "FoiaRequests" fr ON fr.id = sa.foia_request_id
       WHERE fr.tenant_id = $1 AND sa."createdAt" >= $2`,
      [tenant_id, cutoffDate]
    );

    const flagDistribution: Record<string, number> = {};
    flagsResult.rows.forEach(row => {
      const flags = row.scoping_flags || [];
      flags.forEach((flag: any) => {
        flagDistribution[flag.type] = (flagDistribution[flag.type] || 0) + 1;
      });
    });

    // Get weekly trends
    const trendsResult = await this.db.query(
      `SELECT
        DATE_TRUNC('week', sa."createdAt") as week,
        AVG(overall_quality) as avg_quality,
        COUNT(*) as analyses_count
       FROM "FoiaScopingAnalyses" sa
       JOIN "FoiaRequests" fr ON fr.id = sa.foia_request_id
       WHERE fr.tenant_id = $1 AND sa."createdAt" >= $2
       GROUP BY week
       ORDER BY week ASC`,
      [tenant_id, cutoffDate]
    );

    const weeklyTrends = trendsResult.rows.map(row => ({
      week: row.week.toISOString().split('T')[0],
      avg_quality: Math.round(parseFloat(row.avg_quality)),
      analyses_count: parseInt(row.analyses_count)
    }));

    return {
      avg_quality_score: Math.round(parseFloat(stats.avg_quality) || 0),
      total_analyses: parseInt(stats.total_analyses) || 0,
      well_scoped_percentage: Math.round(parseFloat(stats.well_scoped_pct) || 0),
      clarifications_sent: parseInt(stats.clarifications_sent) || 0,
      avg_complexity: 'MODERATE' as const, // TODO: Calculate from data
      flag_distribution: flagDistribution as any,
      weekly_trends: weeklyTrends
    };
  }

  /**
   * Get A/B testing results comparing assist vs no-assist
   */
  async getABTestingResults(tenant_id: string): Promise<ABTestingResults> {
    const result = await this.db.query(
      `SELECT
        scoping_assist_used,
        AVG(CASE WHEN clarification_needed THEN 1.0 ELSE 0.0 END) as avg_clarification_rate,
        AVG(time_to_completion_hours) as avg_completion_time,
        AVG(final_quality_score) as avg_quality,
        COUNT(*) as sample_size
       FROM "FoiaScopingMetrics" sm
       JOIN "FoiaRequests" fr ON fr.id = sm.foia_request_id
       WHERE fr.tenant_id = $1
       GROUP BY scoping_assist_used`,
      [tenant_id]
    );

    const withAssist = result.rows.find(r => r.scoping_assist_used === true) || {
      avg_clarification_rate: 0,
      avg_completion_time: 0,
      avg_quality: 0,
      sample_size: 0
    };

    const withoutAssist = result.rows.find(r => r.scoping_assist_used === false) || {
      avg_clarification_rate: 0,
      avg_completion_time: 0,
      avg_quality: 0,
      sample_size: 0
    };

    const improvement = withoutAssist.avg_clarification_rate > 0
      ? ((withoutAssist.avg_clarification_rate - withAssist.avg_clarification_rate) /
         withoutAssist.avg_clarification_rate) * 100
      : 0;

    return {
      with_assist: {
        avg_clarification_rate: parseFloat(withAssist.avg_clarification_rate) || 0,
        avg_time_to_completion: parseFloat(withAssist.avg_completion_time) || 0,
        avg_quality_score: parseFloat(withAssist.avg_quality) || 0,
        sample_size: parseInt(withAssist.sample_size) || 0
      },
      without_assist: {
        avg_clarification_rate: parseFloat(withoutAssist.avg_clarification_rate) || 0,
        avg_time_to_completion: parseFloat(withoutAssist.avg_completion_time) || 0,
        avg_quality_score: parseFloat(withoutAssist.avg_quality) || 0,
        sample_size: parseInt(withoutAssist.sample_size) || 0
      },
      improvement_percentage: Math.round(improvement)
    };
  }

  /**
   * Build AI analysis prompt
   */
  private buildAnalysisPrompt(input: AnalyzeRequestInput): string {
    let prompt = `Analyze this FOIA request for quality and completeness:\n\n`;
    prompt += `REQUEST DESCRIPTION:\n${input.description}\n\n`;

    if (input.date_range_start || input.date_range_end) {
      prompt += `DATE RANGE: ${input.date_range_start || 'unspecified'} to ${input.date_range_end || 'present'}\n`;
    }

    if (input.agencies_requested.length > 0) {
      prompt += `AGENCIES: ${input.agencies_requested.join(', ')}\n`;
    }

    prompt += `REQUESTER CATEGORY: ${input.requester_category}\n\n`;

    prompt += `Evaluate the request and return your analysis.`;

    return prompt;
  }

  /**
   * Build system prompt for AI
   * Golden Rule #2: "JSON only" in every AI system prompt
   */
  private buildSystemPrompt(): string {
    return `You are a FOIA intake specialist reviewing a new public records request for quality and completeness.

Analyze the request and return a JSON object with the following structure:

{
  "scoping_flags": [
    {
      "type": "TOO_BROAD" | "LACKS_TIME_FRAME" | "VAGUE_KEYWORDS" | "MULTIPLE_UNRELATED_TOPICS" | "MISSING_AGENCY_SPECIFICATION" | "UNREASONABLE_VOLUME" | "NEEDS_FORMAT_CLARIFICATION" | "PRIVACY_CONCERNS",
      "severity": "LOW" | "MEDIUM" | "HIGH",
      "description": "specific issue identified"
    }
  ],
  "overall_quality": 0-100,
  "is_well_scoped": boolean,
  "suggested_clarification": "draft message to requester asking for clarification (null if well-scoped)",
  "narrowing_suggestions": ["specific suggestion 1", "specific suggestion 2"],
  "estimated_complexity": "SIMPLE" | "MODERATE" | "COMPLEX" | "VERY_COMPLEX",
  "reasoning": "brief explanation of your assessment"
}

GUIDELINES:
- Be specific in clarification drafts. Use plain language at grade 8 reading level.
- Do not be condescending. Be helpful and professional.
- If the request is well-scoped, set is_well_scoped to true and suggested_clarification to null.
- Only flag actual issues - don't create problems that don't exist.
- Focus on scope and clarity, not legal exemptions (that's handled later).
- Narrowing suggestions should be concrete and actionable.

ONLY return valid JSON. No prose before or after the JSON object.`;
  }

  /**
   * Validate AI analysis result structure
   */
  private isValidAnalysisResult(result: any): result is ScopingAnalysisResult {
    return (
      result &&
      typeof result.overall_quality === 'number' &&
      typeof result.is_well_scoped === 'boolean' &&
      Array.isArray(result.scoping_flags) &&
      Array.isArray(result.narrowing_suggestions) &&
      typeof result.estimated_complexity === 'string' &&
      typeof result.reasoning === 'string'
    );
  }

  /**
   * Map database row to ScopingAnalysis object
   */
  private mapToScopingAnalysis(row: any): ScopingAnalysis {
    return {
      id: row.id,
      foia_request_id: row.foia_request_id,
      tenant_id: row.tenant_id,
      overall_quality: row.overall_quality,
      is_well_scoped: row.is_well_scoped,
      estimated_complexity: row.estimated_complexity,
      scoping_flags: typeof row.scoping_flags === 'string'
        ? JSON.parse(row.scoping_flags)
        : row.scoping_flags || [],
      suggested_clarification: row.suggested_clarification,
      narrowing_suggestions: typeof row.narrowing_suggestions === 'string'
        ? JSON.parse(row.narrowing_suggestions)
        : row.narrowing_suggestions || [],
      reasoning: row.reasoning,
      model_used: row.model_used,
      prompt_tokens: row.prompt_tokens,
      completion_tokens: row.completion_tokens,
      latency_ms: row.latency_ms,
      coordinator_action: row.coordinator_action,
      coordinator_id: row.coordinator_id,
      coordinator_action_at: row.coordinator_action_at,
      edited_clarification: row.edited_clarification,
      clarification_sent: row.clarification_sent,
      clarification_sent_at: row.clarification_sent_at,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}
