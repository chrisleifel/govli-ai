-- Govli AI FOIA Module: AI-3 Pattern Intelligence & AI-11 Proactive Disclosure
-- Migration 010: Pattern analysis and proactive disclosure tables

-- Request Pattern Clusters Table
-- Stores AI-identified patterns across FOIA requests
CREATE TABLE IF NOT EXISTS "FoiaRequestPatterns" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,

  -- Cluster Information
  cluster_name VARCHAR(200) NOT NULL,
  record_types JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of record type strings
  department_most_likely VARCHAR(200),

  -- Frequency & Trends
  request_count_12mo INTEGER NOT NULL DEFAULT 0,
  request_count_all_time INTEGER NOT NULL DEFAULT 0,
  trend VARCHAR(20) NOT NULL CHECK (trend IN ('INCREASING', 'STABLE', 'DECREASING')),

  -- Analysis
  typical_requester_profile TEXT,
  notable_patterns JSONB DEFAULT '[]'::jsonb, -- Array of pattern strings

  -- Request IDs in this cluster
  request_ids JSONB DEFAULT '[]'::jsonb, -- Array of UUIDs

  -- AI Metadata
  analysis_date TIMESTAMP NOT NULL DEFAULT NOW(),
  model_used VARCHAR(100) NOT NULL,
  confidence_score DECIMAL(5, 4) CHECK (confidence_score BETWEEN 0 AND 1),

  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foia_patterns_tenant ON "FoiaRequestPatterns"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_patterns_cluster ON "FoiaRequestPatterns"(cluster_name);
CREATE INDEX IF NOT EXISTS idx_foia_patterns_trend ON "FoiaRequestPatterns"(trend);
CREATE INDEX IF NOT EXISTS idx_foia_patterns_analysis_date ON "FoiaRequestPatterns"(analysis_date);
CREATE INDEX IF NOT EXISTS idx_foia_patterns_count_12mo ON "FoiaRequestPatterns"(request_count_12mo DESC);

-- Repeat Requesters Tracking Table
-- Identifies requesters with multiple similar requests
CREATE TABLE IF NOT EXISTS "FoiaRepeatRequesters" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,

  -- Requester Info
  requester_email VARCHAR(255) NOT NULL,
  requester_name VARCHAR(255),

  -- Pattern Information
  request_count_12mo INTEGER NOT NULL DEFAULT 0,
  similar_request_clusters JSONB DEFAULT '[]'::jsonb, -- Array of cluster names
  request_ids JSONB DEFAULT '[]'::jsonb, -- Array of request UUIDs

  -- Analysis
  pattern_description TEXT,
  proactive_outreach_recommended BOOLEAN DEFAULT false,
  proactive_outreach_reason TEXT,

  -- Tracking
  last_request_date TIMESTAMP,
  first_request_date TIMESTAMP,
  analysis_date TIMESTAMP NOT NULL DEFAULT NOW(),

  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foia_repeat_tenant ON "FoiaRepeatRequesters"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_repeat_email ON "FoiaRepeatRequesters"(requester_email);
CREATE INDEX IF NOT EXISTS idx_foia_repeat_count ON "FoiaRepeatRequesters"(request_count_12mo DESC);
CREATE INDEX IF NOT EXISTS idx_foia_repeat_analysis ON "FoiaRepeatRequesters"(analysis_date);

-- Routing Optimization Recommendations Table
-- AI-suggested routing improvements based on performance patterns
CREATE TABLE IF NOT EXISTS "FoiaRoutingOptimizations" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,

  -- Routing Information
  department VARCHAR(200) NOT NULL,
  topic_cluster VARCHAR(200) NOT NULL,

  -- Performance Metrics
  avg_response_days DECIMAL(10, 2) NOT NULL,
  request_count INTEGER NOT NULL,

  -- Recommendation
  recommendation TEXT NOT NULL,
  recommended_department VARCHAR(200), -- Alternative department suggestion
  expected_improvement_pct DECIMAL(5, 2), -- Expected % improvement

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED')
  ),
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  review_notes TEXT,

  -- Metadata
  analysis_date TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foia_routing_tenant ON "FoiaRoutingOptimizations"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_routing_dept ON "FoiaRoutingOptimizations"(department);
CREATE INDEX IF NOT EXISTS idx_foia_routing_cluster ON "FoiaRoutingOptimizations"(topic_cluster);
CREATE INDEX IF NOT EXISTS idx_foia_routing_status ON "FoiaRoutingOptimizations"(status);
CREATE INDEX IF NOT EXISTS idx_foia_routing_analysis ON "FoiaRoutingOptimizations"(analysis_date);

