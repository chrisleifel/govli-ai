-- Govli AI FOIA Module: AI-2 Autonomous Document Triage
-- Migration 009: Document triage tables for AI-powered document classification

-- Document Triage Results Table
-- Stores AI analysis results for each document in a FOIA request
CREATE TABLE IF NOT EXISTS "FoiaDocumentTriageResults" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  foia_request_id UUID NOT NULL,
  document_id UUID NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,

  -- AI Classification Output
  classification VARCHAR(50) NOT NULL CHECK (
    classification IN (
      'LIKELY_RESPONSIVE',
      'LIKELY_EXEMPT',
      'PARTIALLY_RESPONSIVE',
      'NOT_RESPONSIVE',
      'NEEDS_REVIEW',
      'SENSITIVE_CONTENT'
    )
  ),

  confidence_score DECIMAL(5, 4) NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),

  -- Exemption Suggestions (if LIKELY_EXEMPT or PARTIALLY_RESPONSIVE)
  suggested_exemptions JSONB DEFAULT '[]'::jsonb, -- Array of exemption codes with reasoning

  -- Analysis Details
  reasoning TEXT NOT NULL,
  key_findings JSONB DEFAULT '[]'::jsonb, -- Array of important findings/keywords
  sensitivity_flags JSONB DEFAULT '[]'::jsonb, -- PII, SSN, confidential, etc.

  -- Redaction Suggestions
  suggested_redactions JSONB DEFAULT '[]'::jsonb, -- Array of {page, region, reason}
  estimated_redaction_effort VARCHAR(20) CHECK (
    estimated_redaction_effort IN ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'EXTENSIVE')
  ),

  -- AI Metadata
  model_used VARCHAR(100) NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,

  -- Human Review & Override
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  final_classification VARCHAR(50), -- If overridden by human
  override_reason TEXT,

  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT foia_triage_request_fk FOREIGN KEY (foia_request_id)
    REFERENCES "FoiaRequests"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_foia_triage_request ON "FoiaDocumentTriageResults"(foia_request_id);
CREATE INDEX IF NOT EXISTS idx_foia_triage_document ON "FoiaDocumentTriageResults"(document_id);
CREATE INDEX IF NOT EXISTS idx_foia_triage_tenant ON "FoiaDocumentTriageResults"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_triage_classification ON "FoiaDocumentTriageResults"(classification);
CREATE INDEX IF NOT EXISTS idx_foia_triage_confidence ON "FoiaDocumentTriageResults"(confidence_score);
CREATE INDEX IF NOT EXISTS idx_foia_triage_created ON "FoiaDocumentTriageResults"("createdAt");

-- Document Triage Override Log Table
-- Track all human overrides of AI triage decisions for training/audit
CREATE TABLE IF NOT EXISTS "FoiaDocumentTriageOverrides" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  triage_result_id UUID NOT NULL,
  foia_request_id UUID NOT NULL,
  document_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Override Details
  ai_classification VARCHAR(50) NOT NULL,
  human_classification VARCHAR(50) NOT NULL,
  override_reason TEXT NOT NULL,
  override_category VARCHAR(50) CHECK (
    override_category IN (
      'AI_ERROR',
      'POLICY_DECISION',
      'LEGAL_REVIEW',
      'CONTEXT_MISSING',
      'EXEMPTION_CHANGE',
      'OTHER'
    )
  ),

  -- Who and When
  overridden_by UUID NOT NULL,
  overridden_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Feedback for AI Improvement
  ai_confidence DECIMAL(5, 4),
  feedback_for_training BOOLEAN DEFAULT false,

  "createdAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT foia_triage_override_result_fk FOREIGN KEY (triage_result_id)
    REFERENCES "FoiaDocumentTriageResults"(id) ON DELETE CASCADE,
  CONSTRAINT foia_triage_override_request_fk FOREIGN KEY (foia_request_id)
    REFERENCES "FoiaRequests"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_foia_triage_override_result ON "FoiaDocumentTriageOverrides"(triage_result_id);
CREATE INDEX IF NOT EXISTS idx_foia_triage_override_request ON "FoiaDocumentTriageOverrides"(foia_request_id);
CREATE INDEX IF NOT EXISTS idx_foia_triage_override_document ON "FoiaDocumentTriageOverrides"(document_id);
CREATE INDEX IF NOT EXISTS idx_foia_triage_override_tenant ON "FoiaDocumentTriageOverrides"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_triage_override_category ON "FoiaDocumentTriageOverrides"(override_category);
CREATE INDEX IF NOT EXISTS idx_foia_triage_override_created ON "FoiaDocumentTriageOverrides"("createdAt");

-- Triage Batch Runs Table
-- Track when triage is run on a batch of documents for a request
CREATE TABLE IF NOT EXISTS "FoiaDocumentTriageBatches" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  foia_request_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- Batch Info
  document_count INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,

  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')
  ),

  -- Summary Stats
  avg_confidence DECIMAL(5, 4),
  responsive_count INTEGER DEFAULT 0,
  exempt_count INTEGER DEFAULT 0,
  needs_review_count INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  total_duration_ms INTEGER,

  -- Error Tracking
  error_message TEXT,

  started_by UUID,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT foia_triage_batch_request_fk FOREIGN KEY (foia_request_id)
    REFERENCES "FoiaRequests"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_foia_triage_batch_request ON "FoiaDocumentTriageBatches"(foia_request_id);
CREATE INDEX IF NOT EXISTS idx_foia_triage_batch_tenant ON "FoiaDocumentTriageBatches"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_triage_batch_status ON "FoiaDocumentTriageBatches"(status);
CREATE INDEX IF NOT EXISTS idx_foia_triage_batch_created ON "FoiaDocumentTriageBatches"("createdAt");

-- Add triage_status to FoiaDocuments for quick filtering (optional)
ALTER TABLE "FoiaDocuments"
ADD COLUMN IF NOT EXISTS triage_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS triage_confidence DECIMAL(5, 4);

CREATE INDEX IF NOT EXISTS idx_foia_documents_triage_status ON "FoiaDocuments"(triage_status);

-- Comments for documentation
COMMENT ON TABLE "FoiaDocumentTriageResults" IS 'AI-2: Document-level triage classification with AI reasoning';
COMMENT ON TABLE "FoiaDocumentTriageOverrides" IS 'Audit log of human overrides for AI triage decisions';
COMMENT ON TABLE "FoiaDocumentTriageBatches" IS 'Batch run tracking for document triage operations';
COMMENT ON COLUMN "FoiaDocuments".triage_status IS 'Quick access to latest triage classification';
COMMENT ON COLUMN "FoiaDocuments".triage_confidence IS 'Quick access to AI confidence score';
