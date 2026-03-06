-- Govli AI FOIA Module: v2.0 Processing Enhancements
-- Migration 007: Batch jobs, redaction tables, and confidence calibration

-- Batch Jobs Table
-- For queuing high-volume redaction/processing tasks
CREATE TABLE IF NOT EXISTS foia_batch_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  request_id UUID NOT NULL,
  job_type VARCHAR(50) NOT NULL CHECK (
    job_type IN ('REDACTION', 'TRIAGE', 'REVIEW', 'RESPONSE_DRAFT')
  ),
  document_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'QUEUED' CHECK (
    status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')
  ),
  metadata JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT foia_batch_jobs_tenant_fk FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT foia_batch_jobs_request_fk FOREIGN KEY (request_id)
    REFERENCES foia_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_foia_batch_jobs_tenant ON foia_batch_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_batch_jobs_request ON foia_batch_jobs(request_id);
CREATE INDEX IF NOT EXISTS idx_foia_batch_jobs_status ON foia_batch_jobs(status) WHERE status != 'COMPLETED';
CREATE INDEX IF NOT EXISTS idx_foia_batch_jobs_created ON foia_batch_jobs(created_at);

-- Documents Table (if not exists)
CREATE TABLE IF NOT EXISTS foia_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  request_id UUID NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  text_content TEXT,
  page_count INTEGER,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT foia_documents_tenant_fk FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT foia_documents_request_fk FOREIGN KEY (request_id)
    REFERENCES foia_requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_foia_documents_tenant ON foia_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_documents_request ON foia_documents(request_id);

-- Redaction Suggestions Table
-- Stores AI-generated redaction suggestions
CREATE TABLE IF NOT EXISTS foia_redaction_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL,
  text TEXT NOT NULL,
  exemption_code VARCHAR(20) NOT NULL,
  start_position INTEGER NOT NULL,
  end_position INTEGER NOT NULL,
  confidence DECIMAL(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  rationale TEXT,
  officer_action VARCHAR(20) CHECK (
    officer_action IN ('accept', 'reject', 'modify', NULL)
  ),
  officer_id UUID,
  reviewed_at TIMESTAMP,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT foia_redaction_suggestions_document_fk FOREIGN KEY (document_id)
    REFERENCES foia_documents(id) ON DELETE CASCADE,
  CONSTRAINT foia_redaction_suggestions_officer_fk FOREIGN KEY (officer_id)
    REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_foia_redaction_suggestions_document ON foia_redaction_suggestions(document_id);
CREATE INDEX IF NOT EXISTS idx_foia_redaction_suggestions_confidence ON foia_redaction_suggestions(confidence);
CREATE INDEX IF NOT EXISTS idx_foia_redaction_suggestions_action ON foia_redaction_suggestions(officer_action);

-- Redaction Overrides Table (v2.0 Confidence Calibration)
-- Tracks when officers accept/reject/modify AI suggestions
-- Used to calibrate AI confidence scores over time
CREATE TABLE IF NOT EXISTS foia_redaction_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  suggestion_id UUID NOT NULL,
  document_id UUID NOT NULL,
  officer_id UUID NOT NULL,
  ai_confidence DECIMAL(3, 2) NOT NULL,
  ai_exemption VARCHAR(20) NOT NULL,
  officer_action VARCHAR(20) NOT NULL CHECK (
    officer_action IN ('accept', 'reject', 'modify')
  ),
  officer_exemption VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT foia_redaction_overrides_tenant_fk FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT foia_redaction_overrides_suggestion_fk FOREIGN KEY (suggestion_id)
    REFERENCES foia_redaction_suggestions(id) ON DELETE CASCADE,
  CONSTRAINT foia_redaction_overrides_document_fk FOREIGN KEY (document_id)
    REFERENCES foia_documents(id) ON DELETE CASCADE,
  CONSTRAINT foia_redaction_overrides_officer_fk FOREIGN KEY (officer_id)
    REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_foia_redaction_overrides_tenant ON foia_redaction_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_redaction_overrides_suggestion ON foia_redaction_overrides(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_foia_redaction_overrides_officer ON foia_redaction_overrides(officer_id);
CREATE INDEX IF NOT EXISTS idx_foia_redaction_overrides_action ON foia_redaction_overrides(officer_action);
CREATE INDEX IF NOT EXISTS idx_foia_redaction_overrides_created ON foia_redaction_overrides(created_at);

-- Confidence Calibration Summary View
-- Aggregates AI confidence vs officer decisions for model tuning
CREATE OR REPLACE VIEW foia_confidence_calibration AS
SELECT
  tenant_id,
  ai_exemption,
  ROUND(ai_confidence, 1) as confidence_bucket,
  COUNT(*) as total_suggestions,
  SUM(CASE WHEN officer_action = 'accept' THEN 1 ELSE 0 END) as accepted_count,
  SUM(CASE WHEN officer_action = 'reject' THEN 1 ELSE 0 END) as rejected_count,
  SUM(CASE WHEN officer_action = 'modify' THEN 1 ELSE 0 END) as modified_count,
  ROUND(
    SUM(CASE WHEN officer_action = 'accept' THEN 1 ELSE 0 END)::DECIMAL / COUNT(*),
    2
  ) as acceptance_rate
FROM foia_redaction_overrides
GROUP BY tenant_id, ai_exemption, ROUND(ai_confidence, 1);

-- Comments for documentation
COMMENT ON TABLE foia_batch_jobs IS 'v2.0: Queue for high-volume processing tasks (>20 documents)';
COMMENT ON TABLE foia_redaction_suggestions IS 'v2.0: AI-generated redaction suggestions with confidence scores';
COMMENT ON TABLE foia_redaction_overrides IS 'v2.0: Officer overrides for confidence calibration tracking';
COMMENT ON VIEW foia_confidence_calibration IS 'v2.0: Aggregated AI confidence vs officer decisions for model tuning';

-- AI Model Overrides Table (for tenant-specific model routing)
CREATE TABLE IF NOT EXISTS foia_ai_model_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  feature_id VARCHAR(50) NOT NULL,
  model_name VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT foia_ai_model_overrides_tenant_fk FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT foia_ai_model_overrides_unique UNIQUE (tenant_id, feature_id)
);

CREATE INDEX IF NOT EXISTS idx_foia_ai_model_overrides_tenant ON foia_ai_model_overrides(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_ai_model_overrides_feature ON foia_ai_model_overrides(feature_id);

COMMENT ON TABLE foia_ai_model_overrides IS 'v2.0: Tenant-specific AI model routing overrides';
