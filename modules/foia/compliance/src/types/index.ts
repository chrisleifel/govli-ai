/**
 * FOIA Compliance Types
 */

/**
 * Audit Log Entry
 */
export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  event_id: string;
  event_type: string;
  entity_id: string;
  entity_type: string;
  user_id?: string;
  encrypted_payload: string; // AES-256 encrypted JSON
  encryption_iv: string; // Initialization vector for decryption
  hold_flag: boolean;
  archived: boolean;
  created_at: Date;
}

/**
 * Litigation Hold
 */
export interface LitigationHold {
  id: string;
  tenant_id: string;
  foia_request_id: string;
  reason: string;
  case_number?: string;
  start_date: Date;
  end_date?: Date;
  status: 'ACTIVE' | 'RELEASED';
  created_by: string;
  released_by?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Annual Report (DOJ Format)
 */
export interface AnnualReport {
  year: number;
  tenant_id: string;

  // Requests received
  requests_received: number;
  requests_carried_forward: number;

  // Requests processed
  requests_processed: number;
  requests_granted_full: number;
  requests_granted_partial: number;
  requests_denied_full: number;
  requests_no_records: number;

  // Timeliness
  simple_median_days: number;
  complex_median_days: number;
  expedited_median_days: number;

  // Backlog
  backlog_count: number;

  // Appeals
  appeals_received: number;
  appeals_processed: number;
  appeals_granted: number;
  appeals_denied: number;

  // Fees
  total_fees_collected: number;
  fee_waivers_granted: number;

  // Exemptions used
  exemptions_breakdown: Record<string, number>;

  generated_at: Date;
}

/**
 * SLA Summary
 */
export interface SLASummary {
  tenant_id: string;
  period_start: Date;
  period_end: Date;

  total_requests: number;
  on_time_completion: number;
  overdue_completion: number;

  compliance_rate: number; // Percentage
  average_response_days: number;

  by_complexity: {
    simple: { count: number; avg_days: number };
    complex: { count: number; avg_days: number };
    expedited: { count: number; avg_days: number };
  };

  generated_at: Date;
}

/**
 * Audit Log Query Filters
 */
export interface AuditLogFilters {
  tenant_id: string;
  entity_id?: string;
  entity_type?: string;
  event_type?: string;
  user_id?: string;
  start_date?: Date;
  end_date?: Date;
  hold_flag?: boolean;
  archived?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Audit Log Export Request
 */
export interface AuditLogExportRequest {
  start_date: Date;
  end_date: Date;
  format?: 'JSON' | 'CSV';
  include_encrypted?: boolean;
}

/**
 * Decrypted Audit Payload
 */
export interface DecryptedAuditPayload {
  event_id: string;
  event_type: string;
  entity_id: string;
  entity_type: string;
  user_id?: string;
  metadata: Record<string, any>;
  timestamp: Date;
}
