# Non-Comparable Fields (No Direct Comparison)

These fields need to be displayed but don't have direct comparisons between tenant and third-party data.

---

## Employer Reference - Assessment Fields (No Tenant Equivalent)

These are the employer's evaluations that need to be displayed separately:

### Employment Status & Probation
- `is_probation` - Is employee on probation
- `probation_end_date` - Probation end date
- `employment_status` - Current employment status
- `is_current_employee` - Still employed (boolean)

### Performance & Conduct Assessments
- `performance_rating` - Performance rating/score
- `performance_details_encrypted` - Performance details
- `disciplinary_issues` - Has disciplinary issues (yes/no)
- `disciplinary_details_encrypted` - Details of disciplinary issues
- `absence_record` - Absence record rating
- `absence_details_encrypted` - Absence details
- `would_reemploy` - Would re-employ (yes/no)
- `would_reemploy_details_encrypted` - Re-employment details

### Additional Information
- `additional_comments_encrypted` - Employer's additional comments
- `employer_name_encrypted` - Name of person giving reference
- `employer_position_encrypted` - Position of person giving reference
- `date` - Reference date
- `signature_encrypted` - Employer signature

### Payment Information
- `salary_frequency` - How often salary is paid
- `employment_is_hourly` - Is paid hourly (from tenant form)
- `employment_hours_per_month` - Hours per month (from tenant form)

---

## Landlord Reference - Assessment Fields (No Tenant Equivalent)

These are the landlord's evaluations of the previous tenancy:

### Tenancy Performance
- `rent_paid_on_time` - Rent payment record (yes/no/partial)
- `rent_paid_on_time_details_encrypted` - Payment history details
- `property_condition` - Condition of property rating
- `property_condition_details_encrypted` - Property condition details
- `neighbour_complaints` - Were there complaints (yes/no)
- `neighbour_complaints_details_encrypted` - Complaint details
- `breach_of_tenancy` - Any breaches (yes/no)
- `breach_of_tenancy_details_encrypted` - Breach details

### Recommendation
- `would_rent_again` - Would rent to them again (yes/no)
- `would_rent_again_details_encrypted` - Recommendation details
- `additional_comments_encrypted` - Additional comments

### Reference Metadata
- `date` - Reference date
- `signature_encrypted` - Landlord signature
- `signature_name_encrypted` - Name of signatory

---

## Agent Reference - Assessment Fields (No Tenant Equivalent)

Same assessment fields as landlord reference:

### Tenancy Performance
- `rent_paid_on_time` - Rent payment record (yes/no/partial)
- `rent_paid_on_time_details_encrypted` - Payment history details
- `property_condition` - Condition of property rating
- `property_condition_details_encrypted` - Property condition details
- `neighbour_complaints` - Were there complaints (yes/no)
- `neighbour_complaints_details_encrypted` - Complaint details
- `breach_of_tenancy` - Any breaches (yes/no)
- `breach_of_tenancy_details_encrypted` - Breach details

### Recommendation
- `would_rent_again` - Would rent to them again (yes/no)
- `would_rent_again_details_encrypted` - Recommendation details
- `additional_comments_encrypted` - Additional comments

### Reference Metadata
- `date` - Reference date
- `signature_encrypted` - Agent signature
- `signature_name_encrypted` - Name of signatory

---

## Accountant Reference - Assessment Fields (No Tenant Equivalent)

These are the accountant's professional assessments:

### Business Trading Status
- `business_trading_status` - Current trading status
- `business_financially_stable` - Is business financially stable (boolean)

### Tax & Accounts Compliance
- `tax_returns_filed` - Tax returns filed (boolean)
- `last_tax_return_date` - Date of last tax return
- `accounts_prepared` - Accounts prepared (boolean)
- `accounts_year_end` - Accounts year end date
- `any_outstanding_tax_liabilities` - Outstanding tax liabilities (boolean)
- `tax_liabilities_details_encrypted` - Tax liability details

### Financial Figures (Unique to Accountant)
- `annual_turnover_encrypted` - Annual business turnover
- `annual_profit_encrypted` - Annual profit
- `estimated_monthly_income_encrypted` - Estimated monthly income

### Professional Assessment
- `accountant_confirms_income` - Confirms stated income (boolean)
- `would_recommend` - Would recommend as tenant (boolean)
- `recommendation_comments_encrypted` - Recommendation details
- `additional_comments_encrypted` - Additional comments

### Reference Metadata
- `date` - Reference date
- `signature_encrypted` - Accountant signature

---

