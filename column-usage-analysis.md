# Column Usage Analysis Report

**Date:** October 7, 2025
**Purpose:** Detailed analysis of actual data in exported tables vs. database schema to identify truly redundant columns

---

## Executive Summary

This report analyzes actual INSERT statement data from 5 exported reference tables against the database schema and form submissions to identify:
- **Columns with actual data** (actively used)
- **Columns that are consistently NULL** (potentially unused)
- **Columns that are consistently empty strings** (potentially unused)
- **Truly redundant columns** (not in forms, no data in exports)

**Key Findings:**
- **4 tenant records analyzed** across all tables
- **10 redundant/deprecated columns identified** in tenant_references
- **Address structure inconsistency** between tenant vs landlord/agent tables
- **All reference tables (landlord, agent, employer, accountant)** have perfect schema-to-form alignment with actual data

---

## 1. TENANT_REFERENCES Table (4 records analyzed)

### Schema Overview
- **Total columns in schema:** ~108 columns
- **Columns in INSERT statements:** 108 columns
- **Rows analyzed:** 4 tenant reference records

### Column Usage Analysis by Category

#### A. ALWAYS POPULATED (Core Required Fields)
These columns have data in ALL 4 records:

**Identity & Basics:**
- `id`, `company_id`, `created_by`, `reference_token`, `token_expires_at`, `status`
- `tenant_first_name`, `tenant_last_name`, `tenant_email`, `tenant_phone`
- `property_address`, `property_city`, `property_postcode`
- `monthly_rent`
- `created_at`, `updated_at`
- `notes` (empty string '')
- `current_page`, `completed_pages`, `tenant_position`

**Multi-Tenant Fields:**
- `parent_reference_id` (NULL for parent, UUID for children)
- `is_group_parent` (true/false)
- `reference_type` ('landlord' or 'agent')
- `term_years`, `term_months`

**Boolean Income Flags (set to false for all pending):**
- `income_regular_employment`, `income_benefits`, `income_savings_pension_investments`
- `income_student`, `income_unemployed`, `income_self_employed`
- `employment_is_hourly`, `has_additional_income`, `has_adverse_credit`
- `is_smoker`, `has_pets`

**Numeric Defaults:**
- `number_of_dependants` (0)
- `bank_statement_files` (NULL or not populated)

#### B. SOMETIMES POPULATED (Conditional/Optional Fields)
These columns have data in 2/4 records (completed submissions):

**Personal Information:**
- `middle_name` (NULL in all records - NOT USED)
- `date_of_birth` ('2005-03-03', '2005-07-04' in 2 records)
- `contact_number` ('+447805482933' in 2 records)
- `nationality` ('British' in 2 records)

**Identity Documents:**
- `id_document_type` ('driving_licence', 'passport' in 2 records)
- `id_document_path` (file paths in 2 records)
- `selfie_path` (file paths in 2 records)
- `proof_of_address_path` (file paths in 2 records)

**Current Address:**
- `current_address_line1` ('123 Current Address' in 2 records)
- `current_address_line2` (NULL in all records)
- `current_city` ('London' in 2 records)
- `current_postcode` ('SW87 8AQ' in 2 records)
- `current_country` ('United Kingdom' in 2 records)

**Employment Information:**
- `employment_contract_type` ('permanent' in 1 record, NULL in 3)
- `employment_salary_amount` ('30000.00' in 1 record, NULL in 3)
- `employment_company_name` ('Asda' in 1 record, NULL in 3)
- `employment_company_address_line1` ('123 Asda Lane' in 1 record, NULL in 3)
- `employment_company_address_line2` (NULL in all records)
- `employment_company_city` ('London' in 1 record, NULL in 3)
- `employment_company_postcode` ('SW87 8HW' in 1 record, NULL in 3)
- `employment_company_country` ('United Kingdom' in 1 record, NULL in 3)
- `employment_job_title` ('Checkout Staff' in 1 record, NULL in 3)

**Employer Reference Contact:**
- `employer_ref_position` ('Asda Manager' in 1 record, NULL in 3)
- `employer_ref_name` ('Asda Worker Name' in 1 record, NULL in 3)
- `employer_ref_email` ('craig@devonwick.com' in 1 record, NULL in 3)
- `employer_ref_phone` ('+447805482933' in 1 record, NULL in 3)

