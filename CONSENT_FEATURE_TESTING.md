# Consent Feature Testing Guide

## Quick Start

Everything is set up and ready to test! Here's how to verify the feature works:

## 1. Start the Servers

### Terminal 1 - Backend:
```bash
cd backend
npm run dev
```
Backend runs on: http://localhost:3001

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```
Frontend runs on: http://localhost:5173

## 2. Test the Feature

### Create a Reference
1. Log in to the app
2. Create a new tenant reference
3. Copy the reference link

### Fill Out the Form
1. Open the reference link in a browser
2. Complete all pages of the form (Pages 1-10)
3. Navigate to **Page 11: Referencing Consent**

### Test the Consent Page
On Page 11, you should see:
- ✅ Full consent declaration text (with Propertygoose Ltd)
- ✅ Privacy policy link
- ✅ Signature pad (you can draw or type)
- ✅ Applicant Name field
- ✅ Agreed On date picker
- ✅ Printed Name field

**Try these:**
- Draw a signature using your mouse
- Or click "Type" and type your name
- Fill in all required fields
- Submit button should only enable when all fields are complete

### Submit the Form
1. Click "Submit Reference"
2. Watch the backend console - you should see:
   ```
   Consent PDF generated and uploaded successfully
   Consent PDF sent to tenant email successfully
   ```

## 3. Verify the Results

### Check Email
- Tenant should receive an email with:
  - Subject: "Your Referencing Consent Declaration - PropertyGoose"
  - PDF attachment: `consent_{reference_id}_{timestamp}.pdf`
  - PropertyGoose branded email template

### Check Reference Detail Page
1. Go to the reference detail page (as staff or agent)
2. Look for new **"Consent Declaration"** section
3. Should display:
   - Applicant Name
   - Agreed On date
   - Printed Name
   - "View PDF" and "Download" buttons

### Test PDF Download
1. Click "View PDF" - opens PDF in new tab
2. Click "Download" - downloads the PDF file
3. Open the PDF and verify:
   - ✅ PropertyGoose logo at top
   - ✅ Full consent declaration text
   - ✅ Signature image embedded
   - ✅ All applicant details
   - ✅ Professional formatting with header/footer

## 4. Check Supabase

### Database
Open Supabase SQL Editor and run:
```sql
SELECT
  id,
  consent_applicant_name_encrypted,
  consent_printed_name_encrypted,
  consent_agreed_date,
  consent_pdf_path,
  LENGTH(consent_signature) as signature_length
FROM tenant_references
WHERE consent_signature IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

Should see:
- Encrypted names
- Date of consent
- PDF path in format: `consent-pdfs/{reference_id}/consent_{reference_id}_{timestamp}.pdf`
- Signature length (base64 string)

### Storage
1. Go to Supabase Dashboard → Storage
2. Open `reference-documents` bucket
3. Navigate to `consent-pdfs/{reference_id}/`
4. Should see the generated PDF file
5. Click to preview/download

## 5. Common Issues

### PDF Not Generated
- Check backend console for errors
- Verify `pdfkit` is installed: `npm list pdfkit`
- Ensure assets folder exists: `ls backend/assets/PropertyGooseIcon.png`

### Email Not Sent
- Check Resend API key is set in `.env`
- Verify tenant email exists in reference
- Check backend logs for email errors

### PDF Not Displaying
- Verify storage bucket permissions (RLS)
- Check PDF path is stored in database
- Ensure authenticated user can access storage

### Signature Not Showing in PDF
- Ensure signature field is not empty when submitting
- Check signature is base64 encoded
- Verify signature starts with `data:image/png;base64,`

## 6. Example Data

For quick testing, use these values:
- **Applicant Name**: John Smith
- **Agreed On**: Today's date
- **Printed Name**: JOHN SMITH
- **Signature**: Draw or type your name

## 7. Feature Validation Checklist

After testing, verify:

- [ ] Signature pad works (both draw and type modes)
- [ ] Clear button clears the signature
- [ ] Form validates all consent fields are required
- [ ] Submit button is disabled until all fields complete
- [ ] PDF is generated on submission
- [ ] PDF is uploaded to Supabase Storage
- [ ] PDF path is saved to database
- [ ] Email is sent to tenant with PDF attachment
- [ ] Consent section appears in reference detail pages
- [ ] View PDF button works
- [ ] Download PDF button works
- [ ] PDF contains signature image
- [ ] PDF has PropertyGoose branding
- [ ] All consent text is correct (Propertygoose Ltd)
- [ ] Names are encrypted in database
- [ ] Date is stored correctly

## 8. Integration Points

This feature integrates with:
- ✅ Tenant reference form (SubmitReference.vue)
- ✅ Reference submission API (`POST /api/references/submit/:token`)
- ✅ PDF generation service (pdfService.ts)
- ✅ Email service (emailService.ts)
- ✅ Supabase Storage (reference-documents bucket)
- ✅ Database (tenant_references table)
- ✅ Reference detail pages (ReferenceDetail.vue, StaffReferenceDetail.vue)

## Need Help?

If you encounter issues:
1. Check backend console logs
2. Check browser console for frontend errors
3. Verify all environment variables are set
4. Ensure database migration was run successfully
5. Confirm Supabase Storage bucket exists and has correct permissions

---

**Ready to test!** 🚀

Start both servers and create a test reference to see the feature in action.
