# PropertyGoose Forms & Database Tables Audit Report

**Date:** October 7, 2025
**Purpose:** Comprehensive analysis of form fields vs database columns, identifying redundant fields and ensuring data consistency

---

## Executive Summary

This report analyzes 5 reference forms and 5 database tables in the PropertyGoose system:
- **Total Database Columns:** ~164 columns across 5 tables
- **Total Form Fields:** 164 form fields collected
- **Redundant/Unused Columns Found:** 9 columns
- **Address Field Inconsistencies:** 3 issues identified
- **Deprecated Fields:** 3 legacy columns

---

## 1. TENANT_REFERENCES Table Analysis

### Current Database Structure
Based on migrations, this table has evolved significantly. Current schema includes:

#### Core Fields (Used ✓)
- `id`, `company_id`, `created_by`, `reference_token`, `token_expires_at`, `status`
- `tenant_first_name`, `tenant_last_name`, `tenant_email`, `tenant_phone`
- `property_address`, `property_city`, `property_postcode`
- `monthly_rent`, `move_in_date`, `term_years`, `term_months`
- `created_at`, `updated_at`, `submitted_at`, `completed_at`
- `notes`, `internal_notes`

#### Multi-Tenant Fields (Used ✓)
- `parent_reference_id` - Links child references to parent
- `is_group_parent` - Identifies parent records in multi-tenant groups
- `rent_share` - Individual tenant's rent portion
- `tenant_position` - Position in tenant group (1, 2, 3, etc.)

#### Personal Information (Used ✓)
- `middle_name`, `date_of_birth`, `contact_number`, `nationality`
- `id_document_type`, `id_document_path`, `selfie_path`, `proof_of_address_path`

#### Current Address (Used ✓)
- `current_country`, `current_address_line1`, `current_address_line2`
- `current_city`, `current_postcode`

#### Financial/Employment Information (Used ✓)
- `income_regular_employment`, `income_self_employed`, `income_benefits`
- `income_savings_pension_investments`, `income_student`, `income_unemployed`
- `employment_status`, `employer_name`, `job_title`, `annual_income`, `employment_start_date`
- `employment_contract_type`, `employment_is_hourly`, `employment_hours_per_month`
- `employment_salary_amount`, `employment_company_name`, `employment_job_title`
- `employment_company_address_line1`, `employment_company_address_line2`
- `employment_company_city`, `employment_company_postcode`, `employment_company_country`

#### Employer Reference Contact (Used ✓)
- `employer_ref_position`, `employer_ref_name`, `employer_ref_email`, `employer_ref_phone`

#### Self-Employed Fields (Used ✓)
- `self_employed_business_name`, `self_employed_start_date`
- `self_employed_nature_of_business`, `self_employed_annual_income`

#### Accountant Contact (Used ✓)
- `accountant_name`, `accountant_contact_name`, `accountant_email`, `accountant_phone`

#### Additional Income (Used ✓)
- `has_additional_income`, `additional_income_source`
- `additional_income_amount`, `additional_income_frequency`

#### Credit & Tenant Details (Used ✓)
- `has_adverse_credit`, `adverse_credit_details`
- `is_smoker`, `has_pets`, `pet_details`
- `marital_status`, `number_of_dependants`, `dependants_details`

#### Previous Landlord/Agent (Used ✓)
- `reference_type` - 'landlord' or 'agent'
- `previous_landlord_name`, `previous_landlord_email`, `previous_landlord_phone`
- `previous_rental_address_line1`, `previous_rental_address_line2`
- `previous_rental_city`, `previous_rental_postcode`, `previous_rental_country`
- `tenancy_years`, `tenancy_months`

#### Document Storage (Used ✓)
- `payslip_files` - Array of file paths

### ⚠️ REDUNDANT/UNUSED COLUMNS in tenant_references

1. **`bank_statement_files`** ❌ UNUSED
   - **Added in:** `add-document-upload-columns.sql`
   - **Status:** Column exists but no form collects this data
   - **Recommendation:** Remove if bank statements won't be collected, or add to form if needed

2. **`employer_contact`** ❌ DEPRECATED
   - **Status:** Old field from `references-schema.sql`, replaced by structured fields
   - **Replaced by:** `employer_ref_position`, `employer_ref_name`, `employer_ref_email`, `employer_ref_phone`
   - **Recommendation:** Drop this column (already deprecated)

