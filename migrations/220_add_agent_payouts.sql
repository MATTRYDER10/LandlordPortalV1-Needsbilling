CREATE TABLE IF NOT EXISTS agent_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  total_gross DECIMAL(10,2) NOT NULL,
  total_net DECIMAL(10,2) NOT NULL,
  total_vat DECIMAL(10,2) NOT NULL DEFAULT 0,
  charge_count INTEGER NOT NULL DEFAULT 0,
  paid_by UUID,
  client_account_entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_payouts_company ON agent_payouts(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_payouts_created ON agent_payouts(created_at DESC);

ALTER TABLE agent_charges ADD COLUMN IF NOT EXISTS agent_payout_id UUID REFERENCES agent_payouts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_agent_charges_payout ON agent_charges(agent_payout_id);
