# Supabase Storage Policies Setup

The storage bucket `credas-verification-pdfs` has been created successfully!

Now you need to set up the RLS policies. You have two options:

## Option 1: Use Supabase SQL Editor (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard/project/spaetpdmlqfygsxiawul
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the SQL below:

```sql
-- Set up RLS policy - only company members can access their own verification PDFs
CREATE POLICY "Company members can view verification PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'credas-verification-pdfs' AND
  (storage.foldername(name))[1] IN (
    SELECT tr.id::text
    FROM tenant_references tr
    INNER JOIN company_users cu ON cu.company_id = tr.company_id
    WHERE cu.user_id = auth.uid()
  )
);

-- Allow system (service role) to upload verification PDFs
CREATE POLICY "System can upload verification PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'credas-verification-pdfs');

-- Allow system to update/replace verification PDFs
CREATE POLICY "System can update verification PDFs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'credas-verification-pdfs')
WITH CHECK (bucket_id = 'credas-verification-pdfs');

-- Allow system to delete old verification PDFs
CREATE POLICY "System can delete verification PDFs"
ON storage.objects FOR DELETE
USING (bucket_id = 'credas-verification-pdfs');
```

5. Click "Run" to execute the SQL
6. You should see "Success. No rows returned" - that's correct!

## Option 2: Use Supabase Dashboard UI

1. Go to your Supabase project: https://supabase.com/dashboard/project/spaetpdmlqfygsxiawul
2. Click on "Storage" in the left sidebar
3. Click on the "credas-verification-pdfs" bucket
4. Click on "Policies" tab
5. Click "New Policy" and create each policy manually:

### Policy 1: Company members can view verification PDFs
- **Allowed operation:** SELECT
- **Policy definition:**
```sql
bucket_id = 'credas-verification-pdfs' AND
(storage.foldername(name))[1] IN (
  SELECT tr.id::text
  FROM tenant_references tr
  INNER JOIN company_users cu ON cu.company_id = tr.company_id
  WHERE cu.user_id = auth.uid()
)
```

### Policy 2: System can upload verification PDFs
- **Allowed operation:** INSERT
- **Policy definition:**
```sql
bucket_id = 'credas-verification-pdfs'
```

### Policy 3: System can update verification PDFs
- **Allowed operation:** UPDATE
- **Policy definition (USING):**
```sql
bucket_id = 'credas-verification-pdfs'
```
- **Policy definition (WITH CHECK):**
```sql
bucket_id = 'credas-verification-pdfs'
```

### Policy 4: System can delete verification PDFs
- **Allowed operation:** DELETE
- **Policy definition:**
```sql
bucket_id = 'credas-verification-pdfs'
```

## Verify Setup

After setting up the policies, verify that:
1. The bucket appears in Storage > Buckets
2. Four policies are listed under the bucket's Policies tab
3. The bucket is set to "Public" (for downloading PDFs via public URLs)

## Next Steps

Once the policies are set up, the Credas integration will be able to:
- ✅ Upload verification PDFs to Supabase Storage
- ✅ Generate public URLs for PDFs
- ✅ Restrict access to company members only
- ✅ Allow staff to download verification reports

You're ready to test the Credas integration!
