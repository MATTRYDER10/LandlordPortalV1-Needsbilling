ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS deposit_paid_out_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS deposit_paid_out_amount DECIMAL(10,2);
ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS deposit_paid_out_notes TEXT;
