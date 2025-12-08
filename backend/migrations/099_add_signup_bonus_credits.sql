-- Add 2 free signup bonus credits for new companies
-- Updates the handle_new_user() trigger to:
-- 1. Set initial reference_credits to 2
-- 2. Create a credit transaction record for audit trail

-- First, add 'signup_bonus' to the allowed transaction types
ALTER TABLE public.credit_transactions
DROP CONSTRAINT IF EXISTS credit_transactions_type_check;

ALTER TABLE public.credit_transactions
ADD CONSTRAINT credit_transactions_type_check CHECK (type IN (
  'subscription_credit',
  'pack_purchase',
  'credit_used',
  'auto_recharge',
  'manual_adjustment',
  'refund',
  'signup_bonus'
));

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  company_name_value TEXT;
  new_company_id UUID;
  is_invited BOOLEAN;
BEGIN
  -- Check if user is invited (should skip company creation)
  is_invited := COALESCE((NEW.raw_user_meta_data->>'is_invited')::boolean, false);

  -- Skip company creation for invited users - they will be added to existing company
  IF is_invited THEN
    RETURN NEW;
  END IF;

  -- Get company name from user metadata
  company_name_value := NEW.raw_user_meta_data->>'company_name';

  -- If no company name provided, use email prefix
  IF company_name_value IS NULL OR company_name_value = '' THEN
    company_name_value := split_part(NEW.email, '@', 1) || '''s Company';
  END IF;

  -- Create company with 2 free signup credits
  INSERT INTO public.companies (name_encrypted, reference_credits, created_at, updated_at)
  VALUES (NULL, 2, NOW(), NOW())
  RETURNING id INTO new_company_id;

  -- Link user to company as owner
  INSERT INTO public.company_users (user_id, company_id, role, created_at)
  VALUES (NEW.id, new_company_id, 'owner', NOW());

  -- Log the signup bonus credit transaction for billing history
  INSERT INTO public.credit_transactions (company_id, type, credits_change, credits_balance_after, description, created_at)
  VALUES (new_company_id, 'signup_bonus', 2, 2, 'Welcome bonus: 2 free credits', NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: No need to recreate trigger - it will use the updated function
