-- Verify Database Setup for PropertyGoose
-- Run this in Supabase SQL Editor to check if everything is set up correctly

-- 1. Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('companies', 'company_users', 'invitations')
ORDER BY table_name;

-- 2. Check if the user_role enum exists
SELECT enumlabel
FROM pg_enum
JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
WHERE pg_type.typname = 'user_role';

-- 3. Check if the trigger exists
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- 4. Check if the function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'handle_new_user'
AND routine_schema = 'public';

-- 5. Test if we can insert into companies table (should work)
-- This is just a test - comment out after running
-- INSERT INTO companies (name) VALUES ('Test Company') RETURNING id;
-- DELETE FROM companies WHERE name = 'Test Company';
