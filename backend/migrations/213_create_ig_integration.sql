CREATE TABLE IF NOT EXISTS ig_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  tenancy_id UUID NOT NULL REFERENCES tenancies(id),
  property_id UUID REFERENCES properties(id),
  ig_appointment_id TEXT NOT NULL,
  ig_report_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('inventory', 'checkout', 'mid_term')),
  status TEXT NOT NULL DEFAULT 'scheduled',
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT NOT NULL,
  assessor_id TEXT,
  assessor_name TEXT,
  assessor_initials TEXT,
  report_url TEXT,
  pdf_url TEXT,
  signed_at TIMESTAMPTZ,
  signatories JSONB,
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ig_appointments_tenancy ON ig_appointments(tenancy_id);
CREATE INDEX idx_ig_appointments_company ON ig_appointments(company_id);

ALTER TABLE company_integrations
  ADD COLUMN IF NOT EXISTS ig_api_key_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS ig_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ig_last_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ig_last_test_status VARCHAR(20);
