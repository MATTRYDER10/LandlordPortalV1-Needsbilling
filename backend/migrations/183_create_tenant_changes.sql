-- Migration 183: Create Tenant Changes Table
-- Tracks Change of Tenant (Sharer) workflow - 7-stage process for replacing tenants on existing tenancies

CREATE TABLE IF NOT EXISTS tenant_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Workflow state (1-7)
  stage INTEGER NOT NULL DEFAULT 1 CHECK (stage >= 1 AND stage <= 7),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),

  -- Stage 1: Tenant selection
  outgoing_tenant_ids UUID[] DEFAULT '{}',
  incoming_tenants JSONB DEFAULT '[]',
  -- Format: [{title, firstName, lastName, email, phone, dob, currentAddress, hasGuarantor, guarantor:{title, firstName, lastName, email, phone, address}}]

  expected_move_out_date DATE,
  expected_move_in_date DATE,

  -- Stage 2: Referencing
  referencing_skipped BOOLEAN DEFAULT FALSE,
  referencing_overridden BOOLEAN DEFAULT FALSE,
  referencing_override_reason TEXT,
  incoming_tenant_reference_ids UUID[] DEFAULT '{}',

  -- Stage 3: Fee & Date
  changeover_date DATE,
  fee_amount DECIMAL(10,2) DEFAULT 50.00 CHECK (fee_amount >= 0),
  fee_waived BOOLEAN DEFAULT FALSE,
  fee_waived_reason TEXT,
  fee_above_50_justification TEXT, -- Required if fee_amount > 50 (Tenant Fee Ban Act)
  fee_payable_by TEXT DEFAULT 'outgoing' CHECK (fee_payable_by IN ('outgoing', 'incoming', 'split')),
  payment_reference TEXT,

  -- Bank details (defaults from company, editable per transaction)
  bank_name TEXT,
  sort_code TEXT,
  account_number TEXT,

  -- Pro-rata calculation
  pro_rata_outgoing DECIMAL(10,2) DEFAULT 0,
  pro_rata_incoming DECIMAL(10,2) DEFAULT 0,

  -- Invoice tracking
  fee_invoice_sent_at TIMESTAMP WITH TIME ZONE,
  fee_invoice_sent_to TEXT,
  fee_received_at TIMESTAMP WITH TIME ZONE,
  fee_received_by UUID REFERENCES auth.users(id),
  fee_received_amount DECIMAL(10,2),
  fee_received_notes TEXT,

  -- Stage 4-5: Addendum
  addendum_document_id UUID,
  addendum_pdf_url TEXT,
  addendum_sent_at TIMESTAMP WITH TIME ZONE,
  addendum_fully_signed_at TIMESTAMP WITH TIME ZONE,
  signed_addendum_pdf_url TEXT,

  -- Stage 6: Completion
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES auth.users(id),

  -- Stage 7: Post-completion checklist
  checklist_deposit_updated BOOLEAN DEFAULT FALSE,
  checklist_deposit_updated_at TIMESTAMP WITH TIME ZONE,
  checklist_prescribed_info_sent BOOLEAN DEFAULT FALSE,
  checklist_prescribed_info_sent_at TIMESTAMP WITH TIME ZONE,
  checklist_deposit_share_confirmed BOOLEAN DEFAULT FALSE,
  checklist_deposit_share_confirmed_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_changes_tenancy ON tenant_changes(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tenant_changes_company ON tenant_changes(company_id);
CREATE INDEX IF NOT EXISTS idx_tenant_changes_status ON tenant_changes(status);
CREATE INDEX IF NOT EXISTS idx_tenant_changes_stage ON tenant_changes(stage);
CREATE INDEX IF NOT EXISTS idx_tenant_changes_in_progress ON tenant_changes(tenancy_id)
  WHERE status = 'in_progress';

-- Enable Row Level Security
ALTER TABLE tenant_changes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company's tenant changes"
  ON tenant_changes FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert tenant changes for their company"
  ON tenant_changes FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their company's tenant changes"
  ON tenant_changes FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role full access to tenant_changes"
  ON tenant_changes FOR ALL
  USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_tenant_changes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tenant_changes_updated_at
  BEFORE UPDATE ON tenant_changes
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_changes_updated_at();

-- Add comment
COMMENT ON TABLE tenant_changes IS 'Tracks Change of Tenant (Sharer) workflows with 7-stage process: tenant selection, referencing, fee collection, addendum generation, signing, completion, and post-completion checklist';
