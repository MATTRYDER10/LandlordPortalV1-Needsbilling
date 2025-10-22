# Data Display Plan for Tenant References

## Overview
Two primary user types need to view tenant reference data:
1. **PropertyGoose Staff** (/staff routes) - Review, verify, and approve/deny references
2. **Lettings Agents** - View comprehensive results to make tenancy decisions

---

## PropertyGoose Staff View (`/staff/references/:id`)

### Purpose
- Complete verification and data checking
- Compare tenant-provided vs third-party data
- Identify discrepancies and issues
- Add verification notes
- Approve or deny the reference

### Proposed Layout Structure

#### SECTION 1: Reference Overview (Top Card)
**Key Information at a Glance**
- Reference ID: #XXXXX
- Tenant name, DOB, email, phone
- Reference status (pending/in_progress/completed/verified/denied)
- Requested by: [Agent Name] from [Company Name]
- Property being applied for (address, monthly rent)
- Move-in date
- Created date, submitted date, completed date, last updated
- **Group Application Details** (if applicable):
  - Group Application: Yes
  - Application Type: Primary Applicant / Co-Tenant #2 / Co-Tenant #3
  - Rent Share: £XXX (XX% of total rent)
  - Link: "View Other Applicants in Group"
- Action buttons: "Approve", "Request More Info", "Deny"

#### SECTION 2: Application Summary (Collapsible Cards)
**Quick Facts About the Applicant**

**Personal Information Card**
- Full name, middle name, DOB, nationality
- Email, phone, contact number
- Marital status, number of dependants
- Smoker status, pets

**Current Address Card**
- Current address (full)
- Time at current address (X years Y months)
- **Previous Addresses History** (from tenant_reference_previous_addresses table):
  - Expandable timeline/list showing all previous addresses
  - For each address:
    - Full address (line1, line2, city, postcode, country)
    - Time at address (X years Y months)
    - Address order (chronological sequence)
  - Total address history: X years Y months (important for 3+ year verification)
  - If no previous addresses: "No previous addresses provided"

**New Property Details Card**
- Property address being applied for
- Monthly rent / rent share (if group application)
- Desired term (years/months)
- Move-in date

**Financial Snapshot Card**
- Income sources (checkboxes shown: employment, self-employed, benefits, savings, student, unemployed)
- Adverse credit status
- Has additional income
- Has guarantor (if applicable)

#### SECTION 3: Identity Verification Documents
**Document Review Section**
- ID Document (type + image viewer/download)
- Selfie Photo (image viewer)
- Proof of Address (document viewer/download)
- Status indicators: ✓ Verified / ⚠ Needs Review / ✗ Rejected

**Additional Supporting Documents** (from reference_documents table)
- List of all extra documents uploaded by tenant or staff
- For each document:
  - File name
  - File type (MIME type/extension)
  - File size
  - Uploaded by: [Tenant/Staff Name]
  - Upload date
  - View/Download button
- If no additional documents: "No additional documents uploaded"

#### SECTION 4: Employment Verification

**IF Regular Employment:**

**Comparison Table: Employment Details**
| Field | Tenant Provided | Employer Reference | Match Status |
|-------|----------------|-------------------|--------------|
| Company Name | [value] | [value] | ✓ / ⚠ / ✗ |
| Position | [value] | [value] | ✓ / ⚠ / ✗ |
| Employment Start Date | [value] | [value] | ✓ / ⚠ / ✗ |
| Employment End Date | N/A (current) | [value] (if not current) | - |
| Annual Salary | £XX,XXX (normalized) | £XX,XXX | ✓ / ⚠ / ✗ |
| Payment Frequency | [hourly/monthly/annual] | [value] | ✓ / ⚠ / ✗ |
| Hourly Rate | £XX/hour (if applicable) | N/A | - |
| Hours per Month | XX hours (if hourly) | N/A | - |
| Employment Type | [value] | [value] | ✓ / ⚠ / ✗ |
| Company Address | [value] | N/A | - |
| **Reference Contact** |  |  |  |
| Contact Name | [employer_ref_name] | [employer_name] | ✓ / ⚠ / ✗ |
| Contact Position | [employer_ref_position] | [employer_position] | ✓ / ⚠ / ✗ |
| Contact Email | [employer_ref_email] | [employer_email] | ✓ / ⚠ / ✗ |
| Contact Phone | [employer_ref_phone] | [employer_phone] | ✓ / ⚠ / ✗ |

