/**
 * AI-11: Proactive Disclosure Engine - Service
 * Uses shared AI client - never instantiate Anthropic directly
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { getSharedAIClient, emit } from '@govli/foia-shared';
import {
  ProactiveCandidate,
  ProactiveCandidateAnalysis,
  ProactiveImpact,
  ProactiveImpactSummary,
  ScanProactiveInput,
  ProactiveCandidateDecisionInput,
  GetProactiveCandidatesFilters,
  ProactiveDashboardMetrics,
  PatternAnalysisJob
} from '../types';

export class ProactiveService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Scan for proactive disclosure candidates
   * Typically run weekly via cron
   */
  async scanProactiveCandidates(
    tenant_id: string,
    input: ScanProactiveInput = {}
  ): Promise<PatternAnalysisJob> {
    const jobId = crypto.randomUUID();
    const startTime = Date.now();

    // Create job record
    await this.db.query(
      `INSERT INTO "FoiaPatternAnalysisJobs" (
        id, tenant_id, job_type, status, started_at, "createdAt"
      ) VALUES ($1, $2, 'PROACTIVE_SCAN', 'RUNNING', NOW(), NOW())`,
      [jobId, tenant_id]
    );

    try {
      const frequencyThreshold = input.frequency_threshold || 5;
      const lookbackMonths = input.lookback_months || 12;

      // Get high-frequency pattern clusters
      const clustersResult = await this.db.query(
        `SELECT * FROM "FoiaRequestPatterns"
         WHERE tenant_id = $1
           AND request_count_12mo >= $2
         ORDER BY request_count_12mo DESC`,
        [tenant_id, frequencyThreshold]
      );

      const clusters = clustersResult.rows;

      if (clusters.length === 0) {
        await this.completeJob(jobId, 0, startTime, null);
        return this.getJob(jobId);
      }

      let candidatesGenerated = 0;

      // Analyze each cluster for proactive disclosure potential
      for (const cluster of clusters) {
        const analysis = await this.evaluateProactiveDisclosure(
          tenant_id,
          cluster
        );

        // Store candidate
        await this.storeCandidate(tenant_id, cluster, analysis);
        candidatesGenerated++;
      }

      // Complete job
      await this.completeJob(jobId, candidatesGenerated, startTime, null);

      // Emit event
      await emit({
        id: crypto.randomUUID(),
        tenant_id,
        event_type: 'foia.ai.proactive.candidates_generated',
        entity_id: jobId,
        entity_type: 'pattern_job',
        metadata: {
          candidates_generated: candidatesGenerated,
          frequency_threshold: frequencyThreshold
        },
        timestamp: new Date()
      });

      return this.getJob(jobId);
    } catch (error: any) {
      console.error('[ProactiveService] Scan failed:', error);
      await this.completeJob(jobId, 0, startTime, error.message);
      throw error;
    }
  }

  /**
   * Use AI to evaluate if a cluster should be proactively disclosed
   */
  private async evaluateProactiveDisclosure(
    tenant_id: string,
    cluster: any
  ): Promise<ProactiveCandidateAnalysis> {
    const aiClient = getSharedAIClient();

    const recordTypes = Array.isArray(cluster.record_types)
      ? cluster.record_types
      : JSON.parse(cluster.record_types);

    const notablePatterns = Array.isArray(cluster.notable_patterns)
      ? cluster.notable_patterns
      : JSON.parse(cluster.notable_patterns);

    const prompt = `Evaluate this frequently-requested record type for proactive publication:

Cluster Name: ${cluster.cluster_name}
Record Types: ${recordTypes.join(', ')}
Request Frequency (12 months): ${cluster.request_count_12mo}
Typical Requester: ${cluster.typical_requester_profile || 'Various'}
Notable Patterns: ${notablePatterns.join('; ')}

Should this be proactively published in the public reading room?`;

    const systemPrompt = `You are a government transparency advisor evaluating whether agencies should proactively publish frequently-requested records.

Consider:
- Frequency of requests (higher frequency = stronger case)
- Public interest value (newsworthy, affects many people)
- Likely exempt content percentage (less exempt content = easier to publish)
- FOIA's pro-disclosure presumption (err on side of transparency)
- Administrative burden reduction (deflecting future requests)

Return JSON:
{
  "should_publish": boolean,
  "recommended_record_types": ["type 1", "type 2"],
  "publish_format": "full" | "redacted_template" | "summary",
  "estimated_request_deflection_pct": 0-100,
  "justification": "clear reasoning for recommendation",
  "caveats": ["caveat 1", "caveat 2"]
}

ONLY return valid JSON. No prose before or after.`;

    const result = await aiClient.callWithAudit(
      {
        prompt,
        systemPrompt,
        maxTokens: 2000,
        temperature: 0.4,
        model: 'claude-3-5-sonnet-20241022'
      },
      'AI-11',
      tenant_id,
      undefined,
      {
        foia_request_id: '',
        score: 60,
        factors: {
          date_range_years: 1,
          agency_count: 1,
          estimated_volume: 'MEDIUM',
          requester_category: 'various',
          keyword_complexity: 60
        },
        calculated_at: new Date()
      }
    );

    // Parse AI response
    try {
      const jsonMatch = result.content.match(/```json\n([\s\S]*?)\n```/) ||
                       result.content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      } else {
        return JSON.parse(result.content);
      }
    } catch (error) {
      console.error('[ProactiveService] Failed to parse AI response:', error);
      throw new Error('Failed to parse AI proactive disclosure analysis');
    }
  }

  /**
   * Store proactive disclosure candidate
   */
  private async storeCandidate(
    tenant_id: string,
    cluster: any,
    analysis: ProactiveCandidateAnalysis
  ): Promise<void> {
    const publicInterestScore = analysis.should_publish ? 0.8 : 0.5;
    const estimatedAnnualRequests = Math.round(cluster.request_count_12mo * 1.1);

    await this.db.query(
      `INSERT INTO "FoiaProactiveCandidates" (
        id, tenant_id, pattern_cluster_id, cluster_name,
        should_publish, recommended_record_types, publish_format,
        frequency_score, estimated_request_deflection_pct, estimated_annual_requests,
        justification, caveats, public_interest_score,
        status, scan_date, model_used, confidence_score,
        "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PENDING', NOW(), $14, $15, NOW(), NOW())
      ON CONFLICT (tenant_id, cluster_name)
      DO UPDATE SET
        should_publish = $5,
        frequency_score = $8,
        estimated_request_deflection_pct = $9,
        justification = $11,
        scan_date = NOW(),
        "updatedAt" = NOW()`,
      [
        crypto.randomUUID(),
        tenant_id,
        cluster.id,
        cluster.cluster_name,
        analysis.should_publish,
        JSON.stringify(analysis.recommended_record_types),
        analysis.publish_format,
        cluster.request_count_12mo,
        analysis.estimated_request_deflection_pct,
        estimatedAnnualRequests,
        analysis.justification,
        JSON.stringify(analysis.caveats),
        publicInterestScore,
        'claude-3-5-sonnet-20241022',
        0.75
      ]
    );
  }

  /**
   * Get proactive disclosure candidates
   */
  async getCandidates(
    tenant_id: string,
    filters: GetProactiveCandidatesFilters = {}
  ): Promise<ProactiveCandidate[]> {
    let query = `SELECT * FROM "FoiaProactiveCandidates" WHERE tenant_id = $1`;
    const params: any[] = [tenant_id];
    let paramIndex = 2;

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.should_publish_only) {
      query += ` AND should_publish = true`;
    }

    if (filters.min_frequency_score) {
      query += ` AND frequency_score >= $${paramIndex}`;
      params.push(filters.min_frequency_score);
      paramIndex++;
    }

    query += ` ORDER BY frequency_score DESC, scan_date DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToCandidate(row));
  }

  /**
   * Make decision on proactive disclosure candidate
   */
  async makeDecision(
    tenant_id: string,
    candidate_id: string,
    user_id: string,
    decision: ProactiveCandidateDecisionInput
  ): Promise<ProactiveCandidate> {
    const candidate = await this.getCandidate(tenant_id, candidate_id);
    if (!candidate) {
      throw new Error('Candidate not found');
    }

    const newStatus = decision.decision === 'approve' ? 'APPROVED' : 'DISMISSED';

    await this.db.query(
      `UPDATE "FoiaProactiveCandidates"
       SET status = $1,
           decision_made_by = $2,
           decision_made_at = NOW(),
           dismissal_reason = $3,
           "updatedAt" = NOW()
       WHERE id = $4`,
      [newStatus, user_id, decision.dismissal_reason || decision.notes, candidate_id]
    );

    // Emit event
    await emit({
      id: crypto.randomUUID(),
      tenant_id,
      event_type: 'foia.ai.proactive.decision_made',
      entity_id: candidate_id,
      entity_type: 'proactive_candidate',
      user_id,
      metadata: {
        decision: decision.decision,
        cluster_name: candidate.cluster_name,
        was_approved: decision.decision === 'approve'
      },
      timestamp: new Date()
    });

    return this.getCandidate(tenant_id, candidate_id);
  }

  /**
   * Get reading room impact metrics
   */
  async getReadingRoomImpact(tenant_id: string): Promise<ProactiveImpactSummary> {
    // Get published candidates count
    const publishedResult = await this.db.query(
      `SELECT COUNT(*) as total
       FROM "FoiaProactiveCandidates"
       WHERE tenant_id = $1 AND status = 'PUBLISHED'`,
      [tenant_id]
    );

    // Get impact metrics for last 12 months
    const cutoff12mo = new Date();
    cutoff12mo.setMonth(cutoff12mo.getMonth() - 12);

    const impactResult = await this.db.query(
      `SELECT
        SUM(requests_deflected) as total_deflected,
        SUM(estimated_staff_hours_saved) as total_hours,
        SUM(estimated_cost_savings_usd) as total_savings
       FROM "FoiaProactiveImpact"
       WHERE tenant_id = $1 AND month_year >= $2`,
      [tenant_id, cutoff12mo]
    );

    // Get monthly breakdown
    const monthlyResult = await this.db.query(
      `SELECT
        TO_CHAR(month_year, 'YYYY-MM') as month,
        SUM(requests_deflected) as requests_deflected,
        SUM(estimated_staff_hours_saved) as staff_hours_saved,
        SUM(estimated_cost_savings_usd) as cost_savings
       FROM "FoiaProactiveImpact"
       WHERE tenant_id = $1 AND month_year >= $2
       GROUP BY month_year
       ORDER BY month_year DESC`,
      [tenant_id, cutoff12mo]
    );

    // Get top performing disclosures
    const topPerformersResult = await this.db.query(
      `SELECT
        c.id as candidate_id,
        c.cluster_name,
        c.published_at,
        SUM(i.requests_deflected) as requests_deflected
       FROM "FoiaProactiveCandidates" c
       JOIN "FoiaProactiveImpact" i ON i.candidate_id = c.id
       WHERE c.tenant_id = $1 AND c.status = 'PUBLISHED'
       GROUP BY c.id, c.cluster_name, c.published_at
       ORDER BY requests_deflected DESC
       LIMIT 5`,
      [tenant_id]
    );

    const impact = impactResult.rows[0];

    return {
      total_candidates_published: parseInt(publishedResult.rows[0].total) || 0,
      total_requests_deflected: parseInt(impact.total_deflected) || 0,
      total_staff_hours_saved: parseFloat(impact.total_hours) || 0,
      total_cost_savings_usd: parseFloat(impact.total_savings) || 0,
      monthly_breakdown: monthlyResult.rows.map(row => ({
        month: row.month,
        requests_deflected: parseInt(row.requests_deflected) || 0,
        staff_hours_saved: parseFloat(row.staff_hours_saved) || 0,
        cost_savings: parseFloat(row.cost_savings) || 0
      })),
      top_performing_disclosures: topPerformersResult.rows.map(row => ({
        candidate_id: row.candidate_id,
        cluster_name: row.cluster_name,
        requests_deflected: parseInt(row.requests_deflected) || 0,
        published_at: row.published_at
      }))
    };
  }

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(tenant_id: string): Promise<ProactiveDashboardMetrics> {
    const candidatesResult = await this.db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
        COUNT(*) FILTER (WHERE status = 'PUBLISHED') as published,
        MAX(scan_date) as last_scan
       FROM "FoiaProactiveCandidates"
       WHERE tenant_id = $1`,
      [tenant_id]
    );

    const cutoff12mo = new Date();
    cutoff12mo.setMonth(cutoff12mo.getMonth() - 12);

    const impactResult = await this.db.query(
      `SELECT
        SUM(requests_deflected) as deflected,
        SUM(estimated_staff_hours_saved) as hours_saved,
        SUM(estimated_cost_savings_usd) as cost_savings
       FROM "FoiaProactiveImpact"
       WHERE tenant_id = $1 AND month_year >= $2`,
      [tenant_id, cutoff12mo]
    );

    const candidates = candidatesResult.rows[0];
    const impact = impactResult.rows[0];

    return {
      pending_candidates: parseInt(candidates.pending) || 0,
      approved_candidates: parseInt(candidates.approved) || 0,
      published_disclosures: parseInt(candidates.published) || 0,
      total_requests_deflected_12mo: parseInt(impact.deflected) || 0,
      total_hours_saved_12mo: parseFloat(impact.hours_saved) || 0,
      total_cost_savings_12mo: parseFloat(impact.cost_savings) || 0,
      last_scan_date: candidates.last_scan || null
    };
  }

  // Helper methods

  private async getCandidate(tenant_id: string, candidate_id: string): Promise<ProactiveCandidate> {
    const result = await this.db.query(
      `SELECT * FROM "FoiaProactiveCandidates"
       WHERE tenant_id = $1 AND id = $2`,
      [tenant_id, candidate_id]
    );

    if (result.rows.length === 0) {
      throw new Error('Candidate not found');
    }

    return this.mapToCandidate(result.rows[0]);
  }

  private async completeJob(
    jobId: string,
    candidatesGenerated: number,
    startTime: number,
    errorMessage: string | null
  ): Promise<void> {
    const durationMs = Date.now() - startTime;
    await this.db.query(
      `UPDATE "FoiaPatternAnalysisJobs"
       SET status = $1,
           candidates_generated = $2,
           completed_at = NOW(),
           duration_ms = $3,
           error_message = $4
       WHERE id = $5`,
      [errorMessage ? 'FAILED' : 'COMPLETED', candidatesGenerated, durationMs, errorMessage, jobId]
    );
  }

  private async getJob(jobId: string): Promise<PatternAnalysisJob> {
    const result = await this.db.query(
      `SELECT * FROM "FoiaPatternAnalysisJobs" WHERE id = $1`,
      [jobId]
    );
    return result.rows[0];
  }

  private mapToCandidate(row: any): ProactiveCandidate {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      pattern_cluster_id: row.pattern_cluster_id,
      cluster_name: row.cluster_name,
      should_publish: row.should_publish,
      recommended_record_types: typeof row.recommended_record_types === 'string'
        ? JSON.parse(row.recommended_record_types)
        : row.recommended_record_types,
      publish_format: row.publish_format,
      frequency_score: row.frequency_score,
      estimated_request_deflection_pct: row.estimated_request_deflection_pct
        ? parseFloat(row.estimated_request_deflection_pct)
        : null,
      estimated_annual_requests: row.estimated_annual_requests,
      justification: row.justification,
      caveats: typeof row.caveats === 'string'
        ? JSON.parse(row.caveats)
        : row.caveats || [],
      public_interest_score: row.public_interest_score
        ? parseFloat(row.public_interest_score)
        : null,
      status: row.status,
      decision_made_by: row.decision_made_by,
      decision_made_at: row.decision_made_at,
      dismissal_reason: row.dismissal_reason,
      published_at: row.published_at,
      reading_room_url: row.reading_room_url,
      scan_date: row.scan_date,
      model_used: row.model_used,
      confidence_score: row.confidence_score
        ? parseFloat(row.confidence_score)
        : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}
