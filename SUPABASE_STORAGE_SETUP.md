# Supabase Storage Setup for Tenant Documents

## Overview
This guide will help you set up a Supabase Storage bucket for storing tenant reference documents (bank statements and payslips) with proper security policies.

## Step 1: Create the Storage Bucket

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **Create a new bucket**
4. Configure the bucket:
   - **Name**: `tenant-documents`
   - **Public bucket**: **OFF** (Keep it private)
   - **File size limit**: `10MB`
   - **Allowed MIME types**: `application/pdf, image/jpeg, image/jpg, image/png`
5. Click **Create bucket**

## Step 2: Run Database Migration

Run the SQL migration to add file storage columns to the `tenant_references` table:

```bash
# Execute the migration file in your Supabase SQL Editor
cat add-document-upload-columns.sql
```

Or run this SQL directly in the Supabase SQL Editor:

```sql
ALTER TABLE tenant_references
ADD COLUMN bank_statement_files TEXT[],
ADD COLUMN payslip_files TEXT[];

COMMENT ON COLUMN tenant_references.bank_statement_files IS 'Array of file paths for bank statements stored in Supabase Storage';
COMMENT ON COLUMN tenant_references.payslip_files IS 'Array of file paths for payslips stored in Supabase Storage';
```

## Step 3: Configure Storage Policies

Go to **Storage** → **Policies** → **tenant-documents** bucket and create the following policies:

### Policy 1: Allow Service Role Full Access (for backend uploads)

This policy allows your backend (using the service role key) to upload files.

- **Policy name**: `Service role can upload and read`
- **Allowed operation**: All
- **Target roles**: `service_role`
- **Policy definition**:
  ```sql
  true
  ```

### Policy 2: Company Users Can Read Their Documents

This policy ensures users can only download documents belonging to their company.

- **Policy name**: `Company users can read their documents`
- **Allowed operation**: SELECT
- **Target roles**: `authenticated`
- **Policy definition**:
  ```sql
  -- Users can read files from references belonging to their company
  EXISTS (
    SELECT 1 FROM tenant_references tr
    INNER JOIN company_users cu ON cu.company_id = tr.company_id
    WHERE cu.user_id = auth.uid()
    AND storage.foldername(name)[1] = tr.id::text
  )
  ```

### Important Security Notes:

1. **Folder Structure**: Files are organized by reference ID:
   ```
   tenant-documents/
   ├── {reference-id}/
   │   ├── bank_statements/
   │   │   ├── file1.pdf
   │   │   └── file2.jpg
   │   └── payslips/
   │       ├── file1.pdf
   │       └── file2.pdf
   ```

2. **Access Control**:
   - Tenants upload files via the backend API (using service role)
   - Only users from the same company as the reference can download files
   - Files are never publicly accessible

3. **File Validation**:
   - Maximum file size: 10MB
   - Allowed types: PDF, JPEG, JPG, PNG
   - Validated on both frontend and backend

## Step 4: Verify Setup

1. Create a test reference through your application
2. Submit the reference form with bank statements and payslips
3. Verify files appear in the Supabase Storage bucket
4. Verify you can download the files from the Reference Detail page
5. Test that another company's user cannot access the files

## Troubleshooting

### Upload fails with "Access denied"
- Ensure your backend `.env` has the correct `SUPABASE_SERVICE_ROLE_KEY`
- Check that the service role policy exists and is active

### Download fails with "Access denied"
- Verify the SELECT policy is correctly configured
- Check that the user is part of the same company as the reference
- Ensure the file path format matches: `{reference-id}/bank_statements/` or `{reference-id}/payslips/`

### Files not appearing in storage
- Check backend logs for upload errors
- Verify the bucket name is exactly `tenant-documents`
- Ensure file MIME types are in the allowed list

## Security Considerations

✅ **Implemented Security Features:**
- Row Level Security (RLS) on storage access
- Company-based access control
- Server-side validation of file types and sizes
- Organized folder structure by reference ID
- No public access to files
- Authentication required for all file operations

⚠️ **Important:**
- Never expose the `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- All file uploads go through the backend API
- Files are automatically organized by reference ID to prevent cross-company access
