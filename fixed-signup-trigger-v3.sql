-- Fixed Signup Trigger (Version 3)
-- This version has corrected PostgreSQL syntax
-- Run this in Supabase SQL Editor

-- 1. Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- 2. Create the corrected function with proper exception handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  new_company_id UUID;
  company_name_value TEXT;
BEGIN
  -- Get company name from metadata, with fallback
  company_name_value := COALESCE(
    NEW.raw_user_meta_data->>'company_name',
    'My Company'
  );

  -- Create company and link user
  INSERT INTO companies (name)
  VALUES (company_name_value)
  RETURNING id INTO new_company_id;

  -- Link user to company as owner
  INSERT INTO company_users (company_id, user_id, role)
  VALUES (new_company_id, NEW.id, 'owner');

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but allow user creation to proceed
    RAISE LOG 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 4. Grant necessary permissions to ensure trigger can access tables
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
