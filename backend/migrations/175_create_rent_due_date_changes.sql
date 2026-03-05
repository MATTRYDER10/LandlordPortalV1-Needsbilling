-- Migration 175: Create Rent Due Date Changes Table
-- Tracks requests to change a tenant's rent due date with pro-rata payment workflow

CREATE TABLE IF NOT EXISTS rent_due_date_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Date change details
  current_due_day INTEGER NOT NULL CHECK (current_due_day >= 1 AND current_due_day <= 28),
  new_due_day INTEGER NOT NULL CHECK (new_due_day >= 1 AND new_due_day <= 28),

  -- The month/year when the change takes effect (first rent payment on new date)
  effective_month INTEGER NOT NULL CHECK (effective_month >= 1 AND effective_month <= 12),
  effective_year INTEGER NOT NULL,

  -- Financial calculations
  monthly_rent DECIMAL(10, 2) NOT NULL,
  pro_rata_days INTEGER NOT NULL,
  daily_rate DECIMAL(10, 4) NOT NULL,  -- (rent × 12 / days_in_year)
  pro_rata_amount DECIMAL(10, 2) NOT NULL,
  admin_fee DECIMAL(10, 2) DEFAULT 0 CHECK (admin_fee >= 0 AND admin_fee <= 50),  -- Tenant Fee Ban Act 2019
  total_amount DECIMAL(10, 2) NOT NULL,

  -- Workflow status
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
    'pending_payment',    -- Email sent to lead tenant, awaiting payment
    'payment_confirmed',  -- Tenant clicked "I've Paid", awaiting agent verification
    'activated',          -- Agent activated, rent_due_day updated
    'cancelled'           -- Cancelled before activation
  )),

  -- Lead tenant who receives payment request
  lead_tenant_id UUID REFERENCES tenancy_tenants(id),
  lead_tenant_email_encrypted TEXT,

  -- Confirmation token for tenant "I've Paid" link
  confirmation_token UUID DEFAULT gen_random_uuid(),

  -- Timestamps for workflow stages
  email_sent_at TIMESTAMP WITH TIME ZONE,
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  tenant_confirmed_at TIMESTAMP WITH TIME ZONE,
  agent_verified_at TIMESTAMP WITH TIME ZONE,
  activated_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_reason TEXT,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  activated_by UUID REFERENCES auth.users(id),
  cancelled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rent_due_date_changes_tenancy ON rent_due_date_changes(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_rent_due_date_changes_company ON rent_due_date_changes(company_id);
CREATE INDEX IF NOT EXISTS idx_rent_due_date_changes_status ON rent_due_date_changes(status);
CREATE INDEX IF NOT EXISTS idx_rent_due_date_changes_token ON rent_due_date_changes(confirmation_token);
CREATE INDEX IF NOT EXISTS idx_rent_due_date_changes_pending ON rent_due_date_changes(tenancy_id)
  WHERE status IN ('pending_payment', 'payment_confirmed');

-- Enable RLS
ALTER TABLE rent_due_date_changes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company's rent due date changes"
  ON rent_due_date_changes FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert rent due date changes for their company"
  ON rent_due_date_changes FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their company's rent due date changes"
  ON rent_due_date_changes FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_rent_due_date_changes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rent_due_date_changes_updated_at
  BEFORE UPDATE ON rent_due_date_changes
  FOR EACH ROW
  EXECUTE FUNCTION update_rent_due_date_changes_updated_at();

-- Add comment
COMMENT ON TABLE rent_due_date_changes IS 'Tracks rent due date change requests with pro-rata payment workflow';