**Employer Assessment Panel** (below comparison)
- Current employee: Yes/No
- Probation status + end date
- Employment status
- Performance rating: [rating]
- Performance details
- Disciplinary issues: Yes/No + details
- Absence record: [rating] + details
- Would re-employ: Yes/No + details
- Additional comments
- Employer name, position, signature
- Reference date, submitted date

**Supporting Documents**
- Payslips (list with view/download)
- Employment contract (if uploaded)

**IF Self-Employed:**

**Comparison Table: Business Details**
| Field | Tenant Provided | Accountant Reference | Match Status |
|-------|----------------|---------------------|--------------|
| Business Name | [value] | [value] | ✓ / ⚠ / ✗ |
| Nature of Business | [value] | [value] | ✓ / ⚠ / ✗ |
| Business Start Date | [value] | [value] | ✓ / ⚠ / ✗ |
| Annual Income | [value] | [value] | ✓ / ⚠ / ✗ |
| Accountant Name | [value] | [value] | ✓ / ⚠ / ✗ |
| Accountant Firm | [value] | [value] | ✓ / ⚠ / ✗ |
| Accountant Email | [value] | [value] | ✓ / ⚠ / ✗ |
| Accountant Phone | [value] | [value] | ✓ / ⚠ / ✗ |

**Accountant Assessment Panel**
- Business trading status
- Business financially stable: Yes/No
- Tax returns filed: Yes/No + last date
- Accounts prepared: Yes/No + year end date
- Outstanding tax liabilities: Yes/No + details
- Annual turnover: [value]
- Annual profit: [value]
- Estimated monthly income: [value]
- Accountant confirms income: Yes/No
- Would recommend: Yes/No + comments
- Additional comments
- Accountant signature
- Reference date, submitted date

**Supporting Documents**
- Proof of additional income (if uploaded)
- Business accounts (if uploaded)

**Additional Income Section** (if applicable)
- Source: [value]
- Amount: [value]
- Frequency: [value]
- Supporting document

#### SECTION 5: Rental History

**Comparison Table: Previous Tenancy**
| Field | Tenant Provided | Landlord/Agent Reference | Match Status |
|-------|----------------|--------------------------|--------------|
| Property Address | [value] | [value] | ✓ / ⚠ / ✗ |
| Property City | [value] | [value] | ✓ / ⚠ / ✗ |
| Property Postcode | [value] | [value] | ✓ / ⚠ / ✗ |
| Monthly Rent | N/A | [value] | - |
| Tenancy Start Date | [calculated] | [value] | ✓ / ⚠ / ✗ |
| Tenancy End Date | [calculated] | [value] | ✓ / ⚠ / ✗ |
| Tenancy Duration | [value] | [calculated] | ✓ / ⚠ / ✗ |
| **Reference Contact** |  |  |  |
| Landlord/Agent Name | [value] | [value] | ✓ / ⚠ / ✗ |
| Landlord's Address | [previous_landlord_address] | N/A | - |
| Agency Name | N/A (if agent) | [agency_name] (if agent) | - |
| Landlord/Agent Email | [value] | [value] | ✓ / ⚠ / ✗ |
| Landlord/Agent Phone | [value] | [value] | ✓ / ⚠ / ✗ |

**Landlord/Agent Assessment Panel**
- Rent paid on time: Yes/No/Partial + details
- Property condition: [rating] + details
- Neighbour complaints: Yes/No + details
- Breach of tenancy: Yes/No + details
- Would rent again: Yes/No + details
- Additional comments
- Reference date, submitted date
- Signature

#### SECTION 6: Financial Information
**Savings & Investments** (if applicable)
- Has savings/pension/investments: Yes/No
- Amount: [value]
- Proof of funds document

**Adverse Credit**
- Has adverse credit: Yes/No
- Details: [value]

