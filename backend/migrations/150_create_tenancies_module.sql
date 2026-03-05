-- Migration 150: Create Tenancies Module Tables
-- This migration creates the complete tenancies module schema including:
-- - tenancies (core entity - represents an active/historical tenancy)
-- - tenancy_tenants (links tenants to a tenancy)
-- - tenancy_audit_log (audit trail for tenancy changes)
-- - tenancy_notices (section 21, section 8, rent review notices)
-- - tenancy_rent_changes (history of rent changes)

-- ============================================================================
-- TENANCIES TABLE
-- Core tenancy entity - represents an active or historical tenancy at a property
-- Created when a reference is converted after agreement is signed
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Source references (one or more for joint tenancies)
  primary_reference_id UUID REFERENCES tenant_references(id) ON DELETE SET NULL,

  -- Agreement link
  agreement_id UUID REFERENCES agreements(id) ON DELETE SET NULL,

  -- Tenancy Type
  tenancy_type TEXT NOT NULL DEFAULT 'ast' CHECK (tenancy_type IN (
    'ast',           -- Assured Shorthold Tenancy
    'periodic',      -- Periodic tenancy (rolling)
    'company_let',   -- Company let
    'lodger',        -- Lodger agreement
    'license'        -- License to occupy
  )),

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'pending',       -- Awaiting move-in
    'active',        -- Currently active
    'notice_given',  -- Notice period in progress
    'ended',         -- Ended normally
    'terminated',    -- Terminated early
    'expired'        -- Fixed term expired, not renewed
  )),

  -- Key Dates
  start_date DATE NOT NULL,
  end_date DATE,                    -- NULL for periodic
  fixed_term_end_date DATE,         -- For AST, when fixed term ends
  actual_end_date DATE,             -- When tenancy actually ended
  notice_period_days INTEGER DEFAULT 60,  -- Default notice period

  -- Financial
  monthly_rent DECIMAL(10, 2) NOT NULL,
  deposit_amount DECIMAL(10, 2),
  deposit_scheme TEXT,              -- 'dps', 'mydeposits', 'tds', 'custodial', 'insured'
  deposit_reference TEXT,           -- Reference from deposit scheme
  deposit_protected_at TIMESTAMP WITH TIME ZONE,
  bills_included BOOLEAN DEFAULT FALSE,

  -- Additional charges (JSON array)
  -- [{name: "Pet fee", amount: 50, frequency: "monthly"}, ...]
  additional_charges JSONB DEFAULT '[]'::jsonb,

  -- Rent due date
  rent_due_day INTEGER DEFAULT 1 CHECK (rent_due_day >= 1 AND rent_due_day <= 28),

  -- Break clause
  has_break_clause BOOLEAN DEFAULT FALSE,
  break_clause_date DATE,
  break_clause_notice_days INTEGER,

  -- Compliance pack sent
  compliance_pack_sent_at TIMESTAMP WITH TIME ZONE,
  compliance_pack_sent_by UUID REFERENCES auth.users(id),

  -- Notes
  notes_encrypted TEXT,

  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES auth.users(id),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for tenancies
