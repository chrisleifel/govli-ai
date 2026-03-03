/**
 * FOIA Processing Module - Document & Redaction Types
 */

export interface Document {
  id: string;
  tenant_id: string;
  foia_request_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  page_count: number;
  extracted_text?: string;
  is_responsive: boolean | null; // null = not yet reviewed
  responsiveness_confidence?: number;
  responsiveness_reason?: string;
  redaction_status: RedactionStatus;
  uploaded_by: string;
  uploaded_at: Date;
  created_at: Date;
  updated_at: Date;
}

export type RedactionStatus =
  | 'NOT_STARTED'
  | 'AI_ANALYSIS_PENDING'
  | 'AI_ANALYSIS_COMPLETE'
  | 'HUMAN_REVIEW_PENDING'
  | 'HUMAN_REVIEW_COMPLETE'
  | 'FINALIZED';

export interface RedactionProposal {
  id: string;
  document_id: string;
  text_span: string;
  start_char: number;
  end_char: number;
  page_number?: number;
  exemption_code: string;
  confidence: number; // 0.0 - 1.0
  reason: string;
  proposed_by: 'AI' | 'HUMAN';
  status: RedactionProposalStatus;
  reviewed_by?: string;
  reviewed_at?: Date;
  created_at: Date;
}

export type RedactionProposalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'MODIFIED';

export interface RedactionReview {
  document_id: string;
  proposals: RedactionProposal[];
  reviewer_notes?: string;
  reviewed_by: string;
  reviewed_at: Date;
}

export interface SearchRecordsRequest {
  query: string;
  date_range_start?: Date;
  date_range_end?: Date;
  record_types?: string[];
  custodians?: string[];
  limit?: number;
}

export interface SearchRecordsResult {
  records: Array<{
    id: string;
    title: string;
    date: Date;
    custodian: string;
    record_type: string;
    relevance_score: number;
    snippet: string;
  }>;
  total_found: number;
}

export interface PackageRequest {
  include_responsive_only: boolean;
  include_redaction_log: boolean;
  format: 'PDF' | 'ZIP';
}

export interface PackageResult {
  package_id: string;
  download_url: string;
  file_size: number;
  created_at: Date;
  expires_at: Date;
}

export interface DocumentUploadResult {
  document_id: string;
  filename: string;
  file_size: number;
  page_count: number;
  extraction_status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  extraction_errors?: string[];
}
