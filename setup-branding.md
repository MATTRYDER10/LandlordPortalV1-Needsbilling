# Branding Setup Instructions

## Required SQL Migrations

Run these two SQL migrations in order in your Supabase SQL Editor:

### 1. Add Branding Fields to Companies Table

**File:** `add-company-branding.sql`

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#A855F7';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS button_color TEXT DEFAULT '#A855F7';

-- Update existing records to have default values
UPDATE companies SET primary_color = '#A855F7' WHERE primary_color IS NULL;
UPDATE companies SET button_color = '#A855F7' WHERE button_color IS NULL;
```

### 2. Create Storage Bucket and RLS Policies

**File:** `setup-company-assets-bucket.sql`

```sql
-- Create the storage bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload to their company folder
CREATE POLICY "Company admins can upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-assets' AND
  (storage.foldername(name))[1] = 'company-logos' AND
  (storage.foldername(name))[2]::uuid IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- Policy: Allow public read access
CREATE POLICY "Anyone can view company logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-assets');

-- Policy: Allow company admins to delete their logos
CREATE POLICY "Company admins can delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-assets' AND
  (storage.foldername(name))[1] = 'company-logos' AND
  (storage.foldername(name))[2]::uuid IN (
    SELECT company_id FROM company_users WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);
```

## Features Added

### Settings Page - Branding Tab
- **Logo Upload**: Upload company logo (PNG, JPG, WEBP, max 2MB)
- **Primary Color**: Customize primary brand color (used for headings and key UI elements)
- **Button Color**: Customize button color (used for action buttons throughout forms)
- **Live Preview**: See how branding will appear on forms

### Backend API
- `POST /api/company/logo` - Upload company logo to Supabase Storage
- `PUT /api/company` - Update company branding settings (logo_url, primary_color, button_color)

### Database Schema
Updated `companies` table with:
- `logo_url` - URL to company logo in storage
- `primary_color` - Hex color code for primary brand color
- `button_color` - Hex color code for button color

## Next Steps

To apply branding to forms:
1. Update tenant reference submission form to use company branding
2. Update landlord reference form to use company branding
3. Update employer reference form to use company branding
4. Fetch company branding from database when loading public forms
