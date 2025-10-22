# Form Fields Reference

This document lists all fields collected from each form in the PropertyGoose application.

## Tenant Reference Form

### Personal Information
- `tenant_first_name_encrypted` - Tenant's first name
- `middle_name_encrypted` - Tenant's middle name
- `tenant_last_name_encrypted` - Tenant's last name
- `tenant_email_encrypted` - Tenant's email address
- `tenant_phone_encrypted` - Tenant's phone number
- `contact_number_encrypted` - Contact number
- `date_of_birth_encrypted` - Date of birth
- `nationality_encrypted` - Nationality
- `marital_status_encrypted` - Marital status

### Current Address
- `current_address_line1_encrypted` - Current address line 1
- `current_address_line2_encrypted` - Current address line 2
- `current_city_encrypted` - Current city
- `current_postcode_encrypted` - Current postcode
- `current_country_encrypted` - Current country
- `time_at_address_years` - Years at current address
- `time_at_address_months` - Months at current address

### Property Information
- `property_address_encrypted` - Property address
- `property_city_encrypted` - Property city
- `property_postcode_encrypted` - Property postcode
- `monthly_rent` - Monthly rent amount
- `rent_share` - Rent share (for group references)
- `move_in_date` - Intended move-in date
- `term_years` - Tenancy term (years)
- `term_months` - Tenancy term (months)

### Employment Information
- `income_regular_employment` - Has regular employment income (boolean)
- `employment_contract_type` - Type of employment contract
- `employment_company_name_encrypted` - Employer company name
- `employment_position_encrypted` - Job position/title
- `employment_start_date` - Employment start date
- `employment_salary_amount_encrypted` - Salary amount
- `employment_is_hourly` - Is paid hourly (boolean)
- `employment_hours_per_month` - Hours worked per month

### Employer Company Address
- `employment_company_address_line1_encrypted` - Employer address line 1
- `employment_company_address_line2_encrypted` - Employer address line 2
- `employment_company_city_encrypted` - Employer city
- `employment_company_postcode_encrypted` - Employer postcode
- `employment_company_country_encrypted` - Employer country

### Self-Employment Information
- `income_self_employed` - Is self-employed (boolean)
- `self_employed_start_date` - Self-employment start date
- `self_employed_business_name_encrypted` - Business name
- `self_employed_nature_of_business_encrypted` - Nature of business
- `self_employed_annual_income_encrypted` - Annual income from self-employment

### Other Income Sources
- `income_benefits` - Receives benefits (boolean)
- `income_savings_pension_investments` - Has savings/pension/investments income (boolean)
- `savings_amount_encrypted` - Amount in savings
- `income_student` - Is a student (boolean)
- `income_unemployed` - Currently unemployed (boolean)
- `has_additional_income` - Has additional income (boolean)
- `additional_income_source_encrypted` - Source of additional income
- `additional_income_amount_encrypted` - Amount of additional income
- `additional_income_frequency` - Frequency of additional income

### Previous Landlord/Rental Information
- `reference_type` - Type of reference (landlord/agent)
- `previous_landlord_name_encrypted` - Previous landlord name
- `previous_landlord_email_encrypted` - Previous landlord email
- `previous_landlord_phone_encrypted` - Previous landlord phone
- `previous_landlord_address_encrypted` - Previous landlord address
- `previous_rental_address_line1_encrypted` - Previous rental address line 1
- `previous_rental_address_line2_encrypted` - Previous rental address line 2
- `previous_rental_city_encrypted` - Previous rental city
- `previous_rental_postcode_encrypted` - Previous rental postcode
- `previous_rental_country_encrypted` - Previous rental country
- `tenancy_years` - Years at previous tenancy
- `tenancy_months` - Months at previous tenancy

### Reference Contact Information
- `employer_ref_name_encrypted` - Employer reference name
- `employer_ref_position` - Employer reference position
- `employer_ref_email_encrypted` - Employer reference email
- `employer_ref_phone_encrypted` - Employer reference phone
- `accountant_name_encrypted` - Accountant name
- `accountant_firm_encrypted` - Accountant firm
- `accountant_email_encrypted` - Accountant email
- `accountant_phone_encrypted` - Accountant phone

