/**
 * FOIA Tracking Types
 */

import { FoiaRequestStatus } from '@govli/foia-shared';

/**
 * Timeline Event
 */
export interface TimelineEvent {
  id: string;
  tenant_id: string;
  foia_request_id: string;
  event_type: string;
  from_status?: FoiaRequestStatus;
  to_status?: FoiaRequestStatus;
  user_id: string;
  user_name?: string;
  metadata: Record<string, any>;
  created_at: Date;
}

/**
 * State Transition Request
 */
export interface StateTransitionRequest {
  to_status: FoiaRequestStatus;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Routing Record
 */
export interface RoutingRecord {
  id: string;
  tenant_id: string;
  foia_request_id: string;
  department_id: string;
  department_name: string;
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ESCALATED';
  assigned_to?: string;
  assigned_at?: Date;
  notes?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * SLA Status
 */
export interface SLAStatus {
  foia_request_id: string;
  tenant_id: string;
  due_date: Date;
  days_remaining: number;
  days_elapsed: number;
  total_days: number;
  status: FoiaRequestStatus;
  breach_risk_score: number;
  is_overdue: boolean;
  sla_tier: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  calculated_at: Date;
}

/**
 * SLA Dashboard
 */
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

/**
 * Overdue Alert
 */
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

/**
 * Deadline Extension
 */
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
