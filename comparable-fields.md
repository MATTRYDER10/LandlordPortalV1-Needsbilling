# Comparable Fields Across Forms

This document maps fields that can be compared between tenant-provided information and third-party references.

## Employment Information Comparison

| Field Category | Tenant Provided (tenant_references) | Employer Provided (employer_references) |
|---|---|---|
| **Company Name** | `employment_company_name_encrypted` | `company_name_encrypted` |
| **Employee Position** | `employment_position_encrypted` | `employee_position_encrypted` |
| **Employment Start Date** | `employment_start_date` | `employment_start_date` |
| **Employment End Date** | N/A (assumed current) | `employment_end_date` |
| **Salary/Income** | `employment_salary_amount_encrypted` | `annual_salary_encrypted` |
| **Employment Type** | `employment_contract_type` | `employment_type` |
| **Is Current Employee** | Implied by form submission | `is_current_employee` |
| **Employer Address Line 1** | `employment_company_address_line1_encrypted` | N/A |
| **Employer Address Line 2** | `employment_company_address_line2_encrypted` | N/A |
| **Employer City** | `employment_company_city_encrypted` | N/A |
| **Employer Postcode** | `employment_company_postcode_encrypted` | N/A |
| **Employer Country** | `employment_company_country_encrypted` | N/A |

---

## Previous Rental History - Landlord Comparison

| Field Category | Tenant Provided (tenant_references) | Landlord Provided (landlord_references) |
|---|---|---|
| **Property Address** | `previous_rental_address_line1_encrypted` | `property_address_encrypted` |
| **Property Address Line 2** | `previous_rental_address_line2_encrypted` | N/A (combined in single field) |
| **Property City** | `previous_rental_city_encrypted` | `property_city_encrypted` |
| **Property Postcode** | `previous_rental_postcode_encrypted` | `property_postcode_encrypted` |
| **Property Country** | `previous_rental_country_encrypted` | N/A |
| **Monthly Rent** | Tenant doesn't provide for previous address | `monthly_rent_encrypted` |
| **Tenancy Start Date** | Can be calculated from current date - tenancy duration | `tenancy_start_date` |
| **Tenancy End Date** | Can be calculated from current date - tenancy duration | `tenancy_end_date` |
| **Tenancy Duration** | `tenancy_years`, `tenancy_months` | Calculated from start/end dates |
| **Landlord Name** | `previous_landlord_name_encrypted` | `landlord_name_encrypted` |
| **Landlord Email** | `previous_landlord_email_encrypted` | `landlord_email_encrypted` |
| **Landlord Phone** | `previous_landlord_phone_encrypted` | `landlord_phone_encrypted` |

---

## Previous Rental History - Agent Comparison

| Field Category | Tenant Provided (tenant_references) | Agent Provided (agent_references) |
|---|---|---|
| **Property Address** | `previous_rental_address_line1_encrypted` | `property_address_encrypted` |
| **Property Address Line 2** | `previous_rental_address_line2_encrypted` | N/A (combined in single field) |
| **Property City** | `previous_rental_city_encrypted` | `property_city_encrypted` |
| **Property Postcode** | `previous_rental_postcode_encrypted` | `property_postcode_encrypted` |
| **Property Country** | `previous_rental_country_encrypted` | N/A |
| **Monthly Rent** | Tenant doesn't provide for previous address | `monthly_rent_encrypted` |
| **Tenancy Start Date** | Can be calculated from current date - tenancy duration | `tenancy_start_date` |
| **Tenancy End Date** | Can be calculated from current date - tenancy duration | `tenancy_end_date` |
| **Tenancy Duration** | `tenancy_years`, `tenancy_months` | Calculated from start/end dates |
| **Agent/Agency Name** | `previous_landlord_name_encrypted` (reused for agent) | `agent_name_encrypted` |
| **Agency Name** | N/A | `agency_name_encrypted` |
| **Agent Email** | `previous_landlord_email_encrypted` (reused for agent) | `agent_email_encrypted` |
| **Agent Phone** | `previous_landlord_phone_encrypted` (reused for agent) | `agent_phone_encrypted` |

---

## Self-Employment - Accountant Comparison