### Financial & Personal Details
- `has_adverse_credit` - Has adverse credit history (boolean)
- `adverse_credit_details_encrypted` - Details of adverse credit
- `is_smoker` - Is a smoker (boolean)
- `has_pets` - Has pets (boolean)
- `pet_details_encrypted` - Pet details
- `number_of_dependants` - Number of dependants
- `dependants_details_encrypted` - Dependant details

### Guarantor Information
- `guarantor_name_encrypted` - Guarantor name
- `guarantor_relationship_encrypted` - Relationship to guarantor

### Document Uploads
- `payslip_files` - Array of payslip file paths
- `id_document_type` - Type of ID document
- `id_document_path` - Path to ID document
- `selfie_path` - Path to selfie photo
- `proof_of_address_path` - Path to proof of address
- `proof_of_funds_path` - Path to proof of funds
- `proof_of_additional_income_path` - Path to proof of additional income

### Group Reference Fields
- `parent_reference_id` - ID of parent reference (for grouped applications)
- `is_group_parent` - Is this the parent reference (boolean)
- `tenant_position` - Position in tenant group

### System/Admin Fields
- `status` - Reference status (pending/in_progress/completed/verified)
- `current_page` - Current page in form
- `completed_pages` - Array of completed page numbers
- `notes_encrypted` - General notes
- `internal_notes_encrypted` - Internal staff notes
- `verification_notes_encrypted` - Verification notes
- `submitted_at` - Submission timestamp
- `completed_at` - Completion timestamp
- `verified_by` - Staff user who verified
- `verified_at` - Verification timestamp

---

## Previous Addresses Form

- `tenant_reference_id` - Reference to main tenant reference
- `address_line1_encrypted` - Address line 1
- `address_line2_encrypted` - Address line 2
- `city_encrypted` - City
- `postcode_encrypted` - Postcode
- `country_encrypted` - Country
- `time_at_address_years` - Years at this address
- `time_at_address_months` - Months at this address
- `address_order` - Order of address in history

---

## Employer Reference Form

### Employer Information
- `employer_name_encrypted` - Employer's name
- `employer_position_encrypted` - Employer's position/title
- `employer_email_encrypted` - Employer's email
- `employer_phone_encrypted` - Employer's phone
- `company_name_encrypted` - Company name

### Employment Details
- `employment_type` - Type of employment (full-time/part-time/contract)
- `employment_start_date` - Employment start date
- `employment_end_date` - Employment end date
- `is_current_employee` - Is currently employed (boolean)
- `employee_position_encrypted` - Employee's position
- `annual_salary_encrypted` - Annual salary
- `salary_frequency` - Salary payment frequency

### Probation & Status
- `is_probation` - Is on probation
- `probation_end_date` - Probation end date
- `employment_status` - Current employment status

### Performance & Conduct
- `performance_rating` - Performance rating
- `performance_details_encrypted` - Performance details
- `disciplinary_issues` - Has disciplinary issues
- `disciplinary_details_encrypted` - Disciplinary details
- `absence_record` - Absence record
- `absence_details_encrypted` - Absence details
- `would_reemploy` - Would re-employ
- `would_reemploy_details_encrypted` - Re-employment details
- `additional_comments_encrypted` - Additional comments

### Submission
- `date` - Reference date
- `signature_encrypted` - Digital signature
- `submitted_at` - Submission timestamp

---

## Landlord Reference Form

### Landlord Information
- `landlord_name_encrypted` - Landlord's name
- `landlord_email_encrypted` - Landlord's email
- `landlord_phone_encrypted` - Landlord's phone

### Property Information
- `property_address_encrypted` - Property address
- `property_city_encrypted` - Property city
- `property_postcode_encrypted` - Property postcode
- `monthly_rent_encrypted` - Monthly rent amount

### Tenancy Details
- `tenancy_start_date` - Tenancy start date
- `tenancy_end_date` - Tenancy end date

### Tenancy Assessment
- `rent_paid_on_time` - Rent paid on time (yes/no/partial)
- `rent_paid_on_time_details_encrypted` - Payment details
- `property_condition` - Property condition rating
- `property_condition_details_encrypted` - Condition details
- `neighbour_complaints` - Neighbour complaints (yes/no)
- `neighbour_complaints_details_encrypted` - Complaint details
- `breach_of_tenancy` - Breach of tenancy (yes/no)
- `breach_of_tenancy_details_encrypted` - Breach details
- `would_rent_again` - Would rent to tenant again (yes/no)
- `would_rent_again_details_encrypted` - Re-rental details
- `additional_comments_encrypted` - Additional comments