CREATE INDEX IF NOT EXISTS idx_tenancies_company_id ON tenancies(company_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_property_id ON tenancies(property_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_status ON tenancies(status);
CREATE INDEX IF NOT EXISTS idx_tenancies_start_date ON tenancies(start_date);
CREATE INDEX IF NOT EXISTS idx_tenancies_end_date ON tenancies(end_date);
CREATE INDEX IF NOT EXISTS idx_tenancies_primary_reference ON tenancies(primary_reference_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_agreement ON tenancies(agreement_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_active ON tenancies(company_id, status) WHERE status IN ('pending', 'active', 'notice_given');
CREATE INDEX IF NOT EXISTS idx_tenancies_not_deleted ON tenancies(company_id) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE tenancies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenancies
DROP POLICY IF EXISTS "Company members can view their tenancies" ON tenancies;
CREATE POLICY "Company members can view their tenancies"
  ON tenancies FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can create tenancies" ON tenancies;
CREATE POLICY "Company members can create tenancies"
  ON tenancies FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can update tenancies" ON tenancies;
CREATE POLICY "Company members can update tenancies"
  ON tenancies FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can delete tenancies" ON tenancies;
CREATE POLICY "Company members can delete tenancies"
  ON tenancies FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Updated at trigger for tenancies
DROP TRIGGER IF EXISTS update_tenancies_updated_at ON tenancies;
CREATE TRIGGER update_tenancies_updated_at
  BEFORE UPDATE ON tenancies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TENANCY_TENANTS TABLE
-- Links tenants (people) to a tenancy - supports joint tenancies
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenancy_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  reference_id UUID REFERENCES tenant_references(id) ON DELETE SET NULL,

  -- Tenant details (encrypted)
  first_name_encrypted TEXT NOT NULL,
  last_name_encrypted TEXT NOT NULL,
  email_encrypted TEXT,
  phone_encrypted TEXT,
  date_of_birth_encrypted TEXT,

  -- Role
  is_lead_tenant BOOLEAN DEFAULT FALSE,
  rent_share DECIMAL(10, 2),          -- Their portion of rent
  rent_share_percentage DECIMAL(5, 2), -- Or percentage

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',        -- Currently on tenancy
    'replaced',      -- Replaced by another tenant
    'removed',       -- Left the tenancy
    'never_moved_in' -- Failed to move in
  )),
  left_date DATE,
  replacement_tenant_id UUID REFERENCES tenancy_tenants(id),

  -- Guarantor link
  guarantor_reference_id UUID REFERENCES tenant_references(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenancy_tenants_tenancy_id ON tenancy_tenants(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_tenants_reference_id ON tenancy_tenants(reference_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_tenants_active ON tenancy_tenants(tenancy_id) WHERE status = 'active';

-- Enable RLS
ALTER TABLE tenancy_tenants ENABLE ROW LEVEL SECURITY;

-- RLS Policy (inherit from tenancy)
DROP POLICY IF EXISTS "Company members can manage tenancy tenants" ON tenancy_tenants;
CREATE POLICY "Company members can manage tenancy tenants"
  ON tenancy_tenants FOR ALL TO authenticated
  USING (
    tenancy_id IN (
      SELECT id FROM tenancies WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- Updated at trigger
DROP TRIGGER IF EXISTS update_tenancy_tenants_updated_at ON tenancy_tenants;
CREATE TRIGGER update_tenancy_tenants_updated_at
  BEFORE UPDATE ON tenancy_tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TENANCY_AUDIT_LOG TABLE
-- Audit trail for tenancy changes
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenancy_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Action
  action TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Context
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Who and when
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenancy_audit_log_tenancy_id ON tenancy_audit_log(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_audit_log_company_id ON tenancy_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_audit_log_created_at ON tenancy_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE tenancy_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "Company members can view tenancy audit logs" ON tenancy_audit_log;
CREATE POLICY "Company members can view tenancy audit logs"
  ON tenancy_audit_log FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can create tenancy audit logs" ON tenancy_audit_log;
CREATE POLICY "Company members can create tenancy audit logs"
  ON tenancy_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- TENANCY_NOTICES TABLE
-- Section 21, Section 8, rent review and other notices
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenancy_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Notice type
  notice_type TEXT NOT NULL CHECK (notice_type IN (
    'section_21',      -- No-fault eviction notice
    'section_8',       -- Fault-based eviction notice
    'rent_increase',   -- Rent increase notice
    'rent_review',     -- Rent review notification
    'renewal_offer',   -- Offer to renew tenancy
    'end_of_tenancy',  -- End of fixed term notification
    'other'
  )),
  custom_notice_type TEXT,

  -- Notice details
  notice_date DATE NOT NULL,              -- Date notice was created
  effective_date DATE NOT NULL,           -- Date notice takes effect
  served_date DATE,                       -- Date notice was served
  served_method TEXT,                     -- 'email', 'post', 'hand_delivered', 'both'

  -- For rent notices
  current_amount DECIMAL(10, 2),
  new_amount DECIMAL(10, 2),

  -- For section 8
  section_8_grounds TEXT[],               -- Array of grounds used

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'generated',
    'sent',
    'acknowledged',
    'withdrawn',
    'expired',
    'completed'
  )),

  -- Document
  document_url TEXT,
  document_storage_path TEXT,

  -- Notes
  notes_encrypted TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenancy_notices_tenancy_id ON tenancy_notices(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_notices_company_id ON tenancy_notices(company_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_notices_type ON tenancy_notices(notice_type);
CREATE INDEX IF NOT EXISTS idx_tenancy_notices_effective_date ON tenancy_notices(effective_date);

-- Enable RLS
ALTER TABLE tenancy_notices ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "Company members can manage tenancy notices" ON tenancy_notices;
CREATE POLICY "Company members can manage tenancy notices"
  ON tenancy_notices FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Updated at trigger
DROP TRIGGER IF EXISTS update_tenancy_notices_updated_at ON tenancy_notices;
CREATE TRIGGER update_tenancy_notices_updated_at
  BEFORE UPDATE ON tenancy_notices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TENANCY_RENT_CHANGES TABLE
-- History of rent changes for a tenancy
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenancy_rent_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  notice_id UUID REFERENCES tenancy_notices(id) ON DELETE SET NULL,

  -- Rent change details
  previous_rent DECIMAL(10, 2) NOT NULL,
  new_rent DECIMAL(10, 2) NOT NULL,
  effective_date DATE NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN (
    'initial',           -- Initial rent when tenancy started
    'rent_review',       -- Contractual rent review
    'rent_increase',     -- Rent increase notice
    'negotiated',        -- Mutually agreed change
    'error_correction'   -- Correction of error
  )),

  -- Context
  reason TEXT,
  tenant_agreed BOOLEAN DEFAULT TRUE,
  tenant_agreed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenancy_rent_changes_tenancy_id ON tenancy_rent_changes(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tenancy_rent_changes_effective_date ON tenancy_rent_changes(effective_date);

-- Enable RLS
ALTER TABLE tenancy_rent_changes ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "Company members can manage tenancy rent changes" ON tenancy_rent_changes;
CREATE POLICY "Company members can manage tenancy rent changes"
  ON tenancy_rent_changes FOR ALL TO authenticated
  USING (
    tenancy_id IN (
      SELECT id FROM tenancies WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- UPDATE PROPERTY_TENANCIES TABLE
-- Add tenancy_id to link the junction table to actual tenancies
-- ============================================================================
ALTER TABLE property_tenancies
  ADD COLUMN IF NOT EXISTS tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Index for tenancy lookup
CREATE INDEX IF NOT EXISTS idx_property_tenancies_tenancy_id ON property_tenancies(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_property_tenancies_company_id ON property_tenancies(company_id);

-- ============================================================================
-- UPDATE PROPERTIES TABLE
-- Add current_tenancy_id for quick lookup
-- ============================================================================
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS current_tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL;

-- Index for quick current tenancy lookup
CREATE INDEX IF NOT EXISTS idx_properties_current_tenancy ON properties(current_tenancy_id);

-- ============================================================================
-- TRIGGER: Update property status when tenancy starts/ends
-- ============================================================================
CREATE OR REPLACE FUNCTION update_property_on_tenancy_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When tenancy becomes active, mark property as in_tenancy
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
    UPDATE properties
    SET
      status = 'in_tenancy',
      current_tenancy_id = NEW.id,
      updated_at = NOW()
    WHERE id = NEW.property_id;
  END IF;

  -- When tenancy ends, mark property as vacant
  IF NEW.status IN ('ended', 'terminated', 'expired') AND
     (OLD IS NULL OR OLD.status NOT IN ('ended', 'terminated', 'expired')) THEN
    UPDATE properties
    SET
      status = 'vacant',
      current_tenancy_id = NULL,
      updated_at = NOW()
    WHERE id = NEW.property_id
      AND current_tenancy_id = NEW.id; -- Only if this was the current tenancy
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_property_on_tenancy_change ON tenancies;
CREATE TRIGGER trigger_update_property_on_tenancy_change
  AFTER INSERT OR UPDATE OF status ON tenancies
  FOR EACH ROW
  EXECUTE FUNCTION update_property_on_tenancy_change();

-- ============================================================================
-- TRIGGER: Create initial rent change record when tenancy is created
-- ============================================================================
CREATE OR REPLACE FUNCTION create_initial_rent_record()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tenancy_rent_changes (
    tenancy_id,
    previous_rent,
    new_rent,
    effective_date,
    change_type,
    reason,
    created_by
  ) VALUES (
    NEW.id,
    0, -- No previous rent
    NEW.monthly_rent,
    NEW.start_date,
    'initial',
    'Initial tenancy rent',
    NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_initial_rent_record ON tenancies;
CREATE TRIGGER trigger_create_initial_rent_record
  AFTER INSERT ON tenancies
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_rent_record();

-- ============================================================================
-- Notes
-- ============================================================================

-- This schema supports:
-- 1. Multiple tenants per tenancy (joint tenancies)
-- 2. Tenant changes mid-tenancy (one tenant leaves, another joins)
-- 3. Rent change history with proper audit trail
-- 4. Section 21/8 notices with compliance tracking
-- 5. Break clauses
-- 6. Multiple tenancy types (AST, periodic, company let, etc.)
-- 7. Deposit scheme integration
-- 8. Additional charges (pet fees, parking, etc.)
--
-- Workflow:
-- 1. Reference is completed -> Agreement is signed
-- 2. Create tenancy from reference + agreement
-- 3. Copy tenant data to tenancy_tenants
-- 4. Link agreement to tenancy
-- 5. Update property_tenancies with tenancy_id
-- 6. Property status automatically updates via trigger
