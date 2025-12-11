-- Create offer_notes table for staff notes on tenant offers
CREATE TABLE IF NOT EXISTS offer_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES tenant_offers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create offer_audit_log table for tracking all actions on tenant offers
CREATE TABLE IF NOT EXISTS offer_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id UUID NOT NULL REFERENCES tenant_offers(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- e.g., 'EMAIL_SENT', 'NOTE_ADDED', 'STATUS_CHANGED', 'OFFER_APPROVED'
  description TEXT NOT NULL, -- Human-readable description of the action
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional data about the action
  created_by UUID REFERENCES auth.users(id), -- NULL for system actions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_offer_notes_offer_id ON offer_notes(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_notes_created_at ON offer_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_offer_audit_log_offer_id ON offer_audit_log(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_audit_log_created_at ON offer_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_offer_audit_log_action ON offer_audit_log(action);

-- Add comments
COMMENT ON TABLE offer_notes IS 'Staff notes on tenant offers';
COMMENT ON TABLE offer_audit_log IS 'Audit trail of all actions performed on tenant offers';
COMMENT ON COLUMN offer_audit_log.action IS 'Type of action performed (OFFER_APPROVED, EMAIL_SENT, NOTE_ADDED, etc.)';
COMMENT ON COLUMN offer_audit_log.metadata IS 'Additional structured data about the action (e.g., email type, recipient)';

-- Enable Row Level Security
ALTER TABLE offer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Staff can view all notes
CREATE POLICY "Staff can view all offer notes"
  ON offer_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
  );

-- RLS Policy: Staff can insert notes
CREATE POLICY "Staff can insert offer notes"
  ON offer_notes
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
CREATE POLICY "Staff can update their own offer notes"
  ON offer_notes
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
CREATE POLICY "Staff can delete their own offer notes"
  ON offer_notes
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
CREATE POLICY "Staff can view all offer audit log entries"
  ON offer_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
  );

-- RLS Policy: System can insert audit log entries
CREATE POLICY "System can insert offer audit log entries"
  ON offer_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
