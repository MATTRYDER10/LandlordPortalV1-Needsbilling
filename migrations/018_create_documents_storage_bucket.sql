-- Create storage bucket for documents (agreements, PDFs, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
    'application/msword', -- .doc
    'image/jpeg',
    'image/png',
    'image/jpg'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the documents bucket
CREATE POLICY "Users can upload documents to their company folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  auth.uid() IN (
    SELECT user_id FROM company_users
  )
);

CREATE POLICY "Users can view documents from their company"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents' AND
  auth.uid() IN (
    SELECT user_id FROM company_users
  )
);

CREATE POLICY "Users can update documents from their company"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND
  auth.uid() IN (
    SELECT user_id FROM company_users
  )
);

CREATE POLICY "Users can delete documents from their company"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  auth.uid() IN (
    SELECT user_id FROM company_users
  )
);

-- Allow public read access (since bucket is public)
CREATE POLICY "Public can view documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');
