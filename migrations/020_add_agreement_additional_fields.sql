-- Add missing fields to agreements table (only those not already present)
ALTER TABLE agreements
ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS bank_sort_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS tenant_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS landlord_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS agent_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS management_type VARCHAR(20),
ADD COLUMN IF NOT EXISTS break_clause TEXT,
ADD COLUMN IF NOT EXISTS special_clauses TEXT;