| Field Category | Tenant Provided (tenant_references) | Accountant Provided (accountant_references) |
|---|---|---|
| **Business Name** | `self_employed_business_name_encrypted` | `business_name_encrypted` |
| **Nature of Business** | `self_employed_nature_of_business_encrypted` | `nature_of_business_encrypted` |
| **Business Start Date** | `self_employed_start_date` | `business_start_date` |
| **Annual Income** | `self_employed_annual_income_encrypted` | `annual_turnover_encrypted` OR `annual_profit_encrypted` OR `estimated_monthly_income_encrypted` * 12 |
| **Accountant Name** | `accountant_name_encrypted` | `accountant_name_encrypted` |
| **Accountant Firm** | `accountant_firm_encrypted` | `accountant_firm_encrypted` |
| **Accountant Email** | `accountant_email_encrypted` | `accountant_email_encrypted` |
| **Accountant Phone** | `accountant_phone_encrypted` | `accountant_phone_encrypted` |

---

## Grouped Comparison Rows

Here's how the data should be grouped into comparison rows for display:

### Employment Comparison Rows
1. **Company Name** - tenant vs employer
2. **Position/Job Title** - tenant vs employer
3. **Employment Start Date** - tenant vs employer
4. **Employment End Date** - N/A vs employer (if not current)
5. **Annual Salary** - tenant vs employer
6. **Employment Type/Contract** - tenant vs employer
7. **Company Address** - tenant vs N/A (employer doesn't provide)

### Landlord Reference Comparison Rows
1. **Property Address Line 1** - tenant vs landlord
2. **Property City** - tenant vs landlord
3. **Property Postcode** - tenant vs landlord
4. **Monthly Rent** - N/A vs landlord (tenant doesn't provide for previous)
5. **Tenancy Start Date** - calculated from tenant vs landlord
6. **Tenancy End Date** - calculated from tenant vs landlord
7. **Tenancy Duration** - tenant vs calculated from landlord
8. **Landlord Name** - tenant vs landlord
9. **Landlord Email** - tenant vs landlord
10. **Landlord Phone** - tenant vs landlord

### Agent Reference Comparison Rows
1. **Property Address Line 1** - tenant vs agent
2. **Property City** - tenant vs agent
3. **Property Postcode** - tenant vs agent
4. **Monthly Rent** - N/A vs agent (tenant doesn't provide for previous)
5. **Tenancy Start Date** - calculated from tenant vs agent
6. **Tenancy End Date** - calculated from tenant vs agent
7. **Tenancy Duration** - tenant vs calculated from agent
8. **Agent Name** - tenant vs agent
9. **Agency Name** - N/A vs agent
10. **Agent Email** - tenant vs agent
11. **Agent Phone** - tenant vs agent

### Accountant Reference Comparison Rows
1. **Business Name** - tenant vs accountant
2. **Nature of Business** - tenant vs accountant
3. **Business Start Date** - tenant vs accountant
4. **Annual Income/Turnover** - tenant vs accountant (note: different metrics)
5. **Annual Profit** - N/A vs accountant
6. **Estimated Monthly Income** - calculated from tenant vs accountant
7. **Accountant Name** - tenant vs accountant
8. **Accountant Firm** - tenant vs accountant
9. **Accountant Email** - tenant vs accountant
10. **Accountant Phone** - tenant vs accountant

---

## Notes on Data Comparison

### Important Considerations:

1. **Date Calculations**:
   - Tenant provides duration (years/months), references provide exact dates
   - Need to calculate comparable values for display

2. **Income/Salary Formats**:
   - Employer provides annual salary
   - Accountant provides monthly income, annual turnover, and annual profit
   - May need to normalize to same period for comparison

3. **Address Formats**:
   - Tenant provides structured address (line1, line2, city, postcode, country)
   - References may provide combined address strings
   - Need to handle comparison of structured vs unstructured data

4. **Multiple Previous Addresses**:
   - Tenant can have multiple previous addresses in `tenant_reference_previous_addresses`
   - Need to match the correct previous address to the landlord/agent reference

5. **Reference Type Field**:
   - `tenant_references.reference_type` indicates whether landlord or agent reference
   - Use this to determine which comparison table to show

6. **Missing Data**:
   - Some fields may not have equivalents (marked as N/A)
   - Handle gracefully in UI with appropriate messaging

7. **Encryption**:
   - All sensitive fields are encrypted
   - Must decrypt before comparison/display
