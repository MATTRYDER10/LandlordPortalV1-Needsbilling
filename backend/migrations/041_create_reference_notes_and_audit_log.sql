-- Create reference_notes table for staff notes on references
CREATE TABLE IF NOT EXISTS reference_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reference_audit_log table for tracking all actions on references
CREATE TABLE IF NOT EXISTS reference_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- e.g., 'EMAIL_RESENT', 'NOTE_ADDED', 'STATUS_CHANGED', 'SCORE_UPDATED'
  description TEXT NOT NULL, -- Human-readable description of the action
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional data about the action
  created_by UUID REFERENCES auth.users(id), -- NULL for system actions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_reference_notes_reference_id ON reference_notes(reference_id);
CREATE INDEX IF NOT EXISTS idx_reference_notes_created_at ON reference_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_reference_audit_log_reference_id ON reference_audit_log(reference_id);
CREATE INDEX IF NOT EXISTS idx_reference_audit_log_created_at ON reference_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_reference_audit_log_action ON reference_audit_log(action);

-- Add comments
COMMENT ON TABLE reference_notes IS 'Staff notes on tenant references';
COMMENT ON TABLE reference_audit_log IS 'Audit trail of all actions performed on tenant references';
COMMENT ON COLUMN reference_audit_log.action IS 'Type of action performed (EMAIL_RESENT, NOTE_ADDED, STATUS_CHANGED, etc.)';
COMMENT ON COLUMN reference_audit_log.metadata IS 'Additional structured data about the action (e.g., email type, old/new status values)';

-- Enable Row Level Security
ALTER TABLE reference_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Staff can view all notes
CREATE POLICY "Staff can view all reference notes"
  ON reference_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
  );

-- RLS Policy: Staff can insert notes
CREATE POLICY "Staff can insert reference notes"
  ON reference_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- RLS Policy: Staff can update their own notes
CREATE POLICY "Staff can update their own reference notes"
  ON reference_notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- RLS Policy: Staff can delete their own notes
CREATE POLICY "Staff can delete their own reference notes"
  ON reference_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- RLS Policy: Staff can view all audit log entries
CREATE POLICY "Staff can view all audit log entries"
  ON reference_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
  );

-- RLS Policy: System can insert audit log entries
CREATE POLICY "System can insert audit log entries"
  ON reference_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
