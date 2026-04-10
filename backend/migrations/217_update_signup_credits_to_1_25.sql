CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  company_name_value TEXT;
  new_company_id UUID;
  is_invited BOOLEAN;
BEGIN
  is_invited := COALESCE((NEW.raw_user_meta_data->>'is_invited')::boolean, false);

  IF is_invited THEN
    RETURN NEW;
  END IF;

  company_name_value := NEW.raw_user_meta_data->>'company_name';

  IF company_name_value IS NULL OR company_name_value = '' THEN
    company_name_value := split_part(NEW.email, '@', 1) || '''s Company';
  END IF;

  INSERT INTO public.companies (name_encrypted, reference_credits, created_at, updated_at)
  VALUES (NULL, 1.25, NOW(), NOW())
  RETURNING id INTO new_company_id;

  INSERT INTO public.company_users (user_id, company_id, role, created_at)
  VALUES (NEW.id, new_company_id, 'owner', NOW());

  INSERT INTO public.credit_transactions (company_id, type, credits_change, credits_balance_after, description, created_at)
  VALUES (new_company_id, 'signup_bonus', 1.25, 1.25, 'Welcome bonus: 1.25 free credits', NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