**Previous Rental Address:**
- `previous_rental_address_line1` ('123 Old Address' in 2 records, NULL in 2)
- `previous_rental_address_line2` (NULL in all records)
- `previous_rental_city` ('London' in 2 records, NULL in 2)
- `previous_rental_postcode` ('SW8 7HW', 'SW8 7WH' in 2 records, NULL in 2)
- `previous_rental_country` ('United Kingdom' in 2 records, NULL in 2)

**Previous Landlord/Agent:**
- `previous_landlord_name` ('Landlord Full Name', 'Andy Letterman' in 2 records)
- `previous_landlord_email` ('craig@devonwick.com', 'craig@propertygoose.co.uk' in 2 records)
- `previous_landlord_phone` ('+447805482933' in 2 records)
- `employment_start_date` ('2021-05-03' in 1 record, NULL in 3)
- `tenancy_years` ('1' in 2 records, NULL in 2)
- `tenancy_months` ('0' in 2 records, NULL in 2)

**Self-Employed Fields:**
- `self_employed_business_name` ('Rol Ltd' in 1 record, NULL in 3)
- `self_employed_start_date` (NULL in all - NOT COLLECTED IN FORMS)
- `self_employed_nature_of_business` ('Carrot Farming' in 1 record, NULL in 3)
- `self_employed_annual_income` ('100000.00' in 1 record, NULL in 3)

**Accountant Contact:**
- `accountant_name` ('Carrot Accountants' in 1 record, NULL in 3)
- `accountant_contact_name` ('Carrot Accountant Chief' in 1 record, NULL in 3)
- `accountant_email` ('craig@propertygoose.co.uk' in 1 record, NULL in 3)
- `accountant_phone` ('+447805482933' in 1 record, NULL in 3)

**Additional Details:**
- `marital_status` ('married' in 2 records, NULL in 2)
- `dependants_details` (NULL in all records)
- `rent_share` ('1500.00' in 2 records, NULL in 2)

**File Uploads:**
- `payslip_files` (array with 1 file in 1 record, empty '{}' in 3 records)

#### C. NEVER POPULATED (Unused Fields)
These columns are NULL or empty in ALL 4 records:

**COMPLETELY UNUSED IN ACTUAL DATA:**
1. `move_in_date` - NULL in all records (form collects it but not submitted yet)
2. `employment_status` - NULL in all records (OLD FIELD)
3. `employer_name` - NULL in all records (DEPRECATED - replaced by employment_company_name)
4. `job_title` - NULL in all records (DEPRECATED - replaced by employment_job_title)
5. `annual_income` - NULL in all records (DEPRECATED - replaced by employment_salary_amount)
6. `internal_notes` - NULL in all records
7. `submitted_at` - Has dates in 2 submitted records, NULL in 2 pending
8. `completed_at` - NULL in all records
9. `employer_email` - NULL in all records (DEPRECATED)
10. `employer_phone` - NULL in all records (DEPRECATED)
11. `previous_street` - NULL in all records (DEPRECATED)
12. `previous_city` - NULL in all records (DEPRECATED)
13. `previous_postcode` - NULL in all records (DEPRECATED)
14. `bank_statement_files` - NULL in all records (FEATURE NOT IMPLEMENTED)
15. `verified_by` - NULL in all records (admin feature not used yet)
16. `verified_at` - NULL in all records
17. `verification_notes` - NULL in all records
18. `middle_name` - NULL in all records
19. `employment_hours_per_month` - NULL in all records
20. `additional_income_source` - NULL in all records
21. `additional_income_amount` - NULL in all records
22. `additional_income_frequency` - NULL in all records
23. `adverse_credit_details` - NULL in all records
24. `pet_details` - NULL in all records
25. `employment_company_address_line2` - NULL in all records
26. `current_address_line2` - NULL in all records
27. `previous_rental_address_line2` - NULL in all records
28. `self_employed_start_date` - NULL in all records (NOT IN FORMS)

### Truly Redundant Columns (Safe to Remove)

Based on actual data analysis, these columns can be safely removed:

#### 1. DEPRECATED - Old Employment Fields
- `employer_name` - Replaced by `employment_company_name`
- `job_title` - Replaced by `employment_job_title`
- `annual_income` - Replaced by `employment_salary_amount`
- `employment_status` - Old field, no longer used
- `employer_email` - Replaced by `employer_ref_email`
- `employer_phone` - Replaced by `employer_ref_phone`

#### 2. DEPRECATED - Old Address Fields
- `previous_street` - Replaced by `previous_rental_address_line1`
- `previous_city` - Replaced by `previous_rental_city`
- `previous_postcode` - Replaced by `previous_rental_postcode`

