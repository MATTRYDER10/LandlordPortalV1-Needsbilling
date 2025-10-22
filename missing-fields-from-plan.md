# Fields Missing from Display Plan

## Missing or Unclear Fields

### 1. Previous Addresses (tenant_reference_previous_addresses table)
**Current Plan:** Only mentions "Previous addresses (if any from previous_addresses table)" in Section 2
**Missing:** No detailed display plan for this data

**Fields to display:**
- Multiple previous addresses (not just current and previous rental)
- Each address should show:
  - Full address (line1, line2, city, postcode, country)
  - Time at address (years and months)
  - Address order (chronological)

**Suggested Display:**
- Expandable timeline or list showing address history
- Important for verifying 3+ years of address history
- Should be in Section 2 (Current Address Card)

---

### 2. Employer Reference Contact Info from Tenant
**Current Plan:** Comparison table shows employer data matching
**Missing:** The tenant also provides the employer contact person's details

**Fields from tenant_references not shown:**
- `employer_ref_name_encrypted` - Name of person giving reference (tenant's contact)
- `employer_ref_position` - Position/title of person giving reference

**Should compare:**
| Field | Tenant Provided Contact | Employer Reference Contact | Match |
|-------|------------------------|---------------------------|-------|
| Reference Name | employer_ref_name_encrypted | employer_name_encrypted | ✓/⚠/✗ |
| Reference Position | employer_ref_position | employer_position_encrypted | ✓/⚠/✗ |

---

### 3. Landlord's Own Address
**Field:** `previous_landlord_address_encrypted`
**Current Plan:** Not shown anywhere
**Purpose:** Shows where the previous landlord lives (not the rental property)

**Suggested Display:** Add to Section 5 (Rental History) comparison table

---

### 4. Group Application Details
**Current Plan:** Mentions "rent_share (if group application)" but no other group details
**Missing:** Clear indication of group application structure

**Fields not clearly shown:**
- `parent_reference_id` - Links to main application in group
- `is_group_parent` - Whether this is the primary applicant
- `tenant_position` - Position in group (1, 2, 3, etc.)

**Suggested Display:**
- Section 1 (Overview) should show:
  - "Group Application: Yes" (if parent_reference_id exists OR is_group_parent is true)
  - "Application Type: Primary Applicant" or "Co-Tenant #2"
  - Link to view other applicants in group
  - "Rent Share: £XXX (XX% of total rent)"

---

### 5. Additional Documents (reference_documents table)
**Current Plan:** Shows specific document types (ID, payslips, etc.)
**Missing:** The `reference_documents` table which stores additional supporting documents

**Fields not shown:**
- `file_name` - Name of additional document
- `file_url` - Location of document
- `file_type` - MIME type
- `file_size` - Size in bytes
- `uploaded_by` - Who uploaded it (tenant or staff)
- `created_at` - When uploaded

**Suggested Display:**
- Add subsection to Section 3 or create dedicated section
- "Additional Supporting Documents"
- List all extra documents uploaded by tenant or staff
- Show: filename, type, size, uploaded by, date
- Download links

---

### 6. Reference Request Metadata
**Fields not shown:**
- `created_by` - Which agent/user created the reference request
- `company_id` - Which agency company this belongs to
- `id` - The reference ID (should be shown)

**Suggested Display:**
- Section 1 (Overview) should add:
  - "Reference ID: #XXXXX"
  - "Requested by: [Agent Name] ([Company Name])"
  - "Request Date: [created_at]"

---

### 7. Salary Frequency Details
**Fields shown separately but not together:**
- From tenant: `employment_is_hourly`, `employment_hours_per_month`
- From employer: `salary_frequency`

**Suggested Display:**
Add to Section 4 (Employment) comparison:
| Field | Tenant Provided | Employer Reference | Match |
|-------|----------------|-------------------|-------|
| Payment Frequency | Calculated from hourly flag | salary_frequency | ✓/⚠/✗ |
| Hours per Month | employment_hours_per_month (if hourly) | N/A | - |

---

### 8. Form Progress Fields (Probably Not Needed for Display)
These are likely not needed for staff/agent views but exist in database:
- `current_page` - Current page in form
- `completed_pages` - Array of completed pages
- `reference_token_hash` - Security token
- `token_expires_at` - Token expiration

**Recommendation:** Don't display these, they're for form state management

---

### 9. System Timestamps
**Partially shown:**
- `created_at` ✓ (shown as "Created date")
- `submitted_at` ✓ (shown as "Submitted date")
- `completed_at` ✓ (shown as "Completed date")
- `verified_at` ✓ (shown in verification section)

**Not shown:**
- `updated_at` - Last update timestamp

**Recommendation:** Add "Last Updated" to Section 1 (Overview)

---

### 10. Salary Comparison Clarity
**Current comparison:** Shows "Annual Salary" for both
**Issue:**
- Tenant provides: `employment_salary_amount_encrypted` (could be annual, monthly, or hourly)
- Tenant provides: `employment_is_hourly` flag
- Employer provides: `annual_salary_encrypted` (always annual)
- Employer provides: `salary_frequency` (how it's paid)

**Need to normalize both to same period for comparison**

**Suggested Display:**
| Field | Tenant Provided | Employer Reference | Match |
|-------|----------------|-------------------|-------|
| Annual Salary | £XX,XXX (calculated if hourly/monthly) | £XX,XXX | ✓/⚠/✗ |
| Payment Frequency | [derived from hourly flag + frequency] | salary_frequency | - |
| Hourly Rate | £XX/hour (if applicable) | N/A | - |
| Hours per Month | XX hours (if hourly) | N/A | - |

---

## Summary of Required Changes to Plan

### Section 1 (Reference Overview) - ADD:
- Reference ID: #XXXXX
- Requested by: [Agent Name] from [Company Name]
- Last Updated: [updated_at]
- Group Application indicator:
  - "Group Application: Yes/No"
  - "Application Type: Primary Applicant / Co-Tenant #X"
  - "Rent Share: £XXX (XX% of total)"
  - Link to view other group members

### Section 2 (Application Summary) - EXPAND:
**Current Address Card** should include:
- Current address
- Time at current address
- **Previous Addresses (Full List):**
  - Address 1: [full address] - X years Y months
  - Address 2: [full address] - X years Y months
  - etc.
  - Total history: X years Y months

### Section 3 (Identity Verification) - ADD:
**Additional Supporting Documents** subsection:
- List all documents from `reference_documents` table
- Show: filename, type, size, uploaded by, upload date
- Download links

### Section 4 (Employment Verification) - EXPAND:
**Comparison Table** - Add rows:
- Reference Contact Name (who tenant says to contact vs who responded)
- Reference Contact Position
- Payment Frequency (with normalization)
- Hours per Month (if hourly)

**Better salary comparison:**
- Normalize both to annual for comparison
- Show breakdown if hourly/monthly

### Section 5 (Rental History) - EXPAND:
**Comparison Table** - Add row:
- Landlord's Address (from tenant) vs N/A

---

## Fields Confirmed as Not Needed for Display

- `current_page` - Form state only
- `completed_pages` - Form state only
- `reference_token_hash` - Security only
- `token_expires_at` - Security only
- Internal IDs that are just references (company_id as lookup)

---

## Total Coverage After Changes

With these additions, the plan would cover **100%** of user-facing data fields from:
- ✓ tenant_references table (all relevant fields)
- ✓ employer_references table (all fields)
- ✓ landlord_references table (all fields)
- ✓ agent_references table (all fields)
- ✓ accountant_references table (all fields)
- ✓ tenant_reference_previous_addresses table (all fields)
- ✓ reference_documents table (all fields)
