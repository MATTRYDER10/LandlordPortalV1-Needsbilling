-- Migration 185: Create Tenant Change Payments Table
-- Separate payment records for Change of Tenant fees and pro-rata amounts

CREATE TABLE IF NOT EXISTS tenant_change_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_change_id UUID NOT NULL REFERENCES tenant_changes(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL REFERENCES tenancies(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Payment type
  payment_type TEXT NOT NULL CHECK (payment_type IN (
    'change_of_tenant_fee',  -- £50 admin fee
    'pro_rata_outgoing',     -- Overpayment refund to outgoing tenant
    'pro_rata_incoming'      -- Partial month payment from incoming tenant
  )),

  -- Amounts
  amount_due DECIMAL(10,2) NOT NULL CHECK (amount_due >= 0),
  amount_received DECIMAL(10,2) CHECK (amount_received >= 0),

  -- Payment party
  due_from_name TEXT,
  due_from_email TEXT,
  payment_reference TEXT,

  -- Bank details used for this payment
  bank_name TEXT,
  sort_code TEXT,
  account_number TEXT,

  -- Tracking
  invoice_sent_at TIMESTAMP WITH TIME ZONE,
  received_at TIMESTAMP WITH TIME ZONE,
  received_by UUID REFERENCES auth.users(id),
  notes TEXT,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tc_payments_tenant_change ON tenant_change_payments(tenant_change_id);
CREATE INDEX IF NOT EXISTS idx_tc_payments_tenancy ON tenant_change_payments(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_tc_payments_company ON tenant_change_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_tc_payments_type ON tenant_change_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_tc_payments_pending ON tenant_change_payments(tenant_change_id)
  WHERE received_at IS NULL;

-- Enable Row Level Security
ALTER TABLE tenant_change_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company's tenant change payments"
  ON tenant_change_payments FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert tenant change payments for their company"
  ON tenant_change_payments FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their company's tenant change payments"
  ON tenant_change_payments FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid()
  ));

CREATE POLICY "Service role full access to tenant_change_payments"
  ON tenant_change_payments FOR ALL
  USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_tenant_change_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tenant_change_payments_updated_at
  BEFORE UPDATE ON tenant_change_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_change_payments_updated_at();

-- Add comment
COMMENT ON TABLE tenant_change_payments IS 'Tracks individual payment records for Change of Tenant workflow including fees and pro-rata calculations';