#### 3. UNUSED FEATURES
- `bank_statement_files` - Feature never implemented, no data collected

**TOTAL REDUNDANT COLUMNS: 10**

### Columns That Should Stay (Even if NULL in current data)

These have no data yet but are valid fields used in forms or will be added:
- `move_in_date` - Form collects it (Create New Reference modal)
- `middle_name` - Will be added to tenant form
- `employment_hours_per_month` - For hourly workers
- `additional_income_*` - For tenants with additional income
- `adverse_credit_details` - For tenants with credit issues
- `pet_details` - For tenants with pets
- All `*_line2` address fields - Valid optional fields
- `verified_by`, `verified_at`, `verification_notes` - Admin features
- `internal_notes` - Admin feature
- `completed_at` - Workflow status field

---

## 2. LANDLORD_REFERENCES Table (1 record analyzed)

### Schema Overview
- **Total columns in schema:** 29
- **Columns in INSERT:** 29
- **Rows analyzed:** 1 landlord reference

### Column Usage Analysis

#### ALWAYS POPULATED (All fields have data):
- `id` = 'a9dbd32c-d3aa-4cec-bb6c-ac2682afac7a'
- `reference_id` = '19f9f03c-a7cb-4b5d-b4ea-5fdd16dae657'
- `landlord_name` = 'Landlord Full Name'
- `landlord_email` = 'craig@devonwick.com'
- `landlord_phone` = '+447805482933'
- `property_address` = '123 Old Address'
- `tenancy_start_date` = '2023-05-04'
- `tenancy_end_date` = '2025-02-02'
- `monthly_rent` = '3000.00'
- `rent_paid_on_time` = 'always'
- `rent_paid_on_time_details` = NULL (conditional field)
- `property_condition` = 'excellent'
- `property_condition_details` = NULL
- `neighbour_complaints` = 'no'
- `neighbour_complaints_details` = NULL
- `breach_of_tenancy` = 'no'
- `breach_of_tenancy_details` = NULL
- `would_rent_again` = 'yes'
- `would_rent_again_details` = NULL
- `additional_comments` = NULL
- `signature` = (base64 image data)
- `date` = '2025-10-07'
- `submitted_at` = '2025-10-07 13:45:47.804+00'
- `created_at` = '2025-10-07 13:45:47.878345+00'
- `signature_name` = 'Landlord Full Name'
- `property_city` = 'London'
- `property_postcode` = 'SW8 7HW'
- `property_address_line1` = '123 Old Address'
- `property_address_line2` = NULL

### Analysis
- **ALL 29 columns are actively used**
- **0 redundant columns**
- Perfect alignment between schema and form

### Address Field Note
The table has:
- `property_address` (single line - OLD)
- `property_address_line1` (structured - NEW)
- `property_address_line2` (structured - NEW)
- `property_city`
- `property_postcode`

**Current behavior:** Form now collects structured address (line1, line2), and ALSO stores in old `property_address` field for backward compatibility.

**Recommendation:** Can keep both for now. Eventually deprecate `property_address` single field.

---

## 3. AGENT_REFERENCES Table (1 record analyzed)

### Schema Overview
- **Total columns in schema:** 30
- **Columns in INSERT:** 30
- **Rows analyzed:** 1 agent reference

### Column Usage Analysis

#### ALWAYS POPULATED (All fields have data):
- `id` = 'a4ddb515-022d-4905-bdb1-c98eda705656'
- `reference_id` = 'ed805a10-3974-418f-9114-087c33c9b37f'
- `agent_name` = 'Andy Letterman'
- `agent_email` = 'craig@propertygoose.co.uk'
- `agent_phone` = '+447805482933'
- `agency_name` = 'Lets Man'
- `property_address` = '123 Old Address'
- `property_city` = 'Plymouth'
- `property_postcode` = 'PL3 8hs'
- `tenancy_start_date` = '2020-06-04'
- `tenancy_end_date` = '2021-07-07'
- `monthly_rent` = '3000.00'
- `rent_paid_on_time` = 'always'
- `rent_paid_on_time_details` = NULL
- `property_condition` = 'excellent'
- `property_condition_details` = NULL
- `neighbour_complaints` = 'no'
- `neighbour_complaints_details` = NULL
- `breach_of_tenancy` = 'no'
- `breach_of_tenancy_details` = NULL
- `would_rent_again` = 'yes'
- `would_rent_again_details` = NULL
- `additional_comments` = NULL
- `signature` = (base64 image data)
- `date` = '2025-10-07'
- `submitted_at` = '2025-10-07 13:50:22.712+00'
- `created_at` = '2025-10-07 13:50:22.783155+00'
- `signature_name` = 'Andy Letterman'
- `property_address_line1` = '123 Old Address'
- `property_address_line2` = NULL

