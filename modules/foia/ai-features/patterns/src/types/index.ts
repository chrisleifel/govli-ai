/**
 * AI-3: Cross-Request Pattern Intelligence & AI-11: Proactive Disclosure
 * Type Definitions
 */

// ============================================================================
// AI-3: Pattern Analysis Types
// ============================================================================

export type TrendDirection = 'INCREASING' | 'STABLE' | 'DECREASING';

export interface RequestPatternCluster {
  id: string;
  tenant_id: string;
  cluster_name: string;
  record_types: string[];
  department_most_likely: string | null;
  request_count_12mo: number;
  request_count_all_time: number;
  trend: TrendDirection;
  typical_requester_profile: string | null;
  notable_patterns: string[];
  request_ids: string[];
  analysis_date: Date;
  model_used: string;
  confidence_score: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatternClusterAnalysis {
  cluster_name: string;
  record_types: string[];
  department_most_likely: string;
  request_count_12mo: number;
  request_count_all_time: number;
  trend: TrendDirection;
  typical_requester_profile: string;
  notable_patterns: string[];
}

export interface RepeatRequester {
  id: string;
  tenant_id: string;
  requester_email: string;
  requester_name: string | null;
  request_count_12mo: number;
  similar_request_clusters: string[];
  request_ids: string[];
  pattern_description: string | null;
  proactive_outreach_recommended: boolean;
  proactive_outreach_reason: string | null;
  last_request_date: Date | null;
  first_request_date: Date | null;
  analysis_date: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type RoutingOptimizationStatus = 'PENDING' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED';

export interface RoutingOptimization {
  id: string;
  tenant_id: string;
  department: string;
  topic_cluster: string;
  avg_response_days: number;
  request_count: number;
  recommendation: string;
  recommended_department: string | null;
  expected_improvement_pct: number | null;
  status: RoutingOptimizationStatus;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  analysis_date: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// AI-11: Proactive Disclosure Types
// ============================================================================

export type PublishFormat = 'full' | 'redacted_template' | 'summary';
export type ProactiveCandidateStatus = 'PENDING' | 'APPROVED' | 'DISMISSED' | 'PUBLISHED';
export type TrackingMethod = 'MANUAL_LOG' | 'REFERRAL_LINK' | 'SURVEY' | 'ESTIMATED';

export interface ProactiveCandidate {
  id: string;
  tenant_id: string;
  pattern_cluster_id: string | null;
  cluster_name: string;
  should_publish: boolean;
  recommended_record_types: string[];
  publish_format: PublishFormat | null;
  frequency_score: number;
  estimated_request_deflection_pct: number | null;
  estimated_annual_requests: number | null;
  justification: string;
  caveats: string[];
  public_interest_score: number | null;
  status: ProactiveCandidateStatus;
  decision_made_by: string | null;
  decision_made_at: Date | null;
  dismissal_reason: string | null;
  published_at: Date | null;
  reading_room_url: string | null;
  scan_date: Date;
  model_used: string;
  confidence_score: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProactiveCandidateAnalysis {
  should_publish: boolean;
  recommended_record_types: string[];
  publish_format: PublishFormat;
  estimated_request_deflection_pct: number;
  justification: string;
  caveats: string[];
}

export interface ProactiveImpact {
  id: string;
  tenant_id: string;
  candidate_id: string;
  month_year: Date;
  requests_deflected: number;
  estimated_staff_hours_saved: number;
  estimated_cost_savings_usd: number;
  tracking_method: TrackingMethod;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProactiveImpactSummary {
  total_candidates_published: number;
  total_requests_deflected: number;
  total_staff_hours_saved: number;
  total_cost_savings_usd: number;
  monthly_breakdown: {
    month: string;
    requests_deflected: number;
    staff_hours_saved: number;
    cost_savings: number;
  }[];
  top_performing_disclosures: {
    candidate_id: string;
    cluster_name: string;
    requests_deflected: number;
    published_at: Date;
  }[];
}

// ============================================================================
// Job Tracking Types
// ============================================================================

export type PatternJobType = 'PATTERN_ANALYSIS' | 'PROACTIVE_SCAN';
export type PatternJobStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface PatternAnalysisJob {
  id: string;
  tenant_id: string;
  job_type: PatternJobType;
  status: PatternJobStatus;
  patterns_identified: number;
  candidates_generated: number;
  error_message: string | null;
  started_at: Date;
  completed_at: Date | null;
  duration_ms: number | null;
  createdAt: Date;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface AnalyzePatternsInput {
  lookback_months?: number; // Default: 24
  min_cluster_size?: number; // Minimum requests in a cluster
}

export interface ScanProactiveInput {
  frequency_threshold?: number; // Minimum frequency score
  lookback_months?: number; // Default: 12
}

export interface ProactiveCandidateDecisionInput {
  decision: 'approve' | 'dismiss';
  notes?: string;
  dismissal_reason?: string;
}

export interface GetClustersFilters {
  department?: string;
  trend?: TrendDirection;
  min_request_count?: number;
  start_date?: Date;
  end_date?: Date;
}

export interface GetProactiveCandidatesFilters {
  department?: string;
  status?: ProactiveCandidateStatus;
  should_publish_only?: boolean;
  min_frequency_score?: number;
}

export interface PatternDashboardMetrics {
  total_clusters: number;
  increasing_trends: number;
  decreasing_trends: number;
  repeat_requesters_count: number;
  routing_optimizations_pending: number;
  last_analysis_date: Date | null;
}

export interface ProactiveDashboardMetrics {
  pending_candidates: number;
  approved_candidates: number;
  published_disclosures: number;
  total_requests_deflected_12mo: number;
  total_hours_saved_12mo: number;
  total_cost_savings_12mo: number;
  last_scan_date: Date | null;
}
