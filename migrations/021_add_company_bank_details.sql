-- Add bank details to companies table for agent payments
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS bank_sort_code VARCHAR(20);
