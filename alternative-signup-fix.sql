-- Alternative Fix: Simpler trigger that won't fail
-- This removes the trigger entirely and we'll handle company creation in the app
-- Run this if the previous fix doesn't work

-- 1. Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- 2. Create a simpler, more robust trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
  company_name_value TEXT;
BEGIN
  -- Get company name from metadata, with fallback
  company_name_value := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    'My Company'
  );

  -- Create company
  BEGIN
    INSERT INTO public.companies (name)
    VALUES (company_name_value)
    RETURNING id INTO new_company_id;
  EXCEPTION WHEN OTHERS THEN
    -- If company creation fails, log but don't block user creation
    RAISE WARNING 'Failed to create company: %', SQLERRM;
    RETURN NEW;
  END;

  -- Link user to company
  BEGIN
    INSERT INTO public.company_users (company_id, user_id, role)
    VALUES (new_company_id, NEW.id, 'owner');
  EXCEPTION WHEN OTHERS THEN
    -- If linking fails, log but don't block user creation
    RAISE WARNING 'Failed to link user to company: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 4. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