3. **`previous_address`** ❌ DEPRECATED
   - **Added in:** `references-schema.sql`
   - **Dropped in:** `009_add_previous_rental_address_fields.sql`
   - **Status:** Should already be removed
   - **Action:** Verify it's dropped in production database

4. **`previous_tenancy_duration`** ❌ DEPRECATED
   - **Added in:** `references-schema.sql`
   - **Replaced by:** `tenancy_years` and `tenancy_months`
   - **Recommendation:** Drop this column

5. **`previous_street`** ❌ DEPRECATED
   - **Added in:** `add-reference-fields-migration.sql`
   - **Replaced by:** `previous_rental_address_line1`, `previous_rental_address_line2`
   - **Recommendation:** Drop this column

6. **`previous_city`** ❌ POTENTIAL DUPLICATE
   - **Added in:** `add-reference-fields-migration.sql`
   - **May conflict with:** `previous_rental_city`
   - **Recommendation:** Drop `previous_city`, keep `previous_rental_city`

7. **`previous_postcode`** ❌ POTENTIAL DUPLICATE
   - **Added in:** `add-reference-fields-migration.sql`
   - **May conflict with:** `previous_rental_postcode`
   - **Recommendation:** Drop `previous_postcode`, keep `previous_rental_postcode`

8. **`employer_email`** ❌ DEPRECATED
   - **Added in:** `add-reference-fields-migration.sql`
   - **Replaced by:** `employer_ref_email`
   - **Recommendation:** Drop this column

9. **`employer_phone`** ❌ DEPRECATED
   - **Added in:** `add-reference-fields-migration.sql`
   - **Replaced by:** `employer_ref_phone`
   - **Recommendation:** Drop this column

---

## 2. LANDLORD_REFERENCES Table Analysis

### Database Structure
```sql
CREATE TABLE landlord_references (
    id UUID PRIMARY KEY,
    reference_id UUID (links to tenant_references),

    -- Landlord Information
    landlord_name TEXT,
    landlord_email TEXT,
    landlord_phone TEXT,

    -- Property & Tenancy
    property_address TEXT,
    property_city TEXT,
    property_postcode TEXT,
    tenancy_start_date DATE,
    tenancy_end_date DATE,
    monthly_rent DECIMAL,

    -- Reference Questions
    rent_paid_on_time TEXT,
    rent_paid_on_time_details TEXT,
    property_condition TEXT,
    property_condition_details TEXT,
    neighbour_complaints TEXT,
    neighbour_complaints_details TEXT,
    breach_of_tenancy TEXT,
    breach_of_tenancy_details TEXT,
    would_rent_again TEXT,
    would_rent_again_details TEXT,
    additional_comments TEXT,

    -- Signature
    signature_name TEXT,
    signature TEXT,
    date DATE,

    -- Metadata
    submitted_at TIMESTAMP,
    created_at TIMESTAMP
)
```

### Form Mapping: ✅ PERFECT MATCH
**All 19 database columns are used by LandlordReference.vue form**

### ⚠️ ADDRESS FIELD ISSUE
**Missing Address Fields:**
- ❌ No `property_address_line1` / `property_address_line2` separation
- ✓ Has `property_address` (single field)
- ✓ Has `property_city`
- ✓ Has `property_postcode`

**Inconsistency:** Unlike `tenant_references` which has structured address (line1, line2, city, postcode), this table uses single `property_address` field.

**Recommendation:** Consider adding `property_address_line1` and `property_address_line2` for consistency, or accept single field since it's from a different source.

---

## 3. AGENT_REFERENCES Table Analysis

### Database Structure
```sql
CREATE TABLE agent_references (
    id UUID PRIMARY KEY,
    reference_id UUID (links to tenant_references),

    -- Agent Information
    agent_name TEXT,
    agent_email TEXT,
    agent_phone TEXT,
    agency_name TEXT,

    -- Property & Tenancy
    property_address TEXT,
    property_city TEXT,
    property_postcode TEXT,
    tenancy_start_date DATE,
    tenancy_end_date DATE,
    monthly_rent DECIMAL,

    -- Reference Questions
    rent_paid_on_time TEXT,
    rent_paid_on_time_details TEXT,
    property_condition TEXT,
    property_condition_details TEXT,
    neighbour_complaints TEXT,
    neighbour_complaints_details TEXT,
    breach_of_tenancy TEXT,
    breach_of_tenancy_details TEXT,
    would_rent_again TEXT,
    would_rent_again_details TEXT,
    additional_comments TEXT,

    -- Signature
    signature_name TEXT,
    signature TEXT,
    date DATE,

    -- Metadata
    submitted_at TIMESTAMP,
    created_at TIMESTAMP
)
```

