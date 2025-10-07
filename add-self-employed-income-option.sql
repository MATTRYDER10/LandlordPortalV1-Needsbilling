-- Add self-employed income option and accountant details to tenant references
-- This migration adds columns to track self-employment as an income source
-- and capture accountant contact information

DO $$
BEGIN
  -- Add income_self_employed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_references'
    AND column_name = 'income_self_employed'
  ) THEN
    ALTER TABLE tenant_references
    ADD COLUMN income_self_employed BOOLEAN DEFAULT false;

    RAISE NOTICE 'Added income_self_employed column to tenant_references table';
  ELSE
    RAISE NOTICE 'income_self_employed column already exists';
  END IF;

  -- Add self-employed business details
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_references'
    AND column_name = 'self_employed_business_name'
  ) THEN
    ALTER TABLE tenant_references
    ADD COLUMN self_employed_business_name TEXT,
    ADD COLUMN self_employed_start_date DATE,
    ADD COLUMN self_employed_nature_of_business TEXT,
    ADD COLUMN self_employed_annual_income DECIMAL(10, 2);

    RAISE NOTICE 'Added self-employed business detail columns to tenant_references table';
  ELSE
    RAISE NOTICE 'Self-employed business detail columns already exist';
  END IF;

  -- Add accountant contact details
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenant_references'
    AND column_name = 'accountant_name'
  ) THEN
    ALTER TABLE tenant_references
    ADD COLUMN accountant_name TEXT,
    ADD COLUMN accountant_contact_name TEXT,
    ADD COLUMN accountant_email TEXT,
    ADD COLUMN accountant_phone TEXT;

    RAISE NOTICE 'Added accountant contact columns to tenant_references table';
  ELSE
    RAISE NOTICE 'Accountant contact columns already exist';
  END IF;
END $$;

-- Add comments to document the columns
COMMENT ON COLUMN tenant_references.income_self_employed IS 'Whether tenant has self-employment income';
COMMENT ON COLUMN tenant_references.self_employed_business_name IS 'Name of self-employed business';
COMMENT ON COLUMN tenant_references.self_employed_start_date IS 'Date when self-employment business started';
COMMENT ON COLUMN tenant_references.self_employed_nature_of_business IS 'Description of the nature of self-employed business';
COMMENT ON COLUMN tenant_references.self_employed_annual_income IS 'Annual income from self-employment';
COMMENT ON COLUMN tenant_references.accountant_name IS 'Name of accountant or accounting firm';
COMMENT ON COLUMN tenant_references.accountant_contact_name IS 'Contact person name at accounting firm';
COMMENT ON COLUMN tenant_references.accountant_email IS 'Email address of accountant';
COMMENT ON COLUMN tenant_references.accountant_phone IS 'Phone number of accountant';