-- Proactive Disclosure Candidates Table (AI-11)
-- Records that should potentially be proactively published
CREATE TABLE IF NOT EXISTS "FoiaProactiveCandidates" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,

  -- Pattern Source
  pattern_cluster_id UUID REFERENCES "FoiaRequestPatterns"(id) ON DELETE SET NULL,
  cluster_name VARCHAR(200) NOT NULL,

  -- Recommendation
  should_publish BOOLEAN NOT NULL,
  recommended_record_types JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of record type strings
  publish_format VARCHAR(50) CHECK (
    publish_format IN ('full', 'redacted_template', 'summary')
  ),

  -- Impact Estimation
  frequency_score INTEGER NOT NULL, -- How often this is requested
  estimated_request_deflection_pct DECIMAL(5, 2), -- % of future requests avoided
  estimated_annual_requests INTEGER, -- How many requests per year this would deflect

  -- Analysis
  justification TEXT NOT NULL,
  caveats JSONB DEFAULT '[]'::jsonb, -- Array of caveat strings
  public_interest_score DECIMAL(5, 4) CHECK (public_interest_score BETWEEN 0 AND 1),

  -- Decision Tracking
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'APPROVED', 'DISMISSED', 'PUBLISHED')
  ),
  decision_made_by UUID,
  decision_made_at TIMESTAMP,
  dismissal_reason TEXT,

  -- Publishing Tracking
  published_at TIMESTAMP,
  reading_room_url TEXT,

  -- AI Metadata
  scan_date TIMESTAMP NOT NULL DEFAULT NOW(),
  model_used VARCHAR(100) NOT NULL,
  confidence_score DECIMAL(5, 4) CHECK (confidence_score BETWEEN 0 AND 1),

  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foia_proactive_tenant ON "FoiaProactiveCandidates"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_proactive_pattern ON "FoiaProactiveCandidates"(pattern_cluster_id);
CREATE INDEX IF NOT EXISTS idx_foia_proactive_status ON "FoiaProactiveCandidates"(status);
CREATE INDEX IF NOT EXISTS idx_foia_proactive_should_publish ON "FoiaProactiveCandidates"(should_publish);
CREATE INDEX IF NOT EXISTS idx_foia_proactive_score ON "FoiaProactiveCandidates"(frequency_score DESC);
CREATE INDEX IF NOT EXISTS idx_foia_proactive_scan ON "FoiaProactiveCandidates"(scan_date);

-- Proactive Disclosure Impact Tracking Table
-- Tracks how many requests were deflected by proactive disclosures
CREATE TABLE IF NOT EXISTS "FoiaProactiveImpact" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  candidate_id UUID REFERENCES "FoiaProactiveCandidates"(id) ON DELETE CASCADE,

  -- Impact Metrics
  month_year DATE NOT NULL, -- First day of month
  requests_deflected INTEGER DEFAULT 0,
  estimated_staff_hours_saved DECIMAL(10, 2) DEFAULT 0,
  estimated_cost_savings_usd DECIMAL(10, 2) DEFAULT 0,

  -- Tracking Method
  tracking_method VARCHAR(50) CHECK (
    tracking_method IN ('MANUAL_LOG', 'REFERRAL_LINK', 'SURVEY', 'ESTIMATED')
  ),

  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, candidate_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_foia_impact_tenant ON "FoiaProactiveImpact"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_impact_candidate ON "FoiaProactiveImpact"(candidate_id);
CREATE INDEX IF NOT EXISTS idx_foia_impact_month ON "FoiaProactiveImpact"(month_year);

-- Pattern Analysis Job Log Table
-- Tracks when pattern analysis jobs run
CREATE TABLE IF NOT EXISTS "FoiaPatternAnalysisJobs" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,

  -- Job Info
  job_type VARCHAR(50) NOT NULL CHECK (
    job_type IN ('PATTERN_ANALYSIS', 'PROACTIVE_SCAN')
  ),
  status VARCHAR(50) NOT NULL DEFAULT 'RUNNING' CHECK (
    status IN ('RUNNING', 'COMPLETED', 'FAILED')
  ),

  -- Results
  patterns_identified INTEGER DEFAULT 0,
  candidates_generated INTEGER DEFAULT 0,
  error_message TEXT,

  -- Timing
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,

  "createdAt" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foia_jobs_tenant ON "FoiaPatternAnalysisJobs"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_foia_jobs_type ON "FoiaPatternAnalysisJobs"(job_type);
CREATE INDEX IF NOT EXISTS idx_foia_jobs_status ON "FoiaPatternAnalysisJobs"(status);
CREATE INDEX IF NOT EXISTS idx_foia_jobs_started ON "FoiaPatternAnalysisJobs"(started_at);

-- Comments for documentation
COMMENT ON TABLE "FoiaRequestPatterns" IS 'AI-3: Identified patterns and clusters across FOIA requests';
COMMENT ON TABLE "FoiaRepeatRequesters" IS 'AI-3: Requesters with multiple similar requests for proactive outreach';
COMMENT ON TABLE "FoiaRoutingOptimizations" IS 'AI-3: AI-suggested routing improvements based on performance';
COMMENT ON TABLE "FoiaProactiveCandidates" IS 'AI-11: Records recommended for proactive disclosure';
COMMENT ON TABLE "FoiaProactiveImpact" IS 'AI-11: Impact tracking for proactive disclosures';
COMMENT ON TABLE "FoiaPatternAnalysisJobs" IS 'Job execution log for pattern analysis and proactive scans';
