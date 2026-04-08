-- Error logging table for frontend and backend error tracking
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  source VARCHAR(10) NOT NULL CHECK (source IN ('frontend', 'backend')),
  level VARCHAR(10) NOT NULL DEFAULT 'error' CHECK (level IN ('error', 'warn', 'fatal')),

  -- Error details
  message TEXT NOT NULL,
  stack_trace TEXT,
  error_type VARCHAR(255),
  error_code VARCHAR(100),

  -- User context (nullable - errors can happen pre-auth)
  user_id UUID,
  user_email VARCHAR(255),
  company_id UUID,
  branch_id UUID,

  -- Frontend context
  route_name VARCHAR(255),
  route_path TEXT,
  route_params JSONB,
  component_name VARCHAR(255),
  app_version VARCHAR(50),
  browser_info JSONB,

  -- Backend context
  request_method VARCHAR(10),
  request_url TEXT,
  request_query JSONB,
  request_body JSONB,
  response_status_code INTEGER,

  -- Common context
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Grouping / deduplication
  fingerprint VARCHAR(64),
  metadata JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Resolution tracking
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

-- Indexes for common query patterns
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_source ON error_logs(source);
CREATE INDEX idx_error_logs_level ON error_logs(level);
CREATE INDEX idx_error_logs_fingerprint ON error_logs(fingerprint);
CREATE INDEX idx_error_logs_company_id ON error_logs(company_id);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX idx_error_logs_unresolved ON error_logs(created_at DESC) WHERE resolved_at IS NULL;

-- RLS: service role only
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON error_logs FOR ALL USING (false);

-- Auto-cleanup function for old error logs
CREATE OR REPLACE FUNCTION cleanup_old_error_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM error_logs
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
