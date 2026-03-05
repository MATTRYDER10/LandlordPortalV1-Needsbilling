-- Migration 164: Create tenancy_notes and tenancy_activity tables
-- Notes: User-created notes on tenancies
-- Activity: Audit log for all tenancy changes (user and system)

-- ============================================================================
-- TENANCY NOTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenancy_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenancy_notes_tenancy_id ON tenancy_notes(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_notes_created_at ON tenancy_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenancy_notes_pinned ON tenancy_notes(tenancy_id) WHERE is_pinned = TRUE;

-- RLS
ALTER TABLE tenancy_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view notes for tenancies their company owns
CREATE POLICY "Users can view tenancy notes"
  ON tenancy_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      JOIN companies c ON p.company_id = c.id
      JOIN company_users cu ON c.id = cu.company_id
      WHERE t.id = tenancy_notes.tenancy_id
      AND cu.user_id = auth.uid()
    )
  );

-- Policy: Users can insert notes for tenancies their company owns
CREATE POLICY "Users can insert tenancy notes"
  ON tenancy_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      JOIN companies c ON p.company_id = c.id
      JOIN company_users cu ON c.id = cu.company_id
      WHERE t.id = tenancy_notes.tenancy_id
      AND cu.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Policy: Users can update their own notes
CREATE POLICY "Users can update their own tenancy notes"
  ON tenancy_notes FOR UPDATE
  USING (created_by = auth.uid());

-- Policy: Users can delete their own notes
CREATE POLICY "Users can delete their own tenancy notes"
  ON tenancy_notes FOR DELETE
  USING (created_by = auth.uid());


-- ============================================================================
-- TENANCY ACTIVITY LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenancy_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,

  -- Action categorization
  action VARCHAR(100) NOT NULL, -- e.g., 'TENANT_ADDED', 'AGREEMENT_SIGNED', 'RENT_UPDATED'
  category VARCHAR(50) NOT NULL DEFAULT 'general', -- 'tenant', 'agreement', 'payment', 'notice', 'general'

  -- Human-readable content
  title TEXT NOT NULL, -- Short title: "Tenant Added"
  description TEXT, -- Longer description: "John Smith was added as a tenant"

  -- Additional data
  metadata JSONB DEFAULT '{}'::jsonb, -- Structured data (old/new values, IDs, etc.)

  -- Who and when
  performed_by UUID REFERENCES auth.users(id), -- NULL for system actions
  is_system_action BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenancy_activity_tenancy_id ON tenancy_activity(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_activity_created_at ON tenancy_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenancy_activity_action ON tenancy_activity(action);
CREATE INDEX IF NOT EXISTS idx_tenancy_activity_category ON tenancy_activity(category);

-- RLS
ALTER TABLE tenancy_activity ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view activity for tenancies their company owns
CREATE POLICY "Users can view tenancy activity"
  ON tenancy_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tenancies t
      JOIN properties p ON t.property_id = p.id
      JOIN companies c ON p.company_id = c.id
      JOIN company_users cu ON c.id = cu.company_id
      WHERE t.id = tenancy_activity.tenancy_id
      AND cu.user_id = auth.uid()
    )
  );

-- Policy: Anyone authenticated can insert activity (for system actions)
CREATE POLICY "Authenticated users can insert tenancy activity"
  ON tenancy_activity FOR INSERT
  WITH CHECK (true);


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tenancy_notes IS 'User-created notes on tenancies';
COMMENT ON TABLE tenancy_activity IS 'Audit trail of all actions performed on tenancies';

COMMENT ON COLUMN tenancy_activity.action IS 'Action code: TENANT_ADDED, TENANT_REMOVED, AGREEMENT_GENERATED, AGREEMENT_SIGNED, DEPOSIT_PROTECTED, RENT_UPDATED, STATUS_CHANGED, NOTE_ADDED, etc.';
COMMENT ON COLUMN tenancy_activity.category IS 'Category for filtering: tenant, agreement, payment, notice, general';
COMMENT ON COLUMN tenancy_activity.metadata IS 'Structured data about the action (old/new values, related IDs, etc.)';
