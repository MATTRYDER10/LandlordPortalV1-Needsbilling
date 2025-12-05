-- Fix: Update trigger to skip company creation for invited users
-- Invited users already have a company association created by the invitation acceptance code

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

  -- Create company (name_encrypted will be NULL for now, can be updated later via backend)
  INSERT INTO companies (name_encrypted, created_at, updated_at)
  VALUES (NULL, NOW(), NOW())
  RETURNING id INTO new_company_id;

  -- Link user to company as owner
  INSERT INTO company_users (user_id, company_id, role, created_at)
  VALUES (NEW.id, new_company_id, 'owner', NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: No need to recreate trigger - it will use the updated function