### Submission
- `date` - Reference date
- `signature_encrypted` - Digital signature
- `signature_name_encrypted` - Signatory name
- `submitted_at` - Submission timestamp

---

## Agent Reference Form

### Agent Information
- `agent_name_encrypted` - Agent's name
- `agency_name_encrypted` - Agency name
- `agent_email_encrypted` - Agent's email
- `agent_phone_encrypted` - Agent's phone

### Property Information
- `property_address_encrypted` - Property address
- `property_city_encrypted` - Property city
- `property_postcode_encrypted` - Property postcode
- `monthly_rent_encrypted` - Monthly rent amount

### Tenancy Details
- `tenancy_start_date` - Tenancy start date
- `tenancy_end_date` - Tenancy end date

### Tenancy Assessment
- `rent_paid_on_time` - Rent paid on time (yes/no/partial)
- `rent_paid_on_time_details_encrypted` - Payment details
- `property_condition` - Property condition rating
- `property_condition_details_encrypted` - Condition details
- `neighbour_complaints` - Neighbour complaints (yes/no)
- `neighbour_complaints_details_encrypted` - Complaint details
- `breach_of_tenancy` - Breach of tenancy (yes/no)
- `breach_of_tenancy_details_encrypted` - Breach details
- `would_rent_again` - Would rent to tenant again (yes/no)
- `would_rent_again_details_encrypted` - Re-rental details
- `additional_comments_encrypted` - Additional comments

### Submission
- `date` - Reference date
- `signature_encrypted` - Digital signature
- `signature_name_encrypted` - Signatory name
- `submitted_at` - Submission timestamp

---

## Accountant Reference Form

### Accountant Information
- `accountant_name_encrypted` - Accountant's name
- `accountant_firm_encrypted` - Accountant's firm
- `accountant_email_encrypted` - Accountant's email
- `accountant_phone_encrypted` - Accountant's phone

### Business Information
- `business_name_encrypted` - Business name
- `nature_of_business_encrypted` - Nature of business
- `business_start_date` - Business start date
- `business_trading_status` - Current trading status

### Financial Information
- `annual_turnover_encrypted` - Annual turnover
- `annual_profit_encrypted` - Annual profit
- `estimated_monthly_income_encrypted` - Estimated monthly income

### Tax & Accounts
- `tax_returns_filed` - Tax returns filed (boolean)
- `last_tax_return_date` - Last tax return date
- `accounts_prepared` - Accounts prepared (boolean)
- `accounts_year_end` - Accounts year end date
- `any_outstanding_tax_liabilities` - Outstanding tax liabilities (boolean)
- `tax_liabilities_details_encrypted` - Tax liability details

### Assessment
- `business_financially_stable` - Business is financially stable (boolean)
- `accountant_confirms_income` - Accountant confirms stated income (boolean)
- `would_recommend` - Would recommend as tenant (boolean)
- `recommendation_comments_encrypted` - Recommendation comments
- `additional_comments_encrypted` - Additional comments

### Submission
- `date` - Reference date
- `signature_encrypted` - Digital signature
- `submitted_at` - Submission timestamp

---

## Other Supporting Tables

### Reference Documents
- `reference_id` - Reference to tenant reference
- `file_name` - Document file name
- `file_url` - Document storage URL
- `file_type` - Document MIME type
- `file_size` - File size in bytes
- `uploaded_by` - User who uploaded the document

### Companies
- `name_encrypted` - Company name
- `address` - Company address
- `city` - Company city
- `postcode` - Company postcode
- `phone` - Company phone
- `website` - Company website
- `logo_url` - Company logo URL
- `primary_color` - Primary brand color
- `button_color` - Button brand color

### Invitations
- `email_encrypted` - Invitee email
- `role` - User role
- `invited_by` - User who sent invitation
- `status` - Invitation status (pending/accepted/expired)
- `expires_at` - Expiration timestamp
- `accepted_at` - Acceptance timestamp
- `token_hash` - Invitation token hash

### Staff Users
- `user_id` - Reference to auth user
- `full_name` - Staff member full name
- `is_active` - Is active staff member (boolean)
