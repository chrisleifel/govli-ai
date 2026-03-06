-- Govli AI FOIA Module: v2.0 Intake Enhancements
-- Migration 006: Add complexity_score and migration_source to foia_requests

-- Add complexity_score column to foia_requests
-- Stores the calculated complexity score (0-100) for model routing
ALTER TABLE foia_requests
ADD COLUMN IF NOT EXISTS complexity_score INTEGER
  CHECK (complexity_score >= 0 AND complexity_score <= 100);

-- Add migration_source column to foia_requests
-- Tracks where the request originated from for legacy system migrations
ALTER TABLE foia_requests
ADD COLUMN IF NOT EXISTS migration_source VARCHAR(20)
  CHECK (migration_source IN (
    'govqa', 'nextrequest', 'justfoia', 'foiaxpress',
    'spreadsheet', 'email', NULL
  ));

-- Add index for complexity score queries (used by model router)
CREATE INDEX IF NOT EXISTS idx_foia_requests_complexity
  ON foia_requests(complexity_score)
  WHERE complexity_score IS NOT NULL;

-- Add index for migration source queries (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_foia_requests_migration_source
  ON foia_requests(migration_source)
  WHERE migration_source IS NOT NULL;

-- Add is_public column to foia_requests for smart deflection
-- Determines if fulfilled request can be shown in public search results
ALTER TABLE foia_requests
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_foia_requests_public
  ON foia_requests(is_public, status)
  WHERE is_public = true;

-- Create foia_faqs table for smart deflection
CREATE TABLE IF NOT EXISTS foia_faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT foia_faqs_tenant_fk FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_foia_faqs_tenant ON foia_faqs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_faqs_active ON foia_faqs(is_active) WHERE is_active = true;

-- Enable pg_trgm extension for text similarity searches (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for text similarity searches
CREATE INDEX IF NOT EXISTS idx_foia_faqs_text_similarity
  ON foia_faqs USING gin ((question || ' ' || answer) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_foia_requests_text_similarity
  ON foia_requests USING gin ((subject || ' ' || description) gin_trgm_ops);

-- Create tenant_settings table for webhook configuration (if not exists)
CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  key VARCHAR(100) NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT tenant_settings_tenant_fk FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT tenant_settings_unique UNIQUE (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant ON tenant_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_settings_key ON tenant_settings(key);

-- Comments for documentation
COMMENT ON COLUMN foia_requests.complexity_score IS 'v2.0: Calculated complexity score (0-100) for AI model routing';
COMMENT ON COLUMN foia_requests.migration_source IS 'v2.0: Source system for migrated requests (govqa, nextrequest, etc.)';
COMMENT ON COLUMN foia_requests.is_public IS 'v2.0: Whether fulfilled request can be shown in public deflection results';
COMMENT ON TABLE foia_faqs IS 'v2.0: FAQ database for smart deflection feature';
COMMENT ON TABLE tenant_settings IS 'v2.0: Tenant configuration including webhook URLs and feature flags';
