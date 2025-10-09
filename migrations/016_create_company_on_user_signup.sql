-- Create function to handle user signup and create company
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  company_name_value TEXT;
  new_company_id UUID;
BEGIN
  -- Get company name from user metadata
  company_name_value := NEW.raw_user_meta_data->>'company_name';

  -- If no company name provided, use email prefix
  IF company_name_value IS NULL OR company_name_value = '' THEN
    company_name_value := split_part(NEW.email, '@', 1) || '''s Company';
  END IF;

  -- Create company (name_encrypted will be NULL for now, can be updated later via backend)
  -- Store company name temporarily in a metadata field or create with default
  INSERT INTO companies (name_encrypted, created_at, updated_at)
  VALUES (NULL, NOW(), NOW())
  RETURNING id INTO new_company_id;

  -- Link user to company as owner
  INSERT INTO company_users (user_id, company_id, role, created_at)
  VALUES (NEW.id, new_company_id, 'owner', NOW());

  -- Store the company name in user metadata for later encryption by backend
  -- This will be picked up when user first logs in

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to run function on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
