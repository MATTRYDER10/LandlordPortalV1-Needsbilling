# PropertyGoose Admin Panel Documentation

## Overview

The PropertyGoose Admin Panel is a comprehensive administrative interface for managing the platform, tracking analytics, and managing staff accounts. It provides real-time insights into business operations, revenue, and reference processing.

## Features

### 1. Analytics Dashboard
- **Reference Statistics**: Track references submitted and completed (today, yesterday, or custom date)
- **Business Growth**: Monitor new business signups with date filtering
- **Revenue Tracking**: View total revenue from credit purchases and agreement payments
- **Platform Metrics**: See total companies, references, and active staff at a glance
- **Recent Companies**: List of newest businesses with owner information and onboarding status

### 2. Staff Management
- **Create Staff Accounts**: Add new PropertyGoose staff members with optional admin privileges
- **Staff List**: View all staff members with role and status information
- **Account Control**: Activate/deactivate staff accounts
- **Role Management**: Grant or revoke admin privileges

## Setup Instructions

### Step 1: Run Database Migration

The admin panel requires an `is_admin` column in the `staff_users` table.

**Option A: Using Supabase Dashboard**
1. Log into your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the migration file: `backend/migrations/098_add_admin_role_to_staff.sql`

**Option B: Using psql**
```bash
psql <your-database-connection-string> -f backend/migrations/098_add_admin_role_to_staff.sql
```

### Step 2: Create Your First Admin User

After running the migration, you need to designate at least one staff user as an admin.

**Using Supabase Dashboard:**
1. Go to Table Editor → `staff_users`
2. Find your staff user record
3. Set `is_admin` to `true`

**Using SQL:**
```sql
UPDATE staff_users
SET is_admin = true
WHERE email = 'your-admin-email@propertygoose.com';
```