## Tenant-Only Fields (No Third-Party Equivalent)

### New Property Application Details
- `property_address_encrypted` - NEW property address being applied for
- `property_city_encrypted` - NEW property city
- `property_postcode_encrypted` - NEW property postcode
- `monthly_rent` - Monthly rent for NEW property
- `rent_share` - Tenant's share of rent (group applications)
- `move_in_date` - Intended move-in date
- `term_years` - Desired tenancy term (years)
- `term_months` - Desired tenancy term (months)

### Current Address (Not Previous)
- `current_address_line1_encrypted` - Current address line 1
- `current_address_line2_encrypted` - Current address line 2
- `current_city_encrypted` - Current city
- `current_postcode_encrypted` - Current postcode
- `current_country_encrypted` - Current country
- `time_at_address_years` - Time at current address (years)
- `time_at_address_months` - Time at current address (months)

### Personal Information
- `tenant_first_name_encrypted` - First name
- `middle_name_encrypted` - Middle name
- `tenant_last_name_encrypted` - Last name
- `date_of_birth_encrypted` - Date of birth
- `nationality_encrypted` - Nationality
- `marital_status_encrypted` - Marital status
- `tenant_email_encrypted` - Email
- `tenant_phone_encrypted` - Phone
- `contact_number_encrypted` - Contact number

### Income Source Flags
- `income_regular_employment` - Has employment income
- `income_benefits` - Receives benefits
- `income_savings_pension_investments` - Has savings/pension/investment income
- `income_student` - Is a student
- `income_unemployed` - Currently unemployed
- `income_self_employed` - Is self-employed

### Additional Income
- `has_additional_income` - Has additional income (boolean)
- `additional_income_source_encrypted` - Source of additional income
- `additional_income_amount_encrypted` - Amount of additional income
- `additional_income_frequency` - Frequency of additional income

### Financial Situation
- `savings_amount_encrypted` - Amount in savings
- `has_adverse_credit` - Has adverse credit (boolean)
- `adverse_credit_details_encrypted` - Adverse credit details

### Personal Circumstances
- `is_smoker` - Is a smoker (boolean)
- `has_pets` - Has pets (boolean)
- `pet_details_encrypted` - Pet details
- `number_of_dependants` - Number of dependants
- `dependants_details_encrypted` - Dependant details

### Guarantor Information
- `guarantor_name_encrypted` - Guarantor name
- `guarantor_relationship_encrypted` - Relationship to guarantor

### Document Uploads
- `payslip_files` - Payslip documents (array)
- `id_document_type` - Type of ID
- `id_document_path` - ID document file
- `selfie_path` - Selfie photo
- `proof_of_address_path` - Proof of address document
- `proof_of_funds_path` - Proof of funds document
- `proof_of_additional_income_path` - Additional income proof

### Reference Request Information
- `reference_type` - Type of reference requested (landlord/agent)
- `previous_landlord_address_encrypted` - Previous landlord's address

### Group Application Fields
- `parent_reference_id` - Parent reference ID (for grouped applications)
- `is_group_parent` - Is this the main application (boolean)
- `tenant_position` - Position in tenant group

### System/Metadata Fields
- `status` - Application status
- `reference_token_hash` - Security token
- `token_expires_at` - Token expiration
- `current_page` - Current form page
- `completed_pages` - Completed pages array
- `submitted_at` - Submission timestamp
- `completed_at` - Completion timestamp
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### Notes & Verification
- `notes_encrypted` - General notes
- `internal_notes_encrypted` - Internal staff notes
- `verification_notes_encrypted` - Verification notes
- `verified_by` - Staff member who verified
- `verified_at` - Verification timestamp

### Previous Addresses Table
All fields in `tenant_reference_previous_addresses`:
- `address_line1_encrypted`
- `address_line2_encrypted`
- `city_encrypted`
- `postcode_encrypted`
- `country_encrypted`
- `time_at_address_years`
- `time_at_address_months`
- `address_order`

---

## Display Strategy

### For Staff Reference Detail Page:
You'll likely need **THREE sections**:

1. **Comparison Table** - Side-by-side tenant vs third-party data
2. **Third-Party Assessments** - Ratings, recommendations, performance reviews
3. **Tenant Additional Information** - Personal circumstances, documents, current address, new property details

### For Agent Reference Detail Page:
Similar structure but focused on agent-specific data:

1. **Comparison Table** - Property details, tenancy dates, contact info
2. **Agent Assessment** - Rent payment, property condition, complaints, breaches, recommendation
3. **Additional Context** - Tenant's other references, documents, verification status
