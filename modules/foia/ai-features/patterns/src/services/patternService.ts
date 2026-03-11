/**
 * AI-3: Cross-Request Pattern Intelligence - Pattern Analysis Service
 * Uses shared AI client - never instantiate Anthropic directly
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { getSharedAIClient, emit } from '@govli/foia-shared';
import {
  RequestPatternCluster,
  PatternClusterAnalysis,
  RepeatRequester,
  RoutingOptimization,
  AnalyzePatternsInput,
  GetClustersFilters,
  PatternDashboardMetrics,
  PatternAnalysisJob
} from '../types';

export class PatternService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Run pattern analysis on historical requests
   * This is typically run nightly via cron
   */
  async analyzePatterns(
    tenant_id: string,
    input: AnalyzePatternsInput = {}
  ): Promise<PatternAnalysisJob> {
    const jobId = crypto.randomUUID();
    const startTime = Date.now();

    // Create job record
    await this.db.query(
      `INSERT INTO "FoiaPatternAnalysisJobs" (
        id, tenant_id, job_type, status, started_at, "createdAt"
      ) VALUES ($1, $2, 'PATTERN_ANALYSIS', 'RUNNING', NOW(), NOW())`,
      [jobId, tenant_id]
    );

    try {
      const lookbackMonths = input.lookback_months || 24;
      const minClusterSize = input.min_cluster_size || 3;

      // Fetch closed requests from last N months
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - lookbackMonths);

      const requestsResult = await this.db.query(
        `SELECT id, description, requester_email, requester_name,
                department, status, "createdAt"
         FROM "FoiaRequests"
         WHERE tenant_id = $1
           AND status IN ('CLOSED', 'FULFILLED', 'PARTIALLY_FULFILLED')
           AND "createdAt" >= $2
         ORDER BY "createdAt" DESC`,
        [tenant_id, cutoffDate]
      );

      const requests = requestsResult.rows;

      if (requests.length === 0) {
        // Complete job with no patterns
        await this.completeJob(jobId, 0, startTime, null);
        return this.getJob(jobId);
      }

      // Build prompt for Claude to analyze patterns
      const clusters = await this.clusterRequests(tenant_id, requests);

      // Store clusters in database
      let patternsIdentified = 0;
      for (const cluster of clusters) {
        if (cluster.request_count_all_time >= minClusterSize) {
          await this.storeCluster(tenant_id, cluster, requests);
          patternsIdentified++;
        }
      }

      // Identify repeat requesters
      await this.identifyRepeatRequesters(tenant_id, requests);

      // Analyze routing optimizations
      await this.analyzeRoutingOptimizations(tenant_id);

      // Complete job
      await this.completeJob(jobId, patternsIdentified, startTime, null);

      // Emit event
      await emit({
        id: crypto.randomUUID(),
        tenant_id,
        event_type: 'foia.ai.patterns.analyzed',
        entity_id: jobId,
        entity_type: 'pattern_job',
        metadata: {
          patterns_identified: patternsIdentified,
          lookback_months: lookbackMonths,
          request_count: requests.length
        },
        timestamp: new Date()
      });

      return this.getJob(jobId);
    } catch (error: any) {
      console.error('[PatternService] Analysis failed:', error);
      await this.completeJob(jobId, 0, startTime, error.message);
      throw error;
    }
  }

  /**
   * Use AI to cluster requests by topic
   */
  private async clusterRequests(
    tenant_id: string,
    requests: any[]
  ): Promise<PatternClusterAnalysis[]> {
    const aiClient = getSharedAIClient();

    // Build prompt with request descriptions
    const requestSummaries = requests.map((r, idx) =>
      `${idx + 1}. ${r.description.substring(0, 200)}`
    ).join('\n');

    const prompt = `Analyze these FOIA request descriptions and identify recurring topic clusters:\n\n${requestSummaries}`;

    const systemPrompt = `You are a FOIA request analyst identifying patterns across multiple requests.

Analyze the list of FOIA request descriptions and identify recurring topic clusters.

For each cluster, return:
{
  "cluster_name": "brief descriptive name",
  "record_types": ["type 1", "type 2"],
  "department_most_likely": "department name",
  "request_count_12mo": number,
  "request_count_all_time": number,
  "trend": "INCREASING" | "STABLE" | "DECREASING",
  "typical_requester_profile": "description of typical requester",
  "notable_patterns": ["pattern 1", "pattern 2"]
}

Return a JSON array of clusters. Consider:
- Similar record types requested
- Common topics or subject matter
- Recurring keywords or themes
- Seasonal patterns (if evident from context)

ONLY return valid JSON array. No prose before or after.`;

    const result = await aiClient.callWithAudit(
      {
        prompt,
        systemPrompt,
        maxTokens: 4000,
        temperature: 0.3,
        model: 'claude-3-5-sonnet-20241022'
      },
      'AI-3',
      tenant_id,
      undefined,
      {
        foia_request_id: '',
        score: 70,
        factors: {
          date_range_years: 2,
          agency_count: 1,
          estimated_volume: 'HIGH',
          requester_category: 'various',
          keyword_complexity: 70
        },
        calculated_at: new Date()
      }
    );

    // Parse AI response
    try {
      const jsonMatch = result.content.match(/```json\n([\s\S]*?)\n```/) ||
                       result.content.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      } else {
        return JSON.parse(result.content);
      }
    } catch (error) {
      console.error('[PatternService] Failed to parse AI response:', error);
      throw new Error('Failed to parse AI pattern analysis');
    }
  }

  /**
   * Store cluster in database with request IDs
   */
  private async storeCluster(
    tenant_id: string,
    cluster: PatternClusterAnalysis,
    requests: any[]
  ): Promise<void> {
    // Match requests to this cluster (simple keyword matching)
    const clusterKeywords = this.extractKeywords(cluster.cluster_name);
    const matchedRequestIds = requests
      .filter(r => {
        const desc = r.description.toLowerCase();
        return clusterKeywords.some(kw => desc.includes(kw.toLowerCase()));
      })
      .map(r => r.id);

    // Calculate 12-month count
    const cutoff12mo = new Date();
    cutoff12mo.setMonth(cutoff12mo.getMonth() - 12);
    const count12mo = requests.filter(r =>
      matchedRequestIds.includes(r.id) &&
      new Date(r.createdAt) >= cutoff12mo
    ).length;

    await this.db.query(
      `INSERT INTO "FoiaRequestPatterns" (
        id, tenant_id, cluster_name, record_types, department_most_likely,
        request_count_12mo, request_count_all_time, trend,
        typical_requester_profile, notable_patterns, request_ids,
        analysis_date, model_used, confidence_score, "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13, NOW(), NOW())
      ON CONFLICT (tenant_id, cluster_name)
      DO UPDATE SET
        request_count_12mo = $6,
        request_count_all_time = $7,
        trend = $8,
        request_ids = $11,
        analysis_date = NOW(),
        "updatedAt" = NOW()`,
      [
        crypto.randomUUID(),
        tenant_id,
        cluster.cluster_name,
        JSON.stringify(cluster.record_types),
        cluster.department_most_likely,
        count12mo,
        matchedRequestIds.length,
        cluster.trend,
        cluster.typical_requester_profile,
        JSON.stringify(cluster.notable_patterns),
        JSON.stringify(matchedRequestIds),
        'claude-3-5-sonnet-20241022',
        0.75
      ]
    );
  }

  /**
   * Identify requesters with 3+ similar requests in 12 months
   */
  private async identifyRepeatRequesters(
    tenant_id: string,
    requests: any[]
  ): Promise<void> {
    const cutoff12mo = new Date();
    cutoff12mo.setMonth(cutoff12mo.getMonth() - 12);

    // Group by requester email
    const requesterGroups: Record<string, any[]> = {};
    requests.forEach(r => {
      if (r.requester_email) {
        if (!requesterGroups[r.requester_email]) {
          requesterGroups[r.requester_email] = [];
        }
        requesterGroups[r.requester_email].push(r);
      }
    });

    // Find repeat requesters
    for (const [email, requesterRequests] of Object.entries(requesterGroups)) {
      const recent = requesterRequests.filter(r =>
        new Date(r.createdAt) >= cutoff12mo
      );

      if (recent.length >= 3) {
        const requestIds = requesterRequests.map(r => r.id);
        const firstRequest = requesterRequests[requesterRequests.length - 1];
        const lastRequest = requesterRequests[0];

        await this.db.query(
          `INSERT INTO "FoiaRepeatRequesters" (
            id, tenant_id, requester_email, requester_name,
            request_count_12mo, request_ids,
            pattern_description, proactive_outreach_recommended,
            first_request_date, last_request_date, analysis_date,
            "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), NOW())
          ON CONFLICT (tenant_id, requester_email)
          DO UPDATE SET
            request_count_12mo = $5,
            request_ids = $6,
            last_request_date = $10,
            analysis_date = NOW(),
            "updatedAt" = NOW()`,
          [
            crypto.randomUUID(),
            tenant_id,
            email,
            firstRequest.requester_name,
            recent.length,
            JSON.stringify(requestIds),
            `Filed ${recent.length} requests in the last 12 months`,
            recent.length >= 5, // Recommend outreach if 5+ requests
            firstRequest.createdAt,
            lastRequest.createdAt
          ]
        );
      }
    }
  }

  /**
   * Analyze routing optimizations based on department performance
   */
  private async analyzeRoutingOptimizations(tenant_id: string): Promise<void> {
    // Get average response times by department and topic
    const performanceResult = await this.db.query(
      `SELECT
        fr.department,
        COUNT(*) as request_count,
        AVG(EXTRACT(EPOCH FROM (fr."updatedAt" - fr."createdAt")) / 86400) as avg_days
       FROM "FoiaRequests" fr
       WHERE fr.tenant_id = $1
         AND fr.status IN ('CLOSED', 'FULFILLED')
         AND fr.department IS NOT NULL
       GROUP BY fr.department
       HAVING COUNT(*) >= 5
       ORDER BY avg_days DESC`,
      [tenant_id]
    );

    // Create optimization recommendations for slow departments
    for (const row of performanceResult.rows) {
      if (row.avg_days > 20) { // Threshold: 20 days
        await this.db.query(
          `INSERT INTO "FoiaRoutingOptimizations" (
            id, tenant_id, department, topic_cluster,
            avg_response_days, request_count, recommendation,
            status, analysis_date, "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', NOW(), NOW(), NOW())`,
          [
            crypto.randomUUID(),
            tenant_id,
            row.department,
            'General',
            parseFloat(row.avg_days),
            parseInt(row.request_count),
            `Department shows avg response time of ${Math.round(row.avg_days)} days. Consider reviewing workload distribution or providing additional training.`
          ]
        );
      }
    }
  }

  /**
   * Get pattern clusters with filtering
   */
  async getClusters(
    tenant_id: string,
    filters: GetClustersFilters = {}
  ): Promise<RequestPatternCluster[]> {
    let query = `SELECT * FROM "FoiaRequestPatterns" WHERE tenant_id = $1`;
    const params: any[] = [tenant_id];
    let paramIndex = 2;

    if (filters.department) {
      query += ` AND department_most_likely = $${paramIndex}`;
      params.push(filters.department);
      paramIndex++;
    }

    if (filters.trend) {
      query += ` AND trend = $${paramIndex}`;
      params.push(filters.trend);
      paramIndex++;
    }

    if (filters.min_request_count) {
      query += ` AND request_count_12mo >= $${paramIndex}`;
      params.push(filters.min_request_count);
      paramIndex++;
    }

    query += ` ORDER BY request_count_12mo DESC`;

    const result = await this.db.query(query, params);
    return result.rows.map(row => this.mapToCluster(row));
  }

  /**
   * Get repeat requesters
   */
  async getRepeatRequesters(tenant_id: string): Promise<RepeatRequester[]> {
    const result = await this.db.query(
      `SELECT * FROM "FoiaRepeatRequesters"
       WHERE tenant_id = $1
       ORDER BY request_count_12mo DESC`,
      [tenant_id]
    );

    return result.rows.map(row => this.mapToRepeatRequester(row));
  }

  /**
   * Get routing optimizations
   */
  async getRoutingOptimizations(tenant_id: string): Promise<RoutingOptimization[]> {
    const result = await this.db.query(
      `SELECT * FROM "FoiaRoutingOptimizations"
       WHERE tenant_id = $1
       ORDER BY avg_response_days DESC`,
      [tenant_id]
    );

    return result.rows.map(row => this.mapToRoutingOptimization(row));
  }

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(tenant_id: string): Promise<PatternDashboardMetrics> {
    const clustersResult = await this.db.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN trend = 'INCREASING' THEN 1 ELSE 0 END) as increasing,
              SUM(CASE WHEN trend = 'DECREASING' THEN 1 ELSE 0 END) as decreasing,
              MAX(analysis_date) as last_analysis
       FROM "FoiaRequestPatterns"
       WHERE tenant_id = $1`,
      [tenant_id]
    );

    const repeatersResult = await this.db.query(
      `SELECT COUNT(*) as total
       FROM "FoiaRepeatRequesters"
       WHERE tenant_id = $1`,
      [tenant_id]
    );

    const routingResult = await this.db.query(
      `SELECT COUNT(*) as total
       FROM "FoiaRoutingOptimizations"
       WHERE tenant_id = $1 AND status = 'PENDING'`,
      [tenant_id]
    );

    const clusters = clustersResult.rows[0];

    return {
      total_clusters: parseInt(clusters.total) || 0,
      increasing_trends: parseInt(clusters.increasing) || 0,
      decreasing_trends: parseInt(clusters.decreasing) || 0,
      repeat_requesters_count: parseInt(repeatersResult.rows[0].total) || 0,
      routing_optimizations_pending: parseInt(routingResult.rows[0].total) || 0,
      last_analysis_date: clusters.last_analysis || null
    };
  }

  // Helper methods

  private async completeJob(
    jobId: string,
    patternsIdentified: number,
    startTime: number,
    errorMessage: string | null
  ): Promise<void> {
    const durationMs = Date.now() - startTime;
    await this.db.query(
      `UPDATE "FoiaPatternAnalysisJobs"
       SET status = $1,
           patterns_identified = $2,
           completed_at = NOW(),
           duration_ms = $3,
           error_message = $4
       WHERE id = $5`,
      [errorMessage ? 'FAILED' : 'COMPLETED', patternsIdentified, durationMs, errorMessage, jobId]
    );
  }

  private async getJob(jobId: string): Promise<PatternAnalysisJob> {
    const result = await this.db.query(
      `SELECT * FROM "FoiaPatternAnalysisJobs" WHERE id = $1`,
      [jobId]
    );
    return result.rows[0];
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - remove common words
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.includes(word));
  }

  private mapToCluster(row: any): RequestPatternCluster {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      cluster_name: row.cluster_name,
      record_types: typeof row.record_types === 'string'
        ? JSON.parse(row.record_types)
        : row.record_types,
      department_most_likely: row.department_most_likely,
      request_count_12mo: row.request_count_12mo,
      request_count_all_time: row.request_count_all_time,
      trend: row.trend,
      typical_requester_profile: row.typical_requester_profile,
      notable_patterns: typeof row.notable_patterns === 'string'
        ? JSON.parse(row.notable_patterns)
        : row.notable_patterns,
      request_ids: typeof row.request_ids === 'string'
        ? JSON.parse(row.request_ids)
        : row.request_ids,
      analysis_date: row.analysis_date,
      model_used: row.model_used,
      confidence_score: parseFloat(row.confidence_score),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  private mapToRepeatRequester(row: any): RepeatRequester {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      requester_email: row.requester_email,
      requester_name: row.requester_name,
      request_count_12mo: row.request_count_12mo,
      similar_request_clusters: typeof row.similar_request_clusters === 'string'
        ? JSON.parse(row.similar_request_clusters)
        : row.similar_request_clusters || [],
      request_ids: typeof row.request_ids === 'string'
        ? JSON.parse(row.request_ids)
        : row.request_ids,
      pattern_description: row.pattern_description,
      proactive_outreach_recommended: row.proactive_outreach_recommended,
      proactive_outreach_reason: row.proactive_outreach_reason,
      last_request_date: row.last_request_date,
      first_request_date: row.first_request_date,
      analysis_date: row.analysis_date,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  private mapToRoutingOptimization(row: any): RoutingOptimization {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      department: row.department,
      topic_cluster: row.topic_cluster,
      avg_response_days: parseFloat(row.avg_response_days),
      request_count: row.request_count,
      recommendation: row.recommendation,
      recommended_department: row.recommended_department,
      expected_improvement_pct: row.expected_improvement_pct
        ? parseFloat(row.expected_improvement_pct)
        : null,
      status: row.status,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      review_notes: row.review_notes,
      analysis_date: row.analysis_date,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}
