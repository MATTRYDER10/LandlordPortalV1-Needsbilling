-- Create company-assets storage bucket and configure RLS policies
-- Run this in Supabase SQL Editor

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