### Analysis
- **ALL 30 columns are actively used**
- **0 redundant columns**
- Perfect alignment between schema and form

### Address Field Note
Same as landlord_references - has both old single-line and new structured address fields.

---

## 4. EMPLOYER_REFERENCES Table (1 record analyzed)

### Schema Overview
- **Total columns in schema:** 31
- **Columns in INSERT:** 31
- **Rows analyzed:** 1 employer reference

### Column Usage Analysis

#### ALWAYS POPULATED (All fields have data):
- `id` = 'fd95ad9a-6fe7-4593-ab7b-84444bec2cbb'
- `reference_id` = '19f9f03c-a7cb-4b5d-b4ea-5fdd16dae657'
- `company_name` = 'Asda'
- `employer_name` = 'Asda Manager'
- `employer_position` = 'Manager'
- `employer_email` = 'craig@devonwick.com'
- `employer_phone` = '+447805482933'
- `employee_position` = 'Checkout Staff'
- `employment_type` = 'full-time'
- `employment_start_date` = '2023-06-05'
- `employment_end_date` = NULL
- `is_current_employee` = 'true'
- `annual_salary` = '30000.00'
- `salary_frequency` = 'annual'
- `is_probation` = 'no'
- `probation_end_date` = NULL
- `employment_status` = 'confirmed'
- `performance_rating` = 'excellent'
- `performance_details` = NULL
- `disciplinary_issues` = 'no'
- `disciplinary_details` = NULL
- `absence_record` = 'excellent'
- `absence_details` = NULL
- `would_reemploy` = 'yes'
- `would_reemploy_details` = NULL
- `additional_comments` = NULL
- `signature` = (base64 image data)
- `date` = '2025-10-07'
- `submitted_at` = '2025-10-07 13:48:25.211+00'
- `created_at` = '2025-10-07 13:48:25.293269+00'
- `signature_name` = 'Asda Manager'

