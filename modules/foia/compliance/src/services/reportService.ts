/**
 * FOIA Report Generation Service
 * Generates DOJ annual reports and SLA summaries
 */

import { Pool } from 'pg';
import { AnnualReport, SLASummary } from '../types';

/**
 * Report Service
 */
export class ReportService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Generate DOJ Annual Report
   * Format compliant with Department of Justice FOIA reporting requirements
   */
  async generateAnnualReport(tenant_id: string, year: number): Promise<AnnualReport> {
    const start_date = new Date(`${year}-01-01`);
    const end_date = new Date(`${year}-12-31 23:59:59`);

    // Requests received this year
    const receivedResult = await this.db.query(
      `SELECT COUNT(*) as count
       FROM foia_requests
       WHERE tenant_id = $1
         AND received_at >= $2
         AND received_at <= $3`,
      [tenant_id, start_date, end_date]
    );

    const requests_received = parseInt(receivedResult.rows[0].count);

    // Requests carried forward from previous year
    const carriedResult = await this.db.query(
      `SELECT COUNT(*) as count
       FROM foia_requests
       WHERE tenant_id = $1
         AND received_at < $2
         AND status NOT IN ('COMPLETED', 'DENIED')`,
      [tenant_id, start_date]
    );

    const requests_carried_forward = parseInt(carriedResult.rows[0].count);

    // Requests processed (completed or denied) this year
    const processedResult = await this.db.query(
      `SELECT
        COUNT(*) FILTER (WHERE status IN ('COMPLETED', 'DENIED')) as processed,
        COUNT(*) FILTER (WHERE status = 'COMPLETED') as granted_full,
        COUNT(*) FILTER (WHERE status = 'DENIED') as denied_full
       FROM foia_requests
       WHERE tenant_id = $1
         AND updated_at >= $2
         AND updated_at <= $3
         AND status IN ('COMPLETED', 'DENIED')`,
      [tenant_id, start_date, end_date]
    );

    const requests_processed = parseInt(processedResult.rows[0].processed || '0');
    const requests_granted_full = parseInt(processedResult.rows[0].granted_full || '0');
    const requests_denied_full = parseInt(processedResult.rows[0].denied_full || '0');

    // Get response-based metrics
    const responseResult = await this.db.query(
      `SELECT
        COUNT(*) FILTER (WHERE response_type = 'PARTIAL_GRANT') as partial_grant,
        COUNT(*) FILTER (WHERE response_type = 'NO_RESPONSIVE_RECORDS') as no_records
       FROM foia_responses
       WHERE tenant_id = $1
         AND delivered_at >= $2
         AND delivered_at <= $3`,
      [tenant_id, start_date, end_date]
    );

    const requests_granted_partial = parseInt(responseResult.rows[0].partial_grant || '0');
    const requests_no_records = parseInt(responseResult.rows[0].no_records || '0');

    // Timeliness metrics (median days to completion)
    const timelinessResult = await this.db.query(
      `SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
          EXTRACT(DAY FROM (updated_at - received_at))
        ) FILTER (WHERE complexity = 'SIMPLE') as simple_median,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
          EXTRACT(DAY FROM (updated_at - received_at))
        ) FILTER (WHERE complexity = 'COMPLEX') as complex_median,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
          EXTRACT(DAY FROM (updated_at - received_at))
        ) FILTER (WHERE priority = 'EXPEDITED') as expedited_median
       FROM foia_requests
       WHERE tenant_id = $1
         AND updated_at >= $2
         AND updated_at <= $3
         AND status IN ('COMPLETED', 'DENIED')`,
      [tenant_id, start_date, end_date]
    );

    const simple_median_days = Math.round(parseFloat(timelinessResult.rows[0].simple_median || '0'));
    const complex_median_days = Math.round(parseFloat(timelinessResult.rows[0].complex_median || '0'));
    const expedited_median_days = Math.round(parseFloat(timelinessResult.rows[0].expedited_median || '0'));

    // Backlog (pending requests at end of year)
    const backlogResult = await this.db.query(
      `SELECT COUNT(*) as count
       FROM foia_requests
       WHERE tenant_id = $1
         AND received_at <= $2
         AND status NOT IN ('COMPLETED', 'DENIED')`,
      [tenant_id, end_date]
    );

    const backlog_count = parseInt(backlogResult.rows[0].count);

    // Appeals
    const appealsResult = await this.db.query(
      `SELECT
        COUNT(*) FILTER (WHERE created_at >= $2 AND created_at <= $3) as received,
        COUNT(*) FILTER (WHERE resolved_at >= $2 AND resolved_at <= $3) as processed,
        COUNT(*) FILTER (WHERE resolved_at >= $2 AND resolved_at <= $3 AND status = 'GRANTED') as granted,
        COUNT(*) FILTER (WHERE resolved_at >= $2 AND resolved_at <= $3 AND status = 'DENIED') as denied
       FROM foia_appeals
       WHERE tenant_id = $1`,
      [tenant_id, start_date, end_date]
    );

    const appeals_received = parseInt(appealsResult.rows[0].received || '0');
    const appeals_processed = parseInt(appealsResult.rows[0].processed || '0');
    const appeals_granted = parseInt(appealsResult.rows[0].granted || '0');
    const appeals_denied = parseInt(appealsResult.rows[0].denied || '0');

    // Fees
    const feesResult = await this.db.query(
      `SELECT
        SUM(fee_amount) FILTER (WHERE delivered_at >= $2 AND delivered_at <= $3) as total_fees,
        COUNT(*) FILTER (WHERE delivered_at >= $2 AND delivered_at <= $3 AND fee_amount > 0) as fee_waivers
       FROM foia_responses
       WHERE tenant_id = $1`,
      [tenant_id, start_date, end_date]
    );

    const total_fees_collected = parseFloat(feesResult.rows[0].total_fees || '0');
    const fee_waivers_granted = parseInt(feesResult.rows[0].fee_waivers || '0');

    // Exemptions breakdown (count by exemption type)
    const exemptionsResult = await this.db.query(
      `SELECT exemptions_cited
       FROM foia_responses
       WHERE tenant_id = $1
         AND delivered_at >= $2
         AND delivered_at <= $3
         AND exemptions_cited IS NOT NULL`,
      [tenant_id, start_date, end_date]
    );

    const exemptions_breakdown: Record<string, number> = {};
    exemptionsResult.rows.forEach(row => {
      const exemptions = Array.isArray(row.exemptions_cited)
        ? row.exemptions_cited
        : JSON.parse(row.exemptions_cited || '[]');

      exemptions.forEach((ex: string) => {
        exemptions_breakdown[ex] = (exemptions_breakdown[ex] || 0) + 1;
      });
    });

    return {
      year,
      tenant_id,
      requests_received,
      requests_carried_forward,
      requests_processed,
      requests_granted_full,
      requests_granted_partial,
      requests_denied_full,
      requests_no_records,
      simple_median_days,
      complex_median_days,
      expedited_median_days,
      backlog_count,
      appeals_received,
      appeals_processed,
      appeals_granted,
      appeals_denied,
      total_fees_collected,
      fee_waivers_granted,
      exemptions_breakdown,
      generated_at: new Date()
    };
  }

  /**
   * Generate SLA Summary
   */
  async generateSLASummary(
    tenant_id: string,
    period_start: Date,
    period_end: Date
  ): Promise<SLASummary> {
    // Total requests in period
    const totalResult = await this.db.query(
      `SELECT COUNT(*) as count
       FROM foia_requests
       WHERE tenant_id = $1
         AND received_at >= $2
         AND received_at <= $3`,
      [tenant_id, period_start, period_end]
    );

    const total_requests = parseInt(totalResult.rows[0].count);

    // On-time vs overdue completion
    const completionResult = await this.db.query(
      `SELECT
        COUNT(*) FILTER (WHERE updated_at <= due_date) as on_time,
        COUNT(*) FILTER (WHERE updated_at > due_date) as overdue,
        AVG(EXTRACT(DAY FROM (updated_at - received_at))) as avg_days
       FROM foia_requests
       WHERE tenant_id = $1
         AND received_at >= $2
         AND received_at <= $3
         AND status IN ('COMPLETED', 'DENIED')
         AND due_date IS NOT NULL`,
      [tenant_id, period_start, period_end]
    );

    const on_time_completion = parseInt(completionResult.rows[0].on_time || '0');
    const overdue_completion = parseInt(completionResult.rows[0].overdue || '0');
    const average_response_days = Math.round(parseFloat(completionResult.rows[0].avg_days || '0'));

    const compliance_rate = total_requests > 0
      ? Math.round((on_time_completion / total_requests) * 100)
      : 0;

    // By complexity
    const complexityResult = await this.db.query(
      `SELECT
        complexity,
        COUNT(*) as count,
        AVG(EXTRACT(DAY FROM (updated_at - received_at))) as avg_days
       FROM foia_requests
       WHERE tenant_id = $1
         AND received_at >= $2
         AND received_at <= $3
         AND status IN ('COMPLETED', 'DENIED')
       GROUP BY complexity`,
      [tenant_id, period_start, period_end]
    );

    const by_complexity = {
      simple: { count: 0, avg_days: 0 },
      complex: { count: 0, avg_days: 0 },
      expedited: { count: 0, avg_days: 0 }
    };

    complexityResult.rows.forEach(row => {
      const key = row.complexity?.toLowerCase() || 'simple';
      if (key in by_complexity) {
        by_complexity[key as keyof typeof by_complexity] = {
          count: parseInt(row.count),
          avg_days: Math.round(parseFloat(row.avg_days || '0'))
        };
      }
    });

    return {
      tenant_id,
      period_start,
      period_end,
      total_requests,
      on_time_completion,
      overdue_completion,
      compliance_rate,
      average_response_days,
      by_complexity,
      generated_at: new Date()
    };
  }
}
