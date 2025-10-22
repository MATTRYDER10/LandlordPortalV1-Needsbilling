# Consent Feature Implementation Summary

## Overview
Added a comprehensive Referencing Consent Declaration feature to the tenant reference form with signature capture, PDF generation, and email distribution.

## Changes Made

### 1. Frontend Changes

#### SubmitReference.vue
- **Imported SignaturePad component** for electronic signature capture
- **Updated Page 11** from simple checkbox to full declaration form with:
  - Comprehensive consent text (replacing "Blinc-UK Ltd" with "Propertygoose Ltd")
  - Privacy policy link: https://propertygoose.co.uk/privacy-policy
  - SignaturePad component for electronic/typed signatures
  - Applicant Name field
  - Agreed On date field
  - Printed Name field
- **Added formData fields**:
  - `consent_signature` - Base64 encoded signature image
  - `consent_applicant_name` - Full name of applicant
  - `consent_printed_name` - Printed version of name
  - `consent_agreed_date` - Date of consent
- **Updated validation** - Submit button now requires all consent fields to be filled

#### ReferenceDetail.vue & StaffReferenceDetail.vue
- Added new "Consent Declaration" section displaying:
  - Applicant Name
  - Agreed On date
  - Printed Name
  - View/Download button for the signed consent PDF

### 2. Backend Changes

#### New Files Created:
- **`src/services/pdfService.ts`** - PDF generation service using PDFKit
  - Generates branded PDF with PropertyGoose logo and colors
  - Includes full consent declaration text
  - Embeds signature image
  - Professional layout with header, footer, and proper formatting

- **`assets/PropertyGooseIcon.png`** - Logo copied for PDF branding

#### Updated Files:
- **`src/routes/references.ts`**
  - Added imports for PDF service and file handling
  - Added consent fields to updateData object in submit handler
  - Integrated PDF generation workflow:
    1. Generate PDF with consent data
    2. Upload to Supabase Storage (`reference-documents` bucket)
    3. Update reference record with PDF path
    4. Email PDF to tenant
    5. Clean up temporary files

- **`src/services/emailService.ts`**
  - Added `sendConsentPDFToTenant()` function
  - Sends branded email with PDF attachment
  - Professional HTML template with PropertyGoose branding

### 3. Database Changes

#### Migration File Created:
- **`backend/migrations/add_consent_and_pdf_fields.sql`**
  - Adds 5 new columns to `tenant_references` table:
    - `consent_signature` (TEXT) - Base64 signature image
    - `consent_applicant_name_encrypted` (TEXT) - Encrypted applicant name
    - `consent_printed_name_encrypted` (TEXT) - Encrypted printed name
    - `consent_agreed_date` (DATE) - Date of consent
    - `consent_pdf_path` (TEXT) - Path to generated PDF in storage

**Note: Run this migration in Supabase to create the required database fields.**

## Dependencies Required

### Backend NPM Packages (Need to Install):
```bash
cd backend
npm install pdfkit @types/pdfkit
```

### Build Script Update Required:
Update `backend/package.json` build script to include assets:
```json
"build": "tsc && cp -r email-templates dist/email-templates && cp -r assets dist/assets"
```

## Supabase Storage Setup

Ensure the `reference-documents` storage bucket exists and has proper permissions:
- Public access for authenticated users (staff/agents)
- RLS policies to allow uploads from backend service role
- Path structure: `consent-pdfs/{reference_id}/{filename}.pdf`

## Setup Completed ✅

- ✅ Database migration run in Supabase
- ✅ Backend dependencies installed (`pdfkit` and `@types/pdfkit`)
- ✅ Backend build script updated to copy assets folder
- ✅ `reference-documents` storage bucket created in Supabase
- ✅ Backend compiled successfully with all changes

## Testing Checklist (Ready for Testing)

- [ ] Test tenant reference form submission with signature
- [ ] Verify PDF is generated and uploaded to storage
- [ ] Check tenant receives email with PDF attachment
- [ ] Verify PDF displays in ReferenceDetail and StaffReferenceDetail pages
- [ ] Test download functionality for the consent PDF

## Features Implemented

✅ Electronic signature capture (draw or type)
✅ Comprehensive consent declaration text
✅ PropertyGoose branding (logo and colors)
✅ PDF generation with signature embedded
✅ Automatic email to tenant with PDF attachment
✅ Storage in Supabase
✅ Display in staff and agent reference detail pages
✅ Download functionality for consent PDF
✅ Encrypted storage of personal data
✅ Form validation requiring all consent fields

## Privacy & Compliance

- All personal data (names) are encrypted in the database
- Signature stored as base64 image
- PDF includes proper GDPR compliance language
- Privacy policy link included: https://propertygoose.co.uk/privacy-policy
- Consent declaration follows UK Housing Act 1996 Ground 17 requirements
- Data Protection Act 2018 compliance statements included
