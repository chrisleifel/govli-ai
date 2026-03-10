/**
 * AI-2: Autonomous Document Triage - Type Definitions
 */

// Document Classification Types
export type DocumentClassification =
  | 'LIKELY_RESPONSIVE'
  | 'LIKELY_EXEMPT'
  | 'PARTIALLY_RESPONSIVE'
  | 'NOT_RESPONSIVE'
  | 'NEEDS_REVIEW'
  | 'SENSITIVE_CONTENT';

export type RedactionEffort = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTENSIVE';

export type OverrideCategory =
  | 'AI_ERROR'
  | 'POLICY_DECISION'
  | 'LEGAL_REVIEW'
  | 'CONTEXT_MISSING'
  | 'EXEMPTION_CHANGE'
  | 'OTHER';

export type TriageBatchStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

// Exemption Suggestion
export interface ExemptionSuggestion {
  code: string; // e.g., "5 U.S.C. § 552(b)(5)"
  category: string; // e.g., "Deliberative Process Privilege"
  reasoning: string;
  confidence: number; // 0-1
  affected_pages?: number[];
}

// Sensitivity Flag
export interface SensitivityFlag {
  type: 'PII' | 'SSN' | 'CONFIDENTIAL' | 'PROPRIETARY' | 'LAW_ENFORCEMENT' | 'MEDICAL' | 'FINANCIAL';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  locations?: string[]; // Page references
}

// Redaction Suggestion
export interface RedactionSuggestion {
  page: number;
  region?: string; // Description of location on page
  content_preview?: string; // First few chars of redacted content
  reason: string;
  exemption_code?: string;
}

// Key Finding
export interface KeyFinding {
  type: 'KEYWORD' | 'DATE' | 'PERSON' | 'TOPIC' | 'ENTITY';
  content: string;
  relevance: 'HIGH' | 'MEDIUM' | 'LOW';
  page?: number;
}

// AI Triage Analysis Result (from AI response)
export interface TriageAnalysisResult {
  classification: DocumentClassification;
  confidence_score: number; // 0-1
  reasoning: string;
  key_findings: KeyFinding[];
  sensitivity_flags: SensitivityFlag[];
  suggested_exemptions: ExemptionSuggestion[];
  suggested_redactions: RedactionSuggestion[];
  estimated_redaction_effort: RedactionEffort;
  processing_notes?: string;
}

// Document Triage Result (stored in database)
export interface DocumentTriageResult {
  id: string;
  foia_request_id: string;
  document_id: string;
  tenant_id: string;

  // AI Classification
  classification: DocumentClassification;
  confidence_score: number;
  reasoning: string;
  key_findings: KeyFinding[];
  sensitivity_flags: SensitivityFlag[];
  suggested_exemptions: ExemptionSuggestion[];
  suggested_redactions: RedactionSuggestion[];
  estimated_redaction_effort: RedactionEffort;

  // AI Metadata
  model_used: string;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;

  // Human Review
  reviewed_by?: string;
  reviewed_at?: Date;
  final_classification?: string;
  override_reason?: string;

  createdAt: Date;
  updatedAt: Date;
}

// Triage Override
export interface DocumentTriageOverride {
  id: string;
  triage_result_id: string;
  foia_request_id: string;
  document_id: string;
  tenant_id: string;

  ai_classification: DocumentClassification;
  human_classification: string;
  override_reason: string;
  override_category: OverrideCategory;

  overridden_by: string;
  overridden_at: Date;

  ai_confidence: number;
  feedback_for_training: boolean;

  createdAt: Date;
}

// Triage Batch Run
export interface TriageBatchRun {
  id: string;
  foia_request_id: string;
  tenant_id: string;

  document_count: number;
  completed_count: number;
  failed_count: number;

  status: TriageBatchStatus;

  avg_confidence?: number;
  responsive_count: number;
  exempt_count: number;
  needs_review_count: number;

  started_at?: Date;
  completed_at?: Date;
  total_duration_ms?: number;

  error_message?: string;
  started_by?: string;

  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response Types

export interface TriageDocumentInput {
  document_id: string;
  document_content?: string; // Optional: pre-extracted text
  document_url?: string; // Optional: URL to fetch document
  document_metadata?: {
    filename: string;
    file_type: string;
    page_count?: number;
    file_size?: number;
  };
}

export interface RunTriageInput {
  document_ids?: string[]; // Specific documents, or omit to triage all untriaged docs
  force_retriage?: boolean; // Re-run even if already triaged
}

export interface TriageOverrideInput {
  document_id: string;
  human_classification: string;
  override_reason: string;
  override_category: OverrideCategory;
  feedback_for_training?: boolean;
}

export interface TriageSummaryStats {
  total_documents: number;
  triaged_documents: number;
  pending_documents: number;

  classification_breakdown: Record<DocumentClassification, number>;
  avg_confidence: number;

  high_confidence_count: number; // > 0.8
  low_confidence_count: number; // < 0.5

  documents_needing_review: number;
  sensitive_documents: number;

  override_count: number;
  override_rate: number; // percentage
}

export interface TriageDashboardMetrics {
  summary: TriageSummaryStats;
  recent_batches: TriageBatchRun[];
  override_trends: {
    total_overrides: number;
    by_category: Record<OverrideCategory, number>;
    override_rate_by_classification: Record<DocumentClassification, number>;
  };
}
