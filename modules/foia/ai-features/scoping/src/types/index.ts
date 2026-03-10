/**
 * AI-1: Intelligent Request Scoping - Type Definitions
 */

export type EstimatedComplexity = 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'VERY_COMPLEX';

export type ScopingFlagType =
  | 'TOO_BROAD'
  | 'LACKS_TIME_FRAME'
  | 'VAGUE_KEYWORDS'
  | 'MULTIPLE_UNRELATED_TOPICS'
  | 'MISSING_AGENCY_SPECIFICATION'
  | 'UNREASONABLE_VOLUME'
  | 'NEEDS_FORMAT_CLARIFICATION'
  | 'PRIVACY_CONCERNS';

export interface ScopingFlag {
  type: ScopingFlagType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export interface ScopingAnalysisResult {
  scoping_flags: ScopingFlag[];
  overall_quality: number; // 0-100
  is_well_scoped: boolean;
  suggested_clarification: string | null;
  narrowing_suggestions: string[];
  estimated_complexity: EstimatedComplexity;
  reasoning: string;
}

export interface ScopingAnalysis {
  id: string;
  foia_request_id: string;
  tenant_id: string;

  // AI Analysis
  overall_quality: number;
  is_well_scoped: boolean;
  estimated_complexity: EstimatedComplexity;
  scoping_flags: ScopingFlag[];
  suggested_clarification: string | null;
  narrowing_suggestions: string[];
  reasoning: string;

  // AI Metadata
  model_used: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;

  // Coordinator Action
  coordinator_action?: 'APPROVED' | 'EDITED' | 'SENT' | 'IGNORED';
  coordinator_id?: string;
  coordinator_action_at?: Date;
  edited_clarification?: string;

  // Tracking
  clarification_sent: boolean;
  clarification_sent_at?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyzeRequestInput {
  foia_request_id: string;
  description: string;
  request_type?: string;
  requester_category: string;
  agencies_requested: string[];
  date_range_start?: string;
  date_range_end?: string;
}

export interface SendClarificationInput {
  message_text: string;
  send_immediately: boolean;
}

export interface ScopingMetrics {
  id: string;
  foia_request_id: string;
  tenant_id: string;

  // A/B Testing
  scoping_assist_used: boolean;
  clarification_needed: boolean;
  clarification_rounds: number;

  // Outcome Metrics
  time_to_clarification_hours?: number;
  time_to_completion_hours?: number;
  final_quality_score?: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardMetrics {
  avg_quality_score: number;
  total_analyses: number;
  well_scoped_percentage: number;
  clarifications_sent: number;
  avg_complexity: EstimatedComplexity;
  flag_distribution: Record<ScopingFlagType, number>;
  weekly_trends: {
    week: string;
    avg_quality: number;
    analyses_count: number;
  }[];
}

export interface ABTestingResults {
  with_assist: {
    avg_clarification_rate: number;
    avg_time_to_completion: number;
    avg_quality_score: number;
    sample_size: number;
  };
  without_assist: {
    avg_clarification_rate: number;
    avg_time_to_completion: number;
    avg_quality_score: number;
    sample_size: number;
  };
  improvement_percentage: number;
}
