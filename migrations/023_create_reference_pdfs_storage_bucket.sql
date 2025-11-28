-- Create storage bucket for reference report PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reference-pdfs',
  'reference-pdfs',
  true,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the reference-pdfs bucket
-- Allow staff users to view reference PDFs
CREATE POLICY "Staff can view reference PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reference-pdfs' AND
  (
    -- Staff users can view any reference PDF
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE id = auth.uid()
    )
    OR
    -- Company members can view PDFs for their company's references
    EXISTS (
      SELECT 1 FROM tenant_references tr
      INNER JOIN company_users cu ON cu.company_id = tr.company_id
      WHERE cu.user_id = auth.uid()
      AND (storage.foldername(name))[2] = tr.id::text
    )
  )
);

-- Allow service role (system) to upload reference PDFs
CREATE POLICY "System can upload reference PDFs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reference-pdfs'
);

-- Allow service role (system) to update reference PDFs
CREATE POLICY "System can update reference PDFs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'reference-pdfs'
);

-- Allow service role (system) to delete reference PDFs
CREATE POLICY "System can delete reference PDFs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'reference-pdfs'
);

-- Allow public read access (since bucket is public)
CREATE POLICY "Public can view reference PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'reference-pdfs');

