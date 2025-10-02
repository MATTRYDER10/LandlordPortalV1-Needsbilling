-- Fix existing user without company
-- This creates a company for users who signed up before the trigger was added

DO $$
DECLARE
  v_user_id UUID := '639bf892-8408-4d25-8a37-9c9c52d656b9';
  v_company_id UUID;
BEGIN
  -- Check if user already has a company
  IF EXISTS (SELECT 1 FROM company_users WHERE user_id = v_user_id) THEN
    RAISE NOTICE 'User already has a company';
  ELSE
    -- Create a company
    INSERT INTO companies (name)
    VALUES ('PropertyGoose Company')
    RETURNING id INTO v_company_id;

    -- Link user to company as owner
    INSERT INTO company_users (company_id, user_id, role)
    VALUES (v_company_id, v_user_id, 'owner');

    RAISE NOTICE 'Company created and user linked successfully';
  END IF;
END $$;