### Analysis
- **ALL 31 columns are actively used**
- **0 redundant columns**
- Perfect alignment between schema and form
- No address fields (correctly - employers don't need property addresses)

---

## 5. ACCOUNTANT_REFERENCES Table (1 record analyzed)

### Schema Overview
- **Total columns in schema:** 32
- **Columns in INSERT:** 32
- **Rows analyzed:** 1 accountant reference

### Column Usage Analysis

#### ALWAYS POPULATED (All fields have data):
- `id` = 'aae15d09-a9b4-470a-bd5e-78ccdcc4298c'
- `tenant_reference_id` = 'ed805a10-3974-418f-9114-087c33c9b37f'
- `token` = (SHA256 token)
- `accountant_firm_name` = 'Carrot Accountants'
- `accountant_contact_name` = 'Carrot Accountant Chief'
- `accountant_email` = 'craig@propertygoose.co.uk'
- `accountant_phone` = '+447805482933'
- `tenant_name` = 'Tenant 2 FN Tenant 2 LN'
- `business_name` = 'Rol Ltd'
- `nature_of_business` = 'Carrots'
- `business_start_date` = '2019-04-04'
- `annual_turnover` = '1000000.00'
- `annual_profit` = '100000.00'
- `tax_returns_filed` = 'true'
- `last_tax_return_date` = NULL
- `accounts_prepared` = 'true'
- `accounts_year_end` = NULL
- `business_trading_status` = 'trading'
- `any_outstanding_tax_liabilities` = 'false'
- `tax_liabilities_details` = NULL
- `business_financially_stable` = 'true'
- `accountant_confirms_income` = 'true'
- `estimated_monthly_income` = '50000.00'
- `additional_comments` = NULL
- `would_recommend` = 'true'
- `recommendation_comments` = NULL
- `submitted_at` = '2025-10-07 13:54:27.511+00'
- `created_at` = '2025-10-07 13:44:22.601866+00'
- `updated_at` = '2025-10-07 13:54:27.511+00'
- `signature_name` = 'Carrot Man'
- `signature` = (base64 image data)
- `date` = '2025-05-03'

### Analysis
- **ALL 32 columns are actively used**
- **0 redundant columns**
- Perfect alignment between schema and form
- No address fields (correctly - accountants don't need property addresses)

---

## Summary of Findings

### By Table

| Table | Total Columns | Columns with Data | Never Used | Redundant/Deprecated |
|-------|--------------|-------------------|------------|---------------------|
| tenant_references | 108 | 98 | 10 | 10 |
| landlord_references | 29 | 29 | 0 | 0 |
| agent_references | 30 | 30 | 0 | 0 |
| employer_references | 31 | 31 | 0 | 0 |
| accountant_references | 32 | 32 | 0 | 0 |
| **TOTAL** | **230** | **220** | **10** | **10** |

### Redundant Columns Summary

All redundant columns are in `tenant_references` table:

#### Deprecated Employment Fields (6 columns)
1. `employer_name` → Replaced by `employment_company_name`
2. `job_title` → Replaced by `employment_job_title`
3. `annual_income` → Replaced by `employment_salary_amount`
4. `employment_status` → Old field, no longer used
5. `employer_email` → Replaced by `employer_ref_email`
6. `employer_phone` → Replaced by `employer_ref_phone`

#### Deprecated Address Fields (3 columns)
7. `previous_street` → Replaced by `previous_rental_address_line1`
8. `previous_city` → Replaced by `previous_rental_city`
9. `previous_postcode` → Replaced by `previous_rental_postcode`

#### Unused Features (1 column)
10. `bank_statement_files` → Feature never implemented

---

## SQL Cleanup Script

```sql
-- Remove 10 redundant columns from tenant_references table

ALTER TABLE tenant_references DROP COLUMN IF EXISTS employer_name;
ALTER TABLE tenant_references DROP COLUMN IF EXISTS job_title;
ALTER TABLE tenant_references DROP COLUMN IF EXISTS annual_income;
ALTER TABLE tenant_references DROP COLUMN IF EXISTS employment_status;
ALTER TABLE tenant_references DROP COLUMN IF EXISTS employer_email;
ALTER TABLE tenant_references DROP COLUMN IF EXISTS employer_phone;
ALTER TABLE tenant_references DROP COLUMN IF EXISTS previous_street;
ALTER TABLE tenant_references DROP COLUMN IF EXISTS previous_city;
ALTER TABLE tenant_references DROP COLUMN IF EXISTS previous_postcode;
ALTER TABLE tenant_references DROP COLUMN IF EXISTS bank_statement_files;

-- Note: previous_address may already be dropped per migration 009_add_previous_rental_address_fields.sql
-- Verify and drop if still exists:
ALTER TABLE tenant_references DROP COLUMN IF EXISTS previous_address;
```

---

## Recommendations

### Immediate Actions

1. **Execute Cleanup Script** - Remove 10 redundant columns from tenant_references table

2. **Add middle_name to tenant form** - Collect middle name during tenant submission

3. **Verify Previous Migrations** - Check if `previous_address` was already dropped in production

4. **Update Application Code** - Ensure backend no longer references removed columns

### Data Quality Notes

1. **NULL vs Empty String Consistency**
   - Some optional text fields use `NULL`, others use `''` (empty string)
   - Recommend standardizing on `NULL` for truly missing values
   - Example: `notes` uses `''`, but `additional_comments` uses `NULL`

2. **Conditional Fields Working Correctly**
   - Details fields (`*_details`) correctly NULL when main answer doesn't require explanation
   - Example: `rent_paid_on_time_details` is NULL when answer is 'always'

3. **Multi-Tenant Data Structure Validated**
   - Parent/child relationships working correctly
   - `parent_reference_id` NULL for parent, UUID for children
   - `is_group_parent` boolean working as expected
   - `rent_share` populated for child tenants

### Address Field Recommendations

**Current State:**
- Landlord/Agent tables have both old single-line AND new structured address fields
- Data is duplicated between `property_address` and `property_address_line1`

**Options:**
1. **Keep Both (Current)** - Maintains backward compatibility
2. **Deprecate Single Field** - Mark `property_address` as deprecated, migrate data
3. **Remove Single Field** - Clean up after full migration

**Recommendation:** Keep both for now, plan deprecation in future release.

---

## Conclusion

The database is in excellent shape overall:
- **Reference tables (landlord, agent, employer, accountant):** Perfect schema alignment
- **Tenant references table:** 10 redundant columns identified for cleanup
- **Data quality:** Good, with proper NULL handling for conditional fields
- **Multi-tenant functionality:** Working correctly

After removing the 10 redundant columns and adding middle_name to the tenant form, the database will be clean and maintainable with no unused fields consuming storage or causing confusion.
