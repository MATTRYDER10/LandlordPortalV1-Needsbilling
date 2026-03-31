-- ============================================================================
-- RentGoose Module — Database Migration
-- ============================================================================

-- Add fee fields to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fee_percent DECIMAL(5,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS fee_type TEXT CHECK (fee_type IN ('management_fee', 'letting_fee', 'both'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS letting_fee_amount DECIMAL(10,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS letting_fee_type TEXT CHECK (letting_fee_type IN ('fixed', 'percentage'));

-- Contractors table
CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  bank_account_name_encrypted TEXT,
  bank_account_number_encrypted TEXT,
  bank_sort_code_encrypted TEXT,
  commission_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  commission_vat BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rent Schedule Entries
CREATE TABLE IF NOT EXISTS rent_schedule_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tenancy_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount_due DECIMAL(10,2) NOT NULL,
  amount_received DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'due', 'overdue', 'partial', 'paid', 'cancelled')),
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rent Payments
CREATE TABLE IF NOT EXISTS rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  schedule_entry_id UUID NOT NULL REFERENCES rent_schedule_entries(id) ON DELETE CASCADE,
  tenant_id UUID,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'standing_order', 'cash', 'card', 'other')),
  date_received DATE NOT NULL,
  reference TEXT,
  created_by UUID,
  client_account_entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rent Share Allocations (HMO)
CREATE TABLE IF NOT EXISTS rent_share_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  schedule_entry_id UUID NOT NULL REFERENCES rent_schedule_entries(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  share_percent DECIMAL(5,2) NOT NULL,
  amount_due DECIMAL(10,2) NOT NULL,
  amount_received DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
  override_for_this_period BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent Charges
CREATE TABLE IF NOT EXISTS agent_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  schedule_entry_id UUID NOT NULL REFERENCES rent_schedule_entries(id) ON DELETE CASCADE,
  charge_type TEXT NOT NULL CHECK (charge_type IN ('management_fee', 'letting_fee', 'contractor_commission', 'ad_hoc')),
  description TEXT NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  gross_amount DECIMAL(10,2) NOT NULL,
  included BOOLEAN NOT NULL DEFAULT true,
  contractor_invoice_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payout Records (immutable once created)
CREATE TABLE IF NOT EXISTS payout_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  schedule_entry_id UUID NOT NULL REFERENCES rent_schedule_entries(id) ON DELETE CASCADE,
  landlord_id UUID,
  contractor_id UUID,
  payout_type TEXT NOT NULL DEFAULT 'landlord' CHECK (payout_type IN ('landlord', 'contractor')),
  gross_rent DECIMAL(10,2) NOT NULL,
  total_charges DECIMAL(10,2) NOT NULL DEFAULT 0,
  net_payout DECIMAL(10,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_by UUID,
  statement_pdf_path TEXT,
  statement_sent_at TIMESTAMPTZ,
  client_account_entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contractor Invoices
CREATE TABLE IF NOT EXISTS contractor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  property_id UUID,
  tenancy_id UUID,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  gross_amount DECIMAL(10,2) NOT NULL,
  commission_percent DECIMAL(5,2) NOT NULL,
  commission_vat BOOLEAN NOT NULL DEFAULT false,
  commission_net DECIMAL(10,2) NOT NULL,
  commission_vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payout_to_contractor DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'charged', 'paid')),
  uploaded_by UUID,
  pdf_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Client Account Entries (immutable audit log)
CREATE TABLE IF NOT EXISTS client_account_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('rent_in', 'payout_out', 'contractor_payout_out', 'deposit_in', 'deposit_out', 'manual_credit', 'manual_debit', 'opening_balance', 'reconciliation_checkpoint')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  related_id UUID,
  related_type TEXT,
  balance_after DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_by UUID,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Arrears Chases
CREATE TABLE IF NOT EXISTS arrears_chases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  schedule_entry_id UUID NOT NULL REFERENCES rent_schedule_entries(id) ON DELETE CASCADE,
  tenant_id UUID,
  guarantor_id UUID,
  amount_outstanding DECIMAL(10,2) NOT NULL,
  partial_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  partial_paid_date DATE,
  day7_sent_at TIMESTAMPTZ,
  day14_sent_at TIMESTAMPTZ,
  day21_sent_at TIMESTAMPTZ,
  day28_sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'legal')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Arrears Email Templates (editable by agency)
CREATE TABLE IF NOT EXISTS arrears_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  day_trigger INTEGER NOT NULL CHECK (day_trigger IN (7, 14, 21, 28)),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, day_trigger)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rent_schedule_tenancy ON rent_schedule_entries(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_rent_schedule_status ON rent_schedule_entries(status);
CREATE INDEX IF NOT EXISTS idx_rent_schedule_due_date ON rent_schedule_entries(due_date);
CREATE INDEX IF NOT EXISTS idx_rent_schedule_company ON rent_schedule_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_schedule ON rent_payments(schedule_entry_id);
CREATE INDEX IF NOT EXISTS idx_rent_payments_company ON rent_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_rent_share_schedule ON rent_share_allocations(schedule_entry_id);
CREATE INDEX IF NOT EXISTS idx_agent_charges_schedule ON agent_charges(schedule_entry_id);
CREATE INDEX IF NOT EXISTS idx_payout_records_schedule ON payout_records(schedule_entry_id);
CREATE INDEX IF NOT EXISTS idx_payout_records_landlord ON payout_records(landlord_id);
CREATE INDEX IF NOT EXISTS idx_payout_records_company ON payout_records(company_id);
CREATE INDEX IF NOT EXISTS idx_contractor_invoices_contractor ON contractor_invoices(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_invoices_company ON contractor_invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_client_account_company ON client_account_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_client_account_type ON client_account_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_arrears_chases_schedule ON arrears_chases(schedule_entry_id);
CREATE INDEX IF NOT EXISTS idx_arrears_chases_status ON arrears_chases(status);
CREATE INDEX IF NOT EXISTS idx_arrears_chases_company ON arrears_chases(company_id);
CREATE INDEX IF NOT EXISTS idx_contractors_company ON contractors(company_id);

-- Enable RLS on all new tables
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_share_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_account_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE arrears_chases ENABLE ROW LEVEL SECURITY;
ALTER TABLE arrears_email_templates ENABLE ROW LEVEL SECURITY;
