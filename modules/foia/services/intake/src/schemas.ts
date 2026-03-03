/**
 * Govli AI FOIA Module - Intake Service Validation Schemas
 * Zod schemas for request validation
 */

import { z } from 'zod';

/**
 * Schema for submitting a new FOIA request
 */
export const SubmitRequestSchema = z.object({
  requester_name: z.string().min(1, 'Requester name is required').max(255),
  requester_email: z.string().email('Valid email is required'),
  requester_phone: z.string().optional(),
  requester_organization: z.string().optional(),
  requester_category: z.enum([
    'COMMERCIAL',
    'EDUCATIONAL',
    'NEWS_MEDIA',
    'PUBLIC_INTEREST',
    'OTHER'
  ]),

  subject: z.string().min(5, 'Subject must be at least 5 characters').max(500),
  description: z.string().min(20, 'Description must be at least 20 characters'),

  date_range_start: z.string().datetime().optional(),
  date_range_end: z.string().datetime().optional(),

  agency_names: z.array(z.string()).min(1, 'At least one agency must be specified'),

  expedited_processing: z.boolean().optional().default(false),
  expedited_justification: z.string().optional(),

  fee_waiver_requested: z.boolean().optional().default(false),
  fee_waiver_justification: z.string().optional(),

  delivery_method: z.enum(['EMAIL', 'MAIL', 'PICKUP']).optional().default('EMAIL'),
  delivery_address: z.string().optional()
});

export type SubmitRequestInput = z.infer<typeof SubmitRequestSchema>;

/**
 * Schema for request status query params
 */
export const RequestStatusQuerySchema = z.object({
  confirmation_number: z.string().optional(),
  include_documents: z.string().transform(val => val === 'true').optional()
});

/**
 * Schema for validating a request
 */
export const ValidateRequestSchema = z.object({
  validation_status: z.enum(['APPROVED', 'REJECTED', 'NEEDS_CLARIFICATION']),
  validation_notes: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  estimated_completion_date: z.string().datetime().optional()
});

export type ValidateRequestInput = z.infer<typeof ValidateRequestSchema>;

/**
 * Schema for acknowledging a request
 */
export const AcknowledgeRequestSchema = z.object({
  acknowledgment_method: z.enum(['EMAIL', 'MAIL']).default('EMAIL'),
  custom_message: z.string().optional(),
  estimated_completion_date: z.string().datetime().optional()
});

export type AcknowledgeRequestInput = z.infer<typeof AcknowledgeRequestSchema>;

/**
 * Schema for staff queue filters
 */
export const StaffQueueFiltersSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  requester_category: z.string().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.string().transform(val => parseInt(val, 10)).optional().default('1'),
  page_size: z.string().transform(val => parseInt(val, 10)).optional().default('20'),
  sort_by: z.enum(['received_at', 'due_date', 'priority', 'status']).optional().default('received_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc')
});

export type StaffQueueFilters = z.infer<typeof StaffQueueFiltersSchema>;

/**
 * Schema for duplicate check
 */
export const DuplicateCheckSchema = z.object({
  similarity_threshold: z.number().min(0).max(1).optional().default(0.85),
  check_last_days: z.number().int().positive().optional().default(365)
});

export type DuplicateCheckInput = z.infer<typeof DuplicateCheckSchema>;
