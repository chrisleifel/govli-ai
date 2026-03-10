-- Govli AI FOIA Module: AI-1 Intelligent Request Scoping
-- Migration 008: Scoping analyses table for request quality assessment

-- Scoping Analyses Table
-- Stores AI analysis results for request quality and completeness
CREATE TABLE IF NOT EXISTS "FoiaScopingAnalyses" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  foia_request_id UUID NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,

  -- AI Analysis Output
  overall_quality INTEGER NOT NULL CHECK (overall_quality BETWEEN 0 AND 100),
  is_well_scoped BOOLEAN NOT NULL DEFAULT false,
  estimated_complexity VARCHAR(20) NOT NULL CHECK (
    estimated_complexity IN ('SIMPLE', 'MODERATE', 'COMPLEX', 'VERY_COMPLEX')
  ),

  -- Scoping Flags (JSONB array of flag objects)
  scoping_flags JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Suggestions
  suggested_clarification TEXT,
  narrowing_suggestions JSONB DEFAULT '[]'::jsonb,
  reasoning TEXT NOT NULL,

  -- AI Metadata
  model_used VARCHAR(100) NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,

  -- Coordinator Action
  coordinator_action VARCHAR(50), -- 'APPROVED', 'EDITED', 'SENT', 'IGNORED'
  coordinator_id UUID,
  coordinator_action_at TIMESTAMP,
  edited_clarification TEXT, -- If coordinator edited the AI suggestion

  -- Tracking
  clarification_sent BOOLEAN NOT NULL DEFAULT false,
  clarification_sent_at TIMESTAMP,

  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT foia_scoping_analyses_request_fk FOREIGN KEY (foia_request_id)
    REFERENCES "FoiaRequests"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_foia_scoping_request ON "FoiaScopingAnalyses"(foia_request_id);
CREATE INDEX IF NOT EXISTS idx_foia_scoping_tenant ON "FoiaScopingAnalyses"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_scoping_quality ON "FoiaScopingAnalyses"(overall_quality);
CREATE INDEX IF NOT EXISTS idx_foia_scoping_well_scoped ON "FoiaScopingAnalyses"(is_well_scoped);
CREATE INDEX IF NOT EXISTS idx_foia_scoping_created ON "FoiaScopingAnalyses"("createdAt");

-- Add scoping_flag to FoiaRequests for quick status checks
ALTER TABLE "FoiaRequests"
ADD COLUMN IF NOT EXISTS scoping_flag VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_foia_requests_scoping_flag ON "FoiaRequests"(scoping_flag);

-- A/B Testing Tracking Table
-- Track scoping assist effectiveness
CREATE TABLE IF NOT EXISTS "FoiaScopingMetrics" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  foia_request_id UUID NOT NULL,
  tenant_id UUID NOT NULL,

  -- A/B Testing
  scoping_assist_used BOOLEAN NOT NULL DEFAULT false,
  clarification_needed BOOLEAN NOT NULL DEFAULT false,
  clarification_rounds INTEGER NOT NULL DEFAULT 0,

  -- Outcome Metrics
  time_to_clarification_hours DECIMAL(10, 2),
  time_to_completion_hours DECIMAL(10, 2),
  final_quality_score INTEGER CHECK (final_quality_score BETWEEN 0 AND 100),

  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  CONSTRAINT foia_scoping_metrics_request_fk FOREIGN KEY (foia_request_id)
    REFERENCES "FoiaRequests"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_foia_scoping_metrics_request ON "FoiaScopingMetrics"(foia_request_id);
CREATE INDEX IF NOT EXISTS idx_foia_scoping_metrics_tenant ON "FoiaScopingMetrics"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_scoping_metrics_assist ON "FoiaScopingMetrics"(scoping_assist_used);
CREATE INDEX IF NOT EXISTS idx_foia_scoping_metrics_created ON "FoiaScopingMetrics"("createdAt");

-- Comments for documentation
COMMENT ON TABLE "FoiaScopingAnalyses" IS 'AI-1: Request quality and scoping analyses with coordinator actions';
COMMENT ON TABLE "FoiaScopingMetrics" IS 'A/B testing metrics for scoping assistant effectiveness';
COMMENT ON COLUMN "FoiaRequests".scoping_flag IS 'Quick status: WELL_SCOPED, NEEDS_CLARIFICATION, etc.';
