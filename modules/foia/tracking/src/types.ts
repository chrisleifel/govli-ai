/**
 * FOIA Tracking Module - Types
 */

import { FoiaRequestStatus } from '@govli/foia-shared';

export interface TimelineEvent {
  id: string;
  tenant_id: string;
  foia_request_id: string;
  event_type: TimelineEventType;
  from_status?: FoiaRequestStatus;
  to_status?: FoiaRequestStatus;
  user_id?: string;
  user_name?: string;
  metadata: Record<string, any>;
  created_at: Date;
}

export type TimelineEventType =
  | 'REQUEST_CREATED'
  | 'STATUS_CHANGED'
  | 'ASSIGNED'
  | 'ROUTED'
  | 'DEADLINE_EXTENDED'
  | 'COMMENT_ADDED'
  | 'DOCUMENT_UPLOADED'
  | 'REDACTION_COMPLETED'
  | 'RESPONSE_SENT'
  | 'APPEAL_FILED';

export interface RoutingRecord {
  id: string;
  tenant_id: string;
  foia_request_id: string;
  department_id: string;
  department_name: string;
  assigned_to?: string;
  assigned_at?: Date;
  status: RoutingStatus;
  notes?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export type RoutingStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ESCALATED';

export interface SLAStatus {
  foia_request_id: string;
  tenant_id: string;
  due_date: Date;
  days_remaining: number;
  days_elapsed: number;
  total_days: number;
  status: FoiaRequestStatus;
  breach_risk_score: number; // 0-100
  is_overdue: boolean;
  sla_tier: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  calculated_at: Date;
}

export interface SLADashboard {
  total_requests: number;
  on_track: number;
  at_risk: number;
  overdue: number;
  by_tier: {
    GREEN: number;
    YELLOW: number;
    ORANGE: number;
    RED: number;
  };
  average_breach_risk: number;
  requests: SLAStatus[];
}

export interface DeadlineExtension {
  id: string;
  tenant_id: string;
  foia_request_id: string;
  old_due_date: Date;
  new_due_date: Date;
  extension_days: number;
  reason: string;
  requested_by: string;
  approved_by?: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  created_at: Date;
  updated_at: Date;
}

export interface StateTransitionRequest {
  to_status: FoiaRequestStatus;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface OverdueAlert {
  foia_request_id: string;
  tenant_id: string;
  requester_name: string;
  subject: string;
  due_date: Date;
  days_overdue: number;
  assigned_to?: string;
  status: FoiaRequestStatus;
  breach_risk_score: number;
}
