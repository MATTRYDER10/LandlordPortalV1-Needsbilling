# Staff User Management

This guide explains how to add, manage, and remove staff users who can access the staff portal at `/staff/dashboard`.

## Prerequisites

1. The `staff_users` table must exist in your database (run migration `022_create_staff_users_table.sql` if needed)
2. You need the Supabase service role key (already in your `.env` file)

## Adding a New Staff User

### Method 1: Using the Script (Easiest)

From the `backend` directory, run:

```bash
npm run add-staff-user <email> <password> "<full-name>"
```

**Example:**
```bash
npm run add-staff-user john@example.com SecurePass123 "John Smith"
```

This will:
1. Create a user in Supabase Auth
2. Create a staff user record in the `staff_users` table
3. Display the login credentials

The user can then log in at: `http://localhost:5173/staff/login`

### Method 2: Manual SQL (Advanced)

If you prefer to do it manually:

#### Step 1: Create user in Supabase Dashboard
1. Go to: https://spaetpdmlqfygsxiawul.supabase.co/project/spaetpdmlqfygsxiawul/auth/users
2. Click "Add user"
3. Enter email and password
4. Note the UUID of the created user

#### Step 2: Insert staff user record

```sql
INSERT INTO staff_users (user_id, full_name, email, is_active)
VALUES (
  'USER_UUID_HERE',           -- Replace with UUID from Step 1
  'John Smith',               -- Staff member's full name
  'john@example.com',         -- Staff member's email
  true                        -- Make them active
);
```

## Managing Staff Users

### Deactivate a staff user (without deleting)

```sql
UPDATE staff_users
SET is_active = false
WHERE email = 'staff@example.com';
```

### Reactivate a staff user

```sql
UPDATE staff_users
SET is_active = true
WHERE email = 'staff@example.com';
```

### List all staff users

```sql
SELECT
  s.id,
  s.full_name,
  s.email,
  s.is_active,
  s.created_at,
  u.email as auth_email
FROM staff_users s
JOIN auth.users u ON s.user_id = u.id
ORDER BY s.created_at DESC;
```

### Delete a staff user

```sql
-- This will also delete the auth.users record due to CASCADE
DELETE FROM staff_users WHERE email = 'staff@example.com';
```

## How Staff Authentication Works

1. Staff member logs in at `/staff/login` using their email/password
2. Supabase authenticates them and returns a JWT token
3. The backend middleware (`staffAuth.ts`) checks:
   - Is the token valid?
   - Does a record exist in `staff_users` for this user?
   - Is the staff user active (`is_active = true`)?
4. If all checks pass, they can access staff routes

## Security Notes

- Staff users are completely separate from company users
- Staff can view ALL references across ALL companies
- Only active staff users (`is_active = true`) can access the staff portal
- Deactivating a staff user immediately revokes their access