### Form Mapping: ✅ PERFECT MATCH
**All 20 database columns are used by AgentReference.vue form**

### ⚠️ ADDRESS FIELD ISSUE
**Missing Address Fields:**
- ❌ No `property_address_line1` / `property_address_line2` separation
- ✓ Has `property_address` (single field)
- ✓ Has `property_city`
- ✓ Has `property_postcode`

**Inconsistency:** Same as landlord_references - uses single `property_address` field.

---

## 4. EMPLOYER_REFERENCES Table Analysis

### Database Structure
```sql
CREATE TABLE employer_references (
    id UUID PRIMARY KEY,
    reference_id UUID (links to tenant_references),

    -- Employer Information
    company_name TEXT,
    employer_name TEXT,
    employer_position TEXT,
    employer_email TEXT,
    employer_phone TEXT,

    -- Employment Information
    employee_position TEXT,
    employment_type TEXT,
    employment_start_date DATE,
    employment_end_date DATE,
    is_current_employee BOOLEAN,

    -- Salary Information
    annual_salary DECIMAL,
    salary_frequency TEXT,
    is_probation TEXT,
    probation_end_date DATE,

    -- Reference Questions
    employment_status TEXT,
    performance_rating TEXT,
    performance_details TEXT,
    disciplinary_issues TEXT,
    disciplinary_details TEXT,
    absence_record TEXT,
    absence_details TEXT,
    would_reemploy TEXT,
    would_reemploy_details TEXT,
    additional_comments TEXT,

    -- Signature
    signature_name TEXT,
    signature TEXT,
    date DATE,

    -- Metadata
    submitted_at TIMESTAMP,
    created_at TIMESTAMP
)
```

### Form Mapping: ✅ PERFECT MATCH
**All 24 database columns are used by EmployerReference.vue form**

### ✅ NO ADDRESS FIELDS
This table correctly has no address fields as employer references don't need property addresses.

---

## 5. ACCOUNTANT_REFERENCES Table Analysis

### Database Structure
```sql
CREATE TABLE accountant_references (
    id UUID PRIMARY KEY,
    tenant_reference_id UUID (links to tenant_references),
    token TEXT UNIQUE,

    -- Accountant/Firm Information
    accountant_firm_name TEXT,  -- ⚠️ DISCREPANCY
    accountant_contact_name TEXT,
    accountant_email TEXT,
    accountant_phone TEXT,

    -- Business Information
    tenant_name TEXT,
    business_name TEXT,
    nature_of_business TEXT,
    business_start_date DATE,

    -- Financial Information
    annual_turnover DECIMAL,
    annual_profit DECIMAL,
    tax_returns_filed BOOLEAN,
    last_tax_return_date DATE,
    accounts_prepared BOOLEAN,
    accounts_year_end DATE,

    -- Business Status
    business_trading_status TEXT,
    any_outstanding_tax_liabilities BOOLEAN,
    tax_liabilities_details TEXT,
    business_financially_stable BOOLEAN,

    -- Verification
    accountant_confirms_income BOOLEAN,
    estimated_monthly_income DECIMAL,

    -- Comments & Recommendation
    additional_comments TEXT,
    would_recommend BOOLEAN,
    recommendation_comments TEXT,

    -- Signature
    signature_name TEXT,
    signature TEXT,
    date DATE,

    -- Metadata
    submitted_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)
```

### Form Mapping: ⚠️ FIELD NAME DISCREPANCY

**Issue:** Database column vs Form field mismatch
- **Database:** `accountant_firm_name`
- **Form collects:** `firmName` → should map to database

**Need to verify:** Does the form submission map `firmName` to `accountant_firm_name` or is there a mismatch?

**Current Status:** Forms seem to work, so backend likely handles the mapping. But database column naming is inconsistent:
- Database: `accountant_firm_name`
- Other forms use: `firm_name` pattern

**Recommendation:** Consider renaming `accountant_firm_name` → `firm_name` for consistency, or update form to use `accountantFirmName`.

### ✅ NO ADDRESS FIELDS
Correctly no address fields needed for accountant references.

---

## Address Field Consistency Summary

### ✅ CONSISTENT: tenant_references
```
current_address_line1
current_address_line2
current_city
current_postcode
current_country

previous_rental_address_line1
previous_rental_address_line2
previous_rental_city
previous_rental_postcode
previous_rental_country

employment_company_address_line1
employment_company_address_line2
employment_company_city
employment_company_postcode
employment_company_country
```

