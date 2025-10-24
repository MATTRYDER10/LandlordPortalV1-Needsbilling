-- Instructions to add a new staff user
-- =====================================
--
-- Step 1: Create the user in Supabase Auth (if they don't exist)
-- You need to do this via the Supabase dashboard or create a signup page
-- Go to: https://spaetpdmlqfygsxiawul.supabase.co/project/spaetpdmlqfygsxiawul/auth/users
-- Click "Add user" and create the user with email/password
--
-- Step 2: Get the user's UUID from auth.users
-- After creating the user in Step 1, you'll see their UUID in the dashboard
-- OR you can query it with:

-- SELECT id, email FROM auth.users WHERE email = 'staff@example.com';

-- Step 3: Insert the staff user record
-- Replace the values below with the actual user_id (UUID from Step 2), name, and email

INSERT INTO staff_users (user_id, full_name, email, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000000', -- Replace with actual user_id UUID from auth.users
  'Staff Name',                            -- Replace with staff member's full name
  'staff@example.com',                     -- Replace with staff member's email
  true                                      -- Set to true to make them active
);

-- Example:
-- INSERT INTO staff_users (user_id, full_name, email, is_active)
-- VALUES (
--   'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
--   'John Smith',
--   'john.smith@propertygoose.com',
--   true
-- );

-- To deactivate a staff user (without deleting):
-- UPDATE staff_users SET is_active = false WHERE email = 'staff@example.com';

-- To reactivate a staff user:
-- UPDATE staff_users SET is_active = true WHERE email = 'staff@example.com';

-- To list all staff users:
-- SELECT s.*, u.email as auth_email
-- FROM staff_users s
-- JOIN auth.users u ON s.user_id = u.id
-- ORDER BY s.created_at DESC;
