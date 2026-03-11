ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS holding_deposit_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS holding_deposit_received_at TIMESTAMP WITH TIME ZONE;