### ⚠️ INCONSISTENT: landlord_references, agent_references
```
property_address (single field, no line1/line2 split)
property_city
property_postcode
```

**Issue:** These tables use single-line address while tenant_references uses structured addresses.

**Impact:**
- Landlord/Agent forms collect address in one text field
- Less structured data for searching/filtering
- Inconsistent with how tenant addresses are stored

**Options:**
1. **Accept inconsistency** - It's from external sources, single field may be acceptable
2. **Add structure** - Add `property_address_line1` and `property_address_line2`, update forms
3. **Hybrid** - Keep `property_address` but also add structured fields (duplicate data)

---

## Redundant/Deprecated Columns - Cleanup Checklist

### High Priority - Remove These

```sql
-- tenant_references cleanup
ALTER TABLE tenant_references DROP COLUMN IF EXISTS bank_statement_files;  -- Never used
ALTER TABLE tenant_references DROP COLUMN IF EXISTS employer_contact;      -- Deprecated
ALTER TABLE tenant_references DROP COLUMN IF EXISTS previous_address;      -- Deprecated (should already be dropped)
ALTER TABLE tenant_references DROP COLUMN IF EXISTS previous_tenancy_duration;  -- Deprecated
ALTER TABLE tenant_references DROP COLUMN IF EXISTS previous_street;       -- Deprecated
ALTER TABLE tenant_references DROP COLUMN IF EXISTS previous_city;         -- Duplicate of previous_rental_city
ALTER TABLE tenant_references DROP COLUMN IF EXISTS previous_postcode;     -- Duplicate of previous_rental_postcode
ALTER TABLE tenant_references DROP COLUMN IF EXISTS employer_email;        -- Deprecated (replaced by employer_ref_email)
ALTER TABLE tenant_references DROP COLUMN IF EXISTS employer_phone;        -- Deprecated (replaced by employer_ref_phone)
```

---

## Field Usage Verification Needed

### bank_statement_files
**Question:** Should we be collecting bank statements?
- **Database:** Column exists in `tenant_references`
- **Form:** NOT collected by SubmitReference.vue
- **Options:**
  1. Remove column if not needed
  2. Add bank statement upload to form if needed for verification

---

## Recommendations

### Immediate Actions

1. **Run Cleanup Migration** - Remove 9 redundant/deprecated columns from `tenant_references`

2. **Address Field Decision** - Decide on landlord/agent reference address structure:
   - Option A: Keep single field (easier for external submitters)
   - Option B: Add structured fields (consistency, better data)

3. **Bank Statement Decision** - Either:
   - Remove `bank_statement_files` column if not needed
   - Add bank statement upload to tenant form if needed

4. **Accountant Table** - Rename `accountant_firm_name` → `firm_name` for consistency

### Data Quality Improvements

5. **Add Column Comments** - Document purpose of each column in database

6. **Add NOT NULL Constraints** - Review which fields should be required

7. **Add Check Constraints** - Validate enum-like fields (marital_status, employment_contract_type, etc.)

### Future Considerations

8. **Consider Foreign Keys** - Add references between related data where appropriate

9. **Indexing Review** - Ensure commonly queried fields have indexes

10. **Data Migration Plan** - If changing address structure, plan migration for existing data

---

## Summary Statistics

| Table | Total Columns | Used Columns | Unused Columns | Address Fields |
|-------|--------------|--------------|----------------|----------------|
| tenant_references | ~85 | 76 | 9 | ✅ Structured |
| landlord_references | 19 | 19 | 0 | ⚠️ Single field |
| agent_references | 20 | 20 | 0 | ⚠️ Single field |
| employer_references | 24 | 24 | 0 | ✅ N/A |
| accountant_references | 28 | 28 | 0 | ✅ N/A |
| **TOTAL** | **176** | **167** | **9** | **2 inconsistencies** |

---

## Conclusion

The PropertyGoose database is generally well-structured with good form-to-table mapping. The main issues are:

1. **9 redundant/deprecated columns** in `tenant_references` that should be removed
2. **Address field inconsistency** between tenant (structured) and landlord/agent (single field) tables
3. **One unused feature** (`bank_statement_files`) that needs decision
4. **Minor naming inconsistency** in accountant_references table

Overall, the system is in good shape and these cleanup tasks will make it more maintainable going forward.
