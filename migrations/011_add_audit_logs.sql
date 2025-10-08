-- Audit Logs Migration
-- Tracks all actions performed by users within a company

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL if user is deleted
  action_type TEXT NOT NULL, -- e.g., 'user.invited', 'user.deleted', 'company.updated', etc.
  resource_type TEXT NOT NULL, -- e.g., 'user', 'company', 'reference', 'invitation'
  resource_id UUID, -- ID of the affected resource
  description TEXT NOT NULL, -- Human-readable description
  metadata JSONB, -- Additional context (old/new values, etc.)
  ip_address TEXT, -- IP address of the user
  user_agent TEXT, -- Browser/client user agent
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins and owners can view audit logs for their company
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Service role can insert audit logs (backend will use service role)
CREATE POLICY "Service can insert audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Create a helper function to clean up old audit logs (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on the function
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Deletes audit logs older than the specified number of days (default: 90 days). Returns the number of deleted records.';