**Income Summary Table**
- Total monthly income from employment
- Additional income (if any)
- Savings available
- Total financial capacity
- Rent-to-income ratio: [calculated]

#### SECTION 7: Additional Information
**Personal Circumstances**
- Smoker: Yes/No
- Pets: Yes/No + details
- Dependants: [number] + details

**Guarantor** (if applicable)
- Name: [value]
- Relationship: [value]

#### SECTION 8: Notes & Verification
**Internal Notes** (PG Staff only - not shown to agents)
- Text area for staff notes
- History of notes (who, when, what)

**Verification Notes** (Shown to agents in final report)
- Text area for verification findings
- What was checked
- Any issues found
- Resolution

**Verification History**
- Timeline of status changes
- Who made changes
- When changes were made

#### SECTION 9: Actions
**Primary Actions**
- ✓ Approve Reference (opens modal for final notes)
- ⚠ Request More Information (opens modal to specify what's needed)
- ✗ Deny Reference (opens modal for reason)

**Secondary Actions**
- Download All Documents (ZIP)
- Generate Preview PDF
- Send Update to Agent
- Flag for Review

---

## Lettings Agent View (`/references/:id` or `/agent/references/:id`)

### Purpose
- View complete verified reference
- Make informed tenancy decisions
- Download PDF report
- Access supporting documents

### Proposed Layout Structure

#### SECTION 1: Reference Summary (Header Card)
**Key Information**
- Reference ID: #XXXXX
- Tenant name, DOB, email, phone
- Reference status badge: ✓ Approved / ⚠ Pending / ✗ Denied
- Property address
- **Group Application Details** (if applicable):
  - Group Application: Yes
  - Application Type: Primary Applicant / Co-Tenant #2
  - Rent Share: £XXX (XX% of total)
  - Link: "View Other Applicants"
- Verification date
- Verified by: PropertyGoose Staff
- Download PDF button (prominent)

#### SECTION 2: Verification Outcome
**Overall Assessment Card** (prominent, color-coded)
- Status: APPROVED / REQUIRES ATTENTION / DENIED
- Verification notes from PG staff
- Any conditions or concerns
- Recommendation level: Strong / Acceptable / Not Recommended

#### SECTION 3: Applicant Information
**Personal Details**
- Full name, DOB, nationality
- Contact information
- Current address + time at address (X years Y months)
- Previous addresses (expandable list showing full address history)
- Total address history: X years Y months
- Marital status, dependants
- Smoker status, pets

**Application Details**
- Property being applied for
- Monthly rent / rent share
- Desired term
- Move-in date

#### SECTION 4: Identity Verification
**Documents Verified** (checkboxes or status indicators)
- ✓ Photo ID Verified (type: Passport/Driving License)
- ✓ Selfie Match Confirmed
- ✓ Proof of Address Verified
- Additional supporting documents: X documents uploaded
- View Documents button (optional - some agents may not need to see actual docs)

#### SECTION 5: Employment & Income Verification

**IF Employment Reference:**

**Employment Details Table**
| Detail | Tenant Stated | Employer Confirmed | Status |
|--------|--------------|-------------------|--------|
| Company | [value] | [value] | ✓ Match |
| Position | [value] | [value] | ✓ Match |
| Start Date | [value] | [value] | ✓ Match |
| Annual Salary | £XX,XXX (normalized) | £XX,XXX | ✓ Match |
| Payment Frequency | [hourly/monthly/annual] | [value] | ✓ Match |
| Employment Type | [value] | [value] | ✓ Match |
| Reference Contact | [name, position] | [name, position] | ✓ Match |

**Employer's Assessment**
- Current employee: Yes
- Probation: No
- Performance: Excellent
- Disciplinary issues: None
- Absence record: Good
- Would re-employ: Yes
- Comments: [employer comments]

**Income Verification**
- Annual salary: £XX,XXX
- Additional income: £XXX/month (if applicable)
- Total monthly income: £X,XXX
- Rent-to-income ratio: XX% (with indicator: Good/Fair/High Risk)

**IF Self-Employed:**

**Business Details Table**
| Detail | Tenant Stated | Accountant Confirmed | Status |
|--------|--------------|---------------------|--------|
| Business Name | [value] | [value] | ✓ Match |
| Nature of Business | [value] | [value] | ✓ Match |
| Start Date | [value] | [value] | ✓ Match |
| Annual Income | [value] | [value] | ✓ Match |

**Accountant's Assessment**
- Business status: Trading
- Financially stable: Yes
- Tax compliant: Yes
- Accounts prepared: Yes
- Outstanding liabilities: No
- Annual turnover: £XXX,XXX
- Annual profit: £XX,XXX
- Estimated monthly income: £X,XXX
- Accountant confirms income: Yes
- Would recommend: Yes
- Comments: [accountant comments]

#### SECTION 6: Rental History

**Previous Tenancy Table**
| Detail | Tenant Stated | Landlord/Agent Confirmed | Status |
|--------|--------------|-------------------------|--------|
| Property Address | [value] | [value] | ✓ Match |
| Monthly Rent | N/A | £XXX | - |
| Tenancy Period | [dates] | [dates] | ✓ Match |
| Duration | X years X months | X years X months | ✓ Match |
| Reference Contact | [name, contact info] | [name, contact info] | ✓ Match |

**Landlord/Agent's Assessment**
- Rent paid on time: Yes
- Property condition: Excellent
- Neighbour complaints: No
- Breach of tenancy: No
- Would rent again: Yes
- Comments: [landlord comments]

#### SECTION 7: Financial Summary

**Income & Affordability**
- Total monthly income: £X,XXX
- Requested rent: £XXX
- Rent-to-income ratio: XX%
- Assessment: ✓ Affordable / ⚠ Borderline / ✗ High Risk

**Savings & Financial Position** (if provided)
- Savings available: £X,XXX
- Additional income: £XXX/month

**Credit History**
- Adverse credit: Yes/No
- Details: [if applicable]
- Impact assessment: [if applicable]

#### SECTION 8: Additional Considerations

**Personal Circumstances**
- Smoker: Yes/No
- Pets: Yes/No (details if yes)
- Dependants: X
- Guarantor: Yes/No (details if yes)

#### SECTION 9: Supporting Documents
**Available Documents** (download links)
- Identity documents
- Proof of address
- Payslips
- Bank statements (if provided)
- Previous tenancy documents
- All documents (ZIP download)

#### SECTION 10: PropertyGoose Verification Statement
**Official Verification**
- Verified by: [Staff name]
- Verification date: [date]
- Verification ID: [unique ID]
- Statement: "PropertyGoose has independently verified the above information through direct contact with the referenced parties. All documents have been reviewed and authenticated."

**Actions for Agent**
- Download PDF Report (primary button)
- Contact PropertyGoose (if questions)
- Request Additional Information

---

## PDF Report Structure (for Agents)

The PDF should mirror the agent view but in a printable/shareable format:

1. **Cover Page**
   - PropertyGoose branding
   - Tenant name
   - Property address
   - Reference ID
   - Verification date
   - Status badge

2. **Executive Summary**
   - Overall recommendation
   - Key findings
   - Any concerns or conditions

3. **Detailed Sections** (matching agent web view)
   - Personal information
   - Identity verification
   - Employment/income verification
   - Rental history
   - Financial summary
   - Additional considerations

4. **Appendices**
   - Verification notes
   - Document list
   - Contact information

5. **Footer** (on every page)
   - PropertyGoose contact
   - Verification ID
   - Page numbers
   - "Confidential" watermark

---

## Key Design Considerations

### Visual Indicators
- **Match Status Colors:**
  - Green (✓): Perfect match
  - Amber (⚠): Minor discrepancy but acceptable
  - Red (✗): Significant discrepancy or concern
  - Grey (-): Not applicable or no comparison available

- **Status Badges:**
  - Approved: Green
  - Pending: Blue
  - Requires Attention: Amber
  - Denied: Red

### Comparison Display
- Side-by-side columns for easy scanning
- Clear visual indicators for matches/mismatches
- Tooltips or modals for detailed discrepancy explanations
- Highlight cells with differences

### Progressive Disclosure
- Use collapsible sections to avoid overwhelming users
- Most critical information visible by default
- Detailed information expandable
- "Show all" / "Hide all" toggle

### Responsive Design
- Staff view optimized for desktop (large screens, lots of data)
- Agent view should work well on tablet/mobile too
- PDF should be letter/A4 optimized

### Loading States
- Show which references have been received vs pending
- Progress indicators for incomplete sections
- Clear messaging if waiting on third-party responses

---

## Data Flow Considerations

### For PropertyGoose Staff:
1. Reference comes in from agent (tenant creation)
2. Tenant fills out form and provides references
3. Staff member reviews in stages:
   - Identity docs first
   - Employment verification
   - Rental history
   - Financial assessment
4. Staff makes decision and adds notes
5. Status changes to approved/denied
6. Agent gets access to results

### For Agents:
1. Submit reference request (create tenant reference)
2. Wait for PropertyGoose to complete verification
3. Get notification when complete
4. View results on web
5. Download PDF for records
6. Make tenancy decision

---

## Additional Features to Consider

### For Staff View:
- **Batch operations** - Process multiple references
- **Flagging system** - Flag suspicious data
- **Audit trail** - Track all changes and views
- **Templates** - Common verification notes/decisions
- **Communication log** - Track emails sent to agents/tenants
- **Risk scoring** - Automated risk assessment based on data

### For Agent View:
- **Comparison view** - Compare multiple applicants side-by-side
- **Sharing** - Share with colleagues (with permissions)
- **Print-friendly** - Optimize for printing without PDF
- **Notifications** - Email when reference is ready
- **Historical references** - View past references for same tenant

### Technical Considerations:
- **Caching** - These pages will be data-heavy, cache decrypted data appropriately
- **Permissions** - Ensure agents can only see their own company's references
- **Audit logging** - Log who views what and when
- **Document storage** - Efficient retrieval of uploaded documents
- **PDF generation** - Server-side PDF generation with proper formatting

---

## Field Coverage Confirmation

This plan now covers **100%** of all user-facing data fields from:

✓ **tenant_references** - All fields including:
  - Personal information (name, DOB, nationality, marital status)
  - Contact details (email, phone)
  - Current and previous addresses (including time at each)
  - Property application details
  - Employment information (with salary normalization)
  - Self-employment details
  - Income sources and additional income
  - Financial information (savings, adverse credit)
  - Personal circumstances (pets, smoking, dependants)
  - Guarantor information
  - Reference contact information (employer, landlord, accountant)
  - Group application metadata
  - Document paths
  - Notes and verification data
  - System timestamps

✓ **employer_references** - All fields including:
  - Employer contact information
  - Employment details and dates
  - Salary and payment frequency
  - Probation status
  - Performance assessments
  - Disciplinary and absence records
  - Would re-employ recommendation
  - Signature and submission data

✓ **landlord_references** - All fields including:
  - Landlord contact information
  - Property details
  - Tenancy dates and rent
  - Rent payment history assessment
  - Property condition assessment
  - Neighbor complaints
  - Tenancy breaches
  - Would rent again recommendation
  - Signature and submission data

✓ **agent_references** - All fields including:
  - Agent and agency information
  - Property details
  - Tenancy dates and rent
  - Rent payment history assessment
  - Property condition assessment
  - Neighbor complaints
  - Tenancy breaches
  - Would rent again recommendation
  - Signature and submission data

✓ **accountant_references** - All fields including:
  - Accountant contact information
  - Business details
  - Financial figures (turnover, profit, income)
  - Tax compliance information
  - Accounts preparation status
  - Business stability assessment
  - Income confirmation
  - Recommendation
  - Signature and submission data

✓ **tenant_reference_previous_addresses** - All fields including:
  - Full address details (line1, line2, city, postcode, country)
  - Time at each address (years and months)
  - Address order (chronological)

✓ **reference_documents** - All fields including:
  - File name, URL, type, size
  - Uploaded by (tenant or staff)
  - Upload timestamp

**Excluded fields:** Form state management fields (current_page, completed_pages, token_hash, token_expires_at) are intentionally not displayed as they're for internal system use only.
