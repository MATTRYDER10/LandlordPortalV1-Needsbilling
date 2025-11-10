# QUICK FIX: Create Landlords Table

## The Error
```
Could not find the table 'public.landlords' in the schema cache
```

This means the `landlords` table doesn't exist in your Supabase database yet.

## Solution: Run the Migration

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click on **"SQL Editor"** in the left sidebar

### Step 2: Run the Migration
1. Click **"New Query"** button
2. Copy the ENTIRE contents of `backend/migrations/RUN_LANDLORD_MIGRATIONS.sql`
3. Paste it into the SQL Editor
4. Click **"Run"** button (or press Ctrl+Enter / Cmd+Enter)

### Step 3: Verify Tables Were Created
1. Go to **"Table Editor"** in the left sidebar
2. You should see these new tables:
   - `landlords`
   - `landlord_properties`
   - `landlord_aml_checks`

### Step 4: Restart Your Backend Server
After running the migration:
1. Stop your backend server (Ctrl+C)
2. Wait 10-30 seconds for Supabase schema cache to refresh
3. Start your backend server again: `npm run dev` (or `npm start`)

### Step 5: Test the API
Try your POST request again:
```
POST http://localhost:3001/api/landlords
```

## Alternative: Run Individual Migrations

If the combined file doesn't work, run them separately:

1. First run: `backend/migrations/056_create_landlords_table.sql`
2. Then run: `backend/migrations/057_create_landlord_aml_checks_table.sql`

## Still Having Issues?

If you still get the error after running migrations:
1. Check the SQL Editor for any error messages
2. Verify the tables exist in Table Editor
3. Wait longer (up to 1 minute) for schema cache refresh
4. Restart your backend server
5. Check your Supabase connection settings in `.env`