### Step 3: Deploy Changes

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
# Or for development:
npm run dev
```

## How to Use

### Accessing the Admin Panel

1. **Login**: Navigate to `/staff/login`
2. **Enter Credentials**: Use your admin staff account credentials
3. **Access Dashboard**: Once logged in, navigate to `/admin/dashboard`

The system automatically detects admin privileges based on the `is_admin` flag in the database.

### Admin Dashboard (`/admin/dashboard`)

#### Date Filtering
- **Today**: View statistics for the current day
- **Yesterday**: View statistics for the previous day
- **Custom Date**: Select any specific date from the calendar picker

#### Statistics Cards
1. **References Submitted**: Total references created in the selected date range
2. **References Completed**: References marked as completed by staff
3. **New Businesses**: Companies that signed up in the date range
4. **Total Revenue**: Combined revenue from credit purchases and agreement payments

#### Platform Totals
Displays overall metrics regardless of date filter:
- Total number of companies registered
- Total references processed
- Number of active staff members

#### Recent Companies Table
Shows the 20 most recent companies with:
- **Company Name**: Business name (encrypted in database)
- **Owner**: Full name of the company owner
- **Email**: Contact email for the owner
- **Credits**: Current credit balance
- **Onboarding**: Whether onboarding is complete
- **Joined**: Registration date

### Staff Management (`/admin/staff`)

#### Creating Staff Accounts

1. Click **"Create Staff Account"** button
2. Fill in the form:
   - **Full Name**: Staff member's full name
   - **Email**: Work email address (must be unique)
   - **Password**: Minimum 8 characters
   - **Grant Admin Privileges**: Check to make this user an admin
3. Click **"Create Account"**

The new staff member can immediately log in at `/staff/login`.

#### Managing Existing Staff

**Activate/Deactivate:**
- Click "Deactivate" to prevent a staff member from logging in
- Click "Activate" to restore access
- Deactivated accounts retain all data but cannot authenticate

**Admin Privileges:**
- Click "Make Admin" to grant admin access
- Click "Remove Admin" to revoke admin access
- Admin users can access `/admin/*` routes; regular staff cannot

#### Staff Table Columns
- **Name**: Full name of the staff member
- **Email**: Login email address
- **Role**: Badge showing "Admin" (purple) or "Staff" (blue)
- **Status**: "Active" (green) or "Inactive" (red)
- **Created**: Date the account was created
- **Actions**: Quick links to modify account

## API Documentation

All admin endpoints require authentication with an admin staff account. Include the bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

### Dashboard & Statistics

#### Get Dashboard Overview
```http
GET /api/admin/dashboard
```

**Response:**
```json
{
  "today": {
    "referencesSubmitted": 15,
    "referencesCompleted": 8,
    "newBusinesses": 3,
    "revenue": "450.00"
  },
  "yesterday": {
    "referencesSubmitted": 12,
    "referencesCompleted": 10,
    "newBusinesses": 2,
    "revenue": "380.00"
  },
  "totals": {
    "companies": 145,
    "references": 892,
    "activeStaff": 5
  }
}
```

#### Get Reference Statistics
```http
GET /api/admin/statistics/references?date=<today|yesterday|YYYY-MM-DD>
```

**Query Parameters:**
- `date` (optional): `today`, `yesterday`, or ISO date format (e.g., `2024-03-15`)

**Response:**
```json
{
  "date": "today",
  "startDate": "2024-03-15T00:00:00.000Z",
  "endDate": "2024-03-15T23:59:59.999Z",
  "statistics": {
    "submitted": 15,
    "completed": 8
  }
}
```

#### Get Business Statistics
```http
GET /api/admin/statistics/businesses?date=<date>
```

**Response:**
```json
{
  "date": "today",
  "startDate": "2024-03-15T00:00:00.000Z",
  "endDate": "2024-03-15T23:59:59.999Z",
  "statistics": {
    "newBusinesses": 3
  }
}
```

#### Get Revenue Statistics
```http
GET /api/admin/statistics/revenue?date=<date>
```

**Response:**
```json
{
  "date": "today",
  "startDate": "2024-03-15T00:00:00.000Z",
  "endDate": "2024-03-15T23:59:59.999Z",
  "statistics": {
    "creditRevenue": "350.00",
    "agreementRevenue": "100.00",
    "totalRevenue": "450.00",
    "currency": "GBP"
  }
}
```

### Company Management

#### Get New Companies
```http
GET /api/admin/companies/new?limit=50&offset=0
```

**Query Parameters:**
- `limit` (optional): Number of companies to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "companies": [
    {
      "id": "uuid",
      "companyName": "Example Estate Agents",
      "companyEmail": "info@example.com",
      "createdAt": "2024-03-15T10:30:00.000Z",
      "onboardingCompleted": true,
      "credits": 10,
      "owner": {
        "name": "John Smith",
        "email": "john@example.com"
      }
    }
  ],
  "total": 20
}
```

### Staff Management

#### List All Staff
```http
GET /api/admin/staff
```

**Response:**
```json
{
  "staff": [
    {
      "id": "uuid",
      "email": "staff@propertygoose.com",
      "full_name": "Jane Doe",
      "is_active": true,
      "is_admin": true,
      "created_at": "2024-01-15T09:00:00.000Z",
      "updated_at": "2024-03-15T10:00:00.000Z"
    }
  ]
}
```

#### Create Staff Account
```http
POST /api/admin/staff
Content-Type: application/json

{
  "email": "newstaff@propertygoose.com",
  "fullName": "Bob Johnson",
  "password": "SecurePassword123",
  "isAdmin": false
}
```

**Response:**
```json
{
  "message": "Staff account created successfully",
  "staff": {
    "id": "uuid",
    "email": "newstaff@propertygoose.com",
    "fullName": "Bob Johnson",
    "isAdmin": false,
    "isActive": true
  }
}
```

#### Update Staff Account
```http
PATCH /api/admin/staff/:staffId
Content-Type: application/json

{
  "isActive": false,
  "isAdmin": true
}
```

**Request Body:**
- `isActive` (optional): Boolean to activate/deactivate account
- `isAdmin` (optional): Boolean to grant/revoke admin privileges

**Response:**
```json
{
  "message": "Staff account updated successfully",
  "staff": {
    "id": "uuid",
    "email": "staff@propertygoose.com",
    "fullName": "Jane Doe",
    "isActive": false,
    "isAdmin": true
  }
}
```

## Security Features

### Authentication & Authorization

1. **Two-Tier Security:**
   - Must be authenticated as a staff user
   - Must have `is_admin = true` in the database

2. **Middleware Protection:**
   - All `/api/admin/*` routes protected by `authenticateAdmin` middleware
   - Invalid tokens return 401 Unauthorized
   - Non-admin staff receive 403 Forbidden

3. **Frontend Guards:**
   - Vue Router automatically checks `authStore.isAdmin`
   - Non-admins redirected to `/dashboard` when accessing `/admin/*`
   - Admin status checked on every route navigation

### Access Control Flow

```
User Login → Check Supabase Auth → Valid Token?
                                      ↓ Yes
                            Check staff_users table
                                      ↓
                            is_active = true?
                                      ↓ Yes
                            is_admin = true?
                                      ↓ Yes
                            Grant Admin Access
```

### Best Practices

1. **Limit Admin Accounts**: Only grant admin privileges to trusted platform administrators
2. **Regular Audits**: Periodically review the staff list to ensure only necessary accounts have admin access
3. **Strong Passwords**: Enforce minimum 8-character passwords when creating staff accounts
4. **Deactivate Instead of Delete**: Use the deactivate feature to preserve audit trails
5. **Monitor Access**: Check admin activity through application logs

## Troubleshooting

### "Access Denied" Error

**Problem:** Getting 403 Forbidden when accessing admin routes

**Solutions:**
1. Verify your staff account has `is_admin = true` in the database
2. Log out and log back in to refresh authentication state
3. Check that your account is active (`is_active = true`)

### Admin Panel Not Loading

**Problem:** Admin pages show blank or redirect to dashboard

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify the backend API is running (`/health` endpoint)
3. Confirm admin routes are registered in `backend/src/server.ts`
4. Check that frontend has latest build (`npm run build`)

### Statistics Not Updating

**Problem:** Dashboard shows zero or outdated statistics

**Solutions:**
1. Verify database has data in `tenant_references`, `companies`, `credit_transactions`, etc.
2. Check API endpoint responses in browser Network tab
3. Confirm date filter is set correctly (UTC timezone differences)
4. Review backend logs for database query errors

### Cannot Create Staff Account

**Problem:** Error when submitting create staff form

**Solutions:**
1. Ensure email is unique (not already in use)
2. Password must be at least 8 characters
3. Check backend logs for Supabase Auth errors
4. Verify Supabase service role key is configured correctly

## File Reference

### Backend Files
- **Migration:** `backend/migrations/098_add_admin_role_to_staff.sql`
- **Middleware:** `backend/src/middleware/adminAuth.ts`
- **Routes:** `backend/src/routes/admin.ts`
- **Server:** `backend/src/server.ts` (line 29, 135)

### Frontend Files
- **Dashboard View:** `frontend/src/views/AdminDashboard.vue`
- **Staff Management:** `frontend/src/views/AdminStaffManagement.vue`
- **Router:** `frontend/src/router/index.ts` (lines 39-40, 307-321, 365-370)
- **Auth Store:** `frontend/src/stores/auth.ts` (includes admin status tracking)

## Support

For technical issues or feature requests related to the admin panel, please contact the development team or file an issue in the repository.

---

**Last Updated:** 2024-03-15
**Version:** 1.0.0
**Compatibility:** PropertyGooseApp v2.x
