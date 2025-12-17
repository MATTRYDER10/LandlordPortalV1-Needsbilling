# Implementation Plan: Complete Data Display for Verify Flow & References Side Panel

## Executive Summary

This plan addresses missing data fields that are collected from tenant/guarantor forms but not displayed in the Verify flow or References side panel. All database column names and API structures have been verified against the actual codebase.

---

# PART 1: VERIFY FLOW CHANGES

## Section 1.1: Identity & Selfie Section

**File:** `frontend/src/components/staff/verify/sections/IdentitySelfieSection.vue`

### Missing Fields to Add:

| Field | DB Column (tenant_references) | Currently Displayed | Action |
|-------|-------------------------------|---------------------|--------|
| Phone/Contact | `contact_number_encrypted` | ❌ | Add to details grid |
| Middle Name | `middle_name_encrypted` | ❌ (merged in full name) | Add separately |

### Implementation:

#### 1.1.1 Update Props Interface
```typescript
// Add to defineProps
contactNumber?: string
middleName?: string
```

#### 1.1.2 Update Template (details-grid section)
```vue
<!-- Add after email detail-item -->
<div v-if="contactNumber" class="detail-item">
  <p class="detail-label">Phone</p>
  <p class="detail-value">{{ contactNumber }}</p>
</div>
<div v-if="middleName" class="detail-item">
  <p class="detail-label">Middle Name</p>
  <p class="detail-value">{{ middleName }}</p>
</div>
```

#### 1.1.3 Update Parent Component Data Pass
**File:** `frontend/src/components/staff/verify/VerifySectionStack.vue`

The parent must pass these new props. Data comes from `/api/verify/person/:referenceId` response.

**API Response fields to use:**
- `reference.contact_number` (decrypted from `contact_number_encrypted`)
- `reference.middle_name` (decrypted from `middle_name_encrypted`)

---

## Section 1.2: Income Section - Employment Details

**File:** `frontend/src/components/staff/verify/sections/IncomeSection.vue`

### Missing Fields to Add:

| Field | DB Column (tenant_references) | Currently Displayed | Action |
|-------|-------------------------------|---------------------|--------|
| Employment Contract Type | `employment_contract_type` | ❌ | Add to Employment subsection |
| Salary Frequency | `employment_salary_frequency` | ❌ | Add to Employment subsection |
| Employment End Date | `employment_end_date` | ❌ | Add to Employment subsection |
| Benefits Monthly Amount | `benefits_monthly_amount_encrypted` | ❌ | Add to claimed income |
| Benefits Annual Amount | `benefits_annual_amount_encrypted` | ❌ | Show in breakdown |
| Additional Income Frequency | From form (not stored separately) | ❌ | N/A - not in DB |

### Implementation:

#### 1.2.1 Update Props Interface
```typescript
// Add to defineProps
employmentContractType?: string
salaryFrequency?: string
employmentEndDate?: string
benefitsMonthlyAmount?: number
benefitsAnnualAmount?: number
```

#### 1.2.2 Update Template - Employment Details Section
```vue
<!-- Add to details-grid inside Employment section (after Employment Start Date) -->
<div v-if="employmentEndDate" class="detail-item">
  <p class="detail-label">End Date</p>
  <p class="detail-value">{{ formatDate(employmentEndDate) }}</p>
</div>
<div v-if="employmentContractType" class="detail-item">
  <p class="detail-label">Contract Type</p>
  <p class="detail-value">{{ formatContractType(employmentContractType) }}</p>
</div>
<div v-if="salaryFrequency" class="detail-item">
  <p class="detail-label">Pay Frequency</p>
  <p class="detail-value">{{ formatFrequency(salaryFrequency) }}</p>
</div>
```

#### 1.2.3 Add Format Helper Functions
```typescript
const formatContractType = (type: string) => {
  const types: Record<string, string> = {
    'full_time': 'Full-time',
    'part_time': 'Part-time',
    'contract': 'Contract',
    'temporary': 'Temporary',
    'zero_hours': 'Zero Hours',
    'permanent': 'Permanent'
  }
  return types[type] || type.replace(/_/g, ' ')
}

const formatFrequency = (freq: string) => {
  const frequencies: Record<string, string> = {
    'weekly': 'Weekly',
    'bi_weekly': 'Bi-weekly',
    'monthly': 'Monthly',
    'annually': 'Annually'
  }
  return frequencies[freq] || freq.replace(/_/g, ' ')
}
```

#### 1.2.4 Update Claimed Income Display in Modal
```vue
<!-- Update claimed-income-list to show benefits breakdown -->
<div class="claimed-item">
  <span class="claimed-label">Benefits (Monthly)</span>
  <span class="claimed-value">{{ formatCurrency(benefitsMonthlyAmount || 0) }}/month</span>
</div>
<div class="claimed-item">
  <span class="claimed-label">Benefits (Annual)</span>
  <span class="claimed-value">{{ formatCurrency(claimedIncome?.benefits || 0) }}/year</span>
</div>
```

---

## Section 1.3: Income Section - Guarantor Financial Position (NEW SUBSECTION)

**File:** `frontend/src/components/staff/verify/sections/IncomeSection.vue`

### Missing Fields (Guarantor Only):

| Field | DB Column (guarantor_references) | Currently Displayed | Action |
|-------|----------------------------------|---------------------|--------|
| Home Ownership Status | `home_ownership_status` | ❌ | Add new subsection |
| Property Value | `property_value_encrypted` | ❌ | Add new subsection |
| Monthly Mortgage/Rent | `monthly_mortgage_rent_encrypted` | ❌ | Add new subsection |
| Pension Amount | `pension_amount_encrypted` | ❌ | Add new subsection |
| Pension Frequency | `pension_frequency` | ❌ | Add new subsection |
| Other Monthly Commitments | `other_monthly_commitments_encrypted` | ❌ | Add new subsection |
| Total Monthly Expenditure | `total_monthly_expenditure_encrypted` | ❌ | Add new subsection |
| Understands Obligations | `understands_obligations` | ❌ | Add new subsection |
| Willing to Pay Rent | `willing_to_pay_rent` | ❌ | Add new subsection |
| Willing to Pay Damages | `willing_to_pay_damages` | ❌ | Add new subsection |
| Previously Acted as Guarantor | `previously_acted_as_guarantor` | ❌ | Add new subsection |

### Implementation:

#### 1.3.1 Update Props Interface
```typescript
// Add guarantor-specific props
guarantorFinancialData?: {
  homeOwnershipStatus?: string
  propertyValue?: number
  monthlyMortgageRent?: number
  pensionAmount?: number
  pensionFrequency?: string
  otherMonthlyCommitments?: number
  totalMonthlyExpenditure?: number
  understandsObligations?: boolean
  willingToPayRent?: boolean
  willingToPayDamages?: boolean
  previouslyActedAsGuarantor?: boolean
}
```

#### 1.3.2 Add New Template Section (after Employment Details, only for guarantors)
```vue
<!-- Guarantor Financial Position (only shown for guarantors) -->
<div v-if="isGuarantor && guarantorFinancialData" class="detail-section">
  <h4 class="subsection-title">Guarantor Financial Position</h4>

  <div class="details-grid">
    <div v-if="guarantorFinancialData.homeOwnershipStatus" class="detail-item">
      <p class="detail-label">Home Ownership</p>
      <p class="detail-value">{{ formatHomeOwnership(guarantorFinancialData.homeOwnershipStatus) }}</p>
    </div>

    <div v-if="guarantorFinancialData.propertyValue" class="detail-item">
      <p class="detail-label">Property Value</p>
      <p class="detail-value">{{ formatCurrency(guarantorFinancialData.propertyValue) }}</p>
    </div>

    <div v-if="guarantorFinancialData.monthlyMortgageRent" class="detail-item">
      <p class="detail-label">Monthly Mortgage/Rent</p>
      <p class="detail-value">{{ formatCurrency(guarantorFinancialData.monthlyMortgageRent) }}/mo</p>
    </div>

    <div v-if="guarantorFinancialData.pensionAmount" class="detail-item">
      <p class="detail-label">Pension</p>
      <p class="detail-value">
        {{ formatCurrency(guarantorFinancialData.pensionAmount) }}
        <span v-if="guarantorFinancialData.pensionFrequency">/{{ guarantorFinancialData.pensionFrequency }}</span>
      </p>
    </div>

    <div v-if="guarantorFinancialData.otherMonthlyCommitments" class="detail-item">
      <p class="detail-label">Other Monthly Commitments</p>
      <p class="detail-value">{{ formatCurrency(guarantorFinancialData.otherMonthlyCommitments) }}/mo</p>
    </div>

    <div v-if="guarantorFinancialData.totalMonthlyExpenditure" class="detail-item">
      <p class="detail-label">Total Monthly Expenditure</p>
      <p class="detail-value">{{ formatCurrency(guarantorFinancialData.totalMonthlyExpenditure) }}/mo</p>
    </div>
  </div>

  <!-- Guarantor Obligations -->
  <div class="obligations-grid">
    <div class="obligation-item">
      <span :class="['obligation-badge', guarantorFinancialData.understandsObligations ? 'confirmed' : 'pending']">
        {{ guarantorFinancialData.understandsObligations ? '✓' : '?' }}
      </span>
      <span>Understands Legal Obligations</span>
    </div>
    <div class="obligation-item">
      <span :class="['obligation-badge', guarantorFinancialData.willingToPayRent ? 'confirmed' : 'pending']">
        {{ guarantorFinancialData.willingToPayRent ? '✓' : '?' }}
      </span>
      <span>Willing to Pay Rent if Tenant Defaults</span>
    </div>
    <div class="obligation-item">
      <span :class="['obligation-badge', guarantorFinancialData.willingToPayDamages ? 'confirmed' : 'pending']">
        {{ guarantorFinancialData.willingToPayDamages ? '✓' : '?' }}
      </span>
      <span>Willing to Pay Damages if Tenant Defaults</span>
    </div>
    <div v-if="guarantorFinancialData.previouslyActedAsGuarantor" class="obligation-item">
      <span class="obligation-badge info">ℹ</span>
      <span>Has Previously Acted as Guarantor</span>
    </div>
  </div>
</div>
```

#### 1.3.3 Add Format Helper
```typescript
const formatHomeOwnership = (status: string) => {
  const statuses: Record<string, string> = {
    'owner': 'Owner (Outright)',
    'owner_mortgage': 'Owner with Mortgage',
    'renting': 'Renting',
    'living_with_family': 'Living with Family',
    'other': 'Other'
  }
  return statuses[status] || status.replace(/_/g, ' ')
}
```

#### 1.3.4 Add CSS for Obligations Grid
```css
.obligations-grid {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 1rem;
  background: #f0fdf4;
  border-radius: 0.5rem;
  border: 1px solid #bbf7d0;
}

.obligation-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: #374151;
}

.obligation-badge {
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
}

.obligation-badge.confirmed {
  background: #d1fae5;
  color: #059669;
}

.obligation-badge.pending {
  background: #fef3c7;
  color: #d97706;
}

.obligation-badge.info {
  background: #dbeafe;
  color: #2563eb;
}
```

---

## Section 1.4: Credit Section - Adverse Credit (NEW SUBSECTION)

**File:** `frontend/src/components/staff/verify/sections/CreditSection.vue`

### Missing Fields:

| Field | DB Column (tenant_references) | DB Column (guarantor_references) | Currently Displayed |
|-------|-------------------------------|----------------------------------|---------------------|
| Has Adverse Credit | N/A (inferred from details) | `adverse_credit` (boolean) | ❌ |
| Adverse Credit Details | `adverse_credit_details_encrypted` | `adverse_credit_details_encrypted` | ❌ |

### Implementation:

#### 1.4.1 Update Props Interface
```typescript
// Add to defineProps
hasAdverseCredit?: boolean
adverseCreditDetails?: string
```

#### 1.4.2 Add New Template Section (at top of section-content, before TAS Score)
```vue
<!-- Self-Disclosed Credit Issues -->
<div v-if="hasAdverseCredit || adverseCreditDetails" class="adverse-credit-section">
  <h4 class="subsection-title">
    <svg class="warning-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    Self-Disclosed Credit Issues
  </h4>

  <div class="adverse-credit-card">
    <div class="adverse-header">
      <span class="adverse-badge warning">Applicant Disclosed Credit Issues</span>
    </div>
    <div v-if="adverseCreditDetails" class="adverse-details">
      <p class="adverse-label">Details provided by applicant:</p>
      <p class="adverse-text">{{ adverseCreditDetails }}</p>
    </div>
    <p class="adverse-note">
      Compare this disclosure against the credit report above to verify accuracy.
    </p>
  </div>
</div>

<!-- No Adverse Credit Disclosed -->
<div v-else class="no-adverse-credit">
  <span class="no-adverse-badge">✓ No adverse credit history disclosed by applicant</span>
</div>
```

#### 1.4.3 Add CSS
```css
.adverse-credit-section {
  padding: 1rem;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.adverse-credit-section .subsection-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #92400e;
  margin-bottom: 0.75rem;
}

.adverse-credit-section .warning-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.adverse-credit-card {
  background: white;
  border-radius: 0.375rem;
  padding: 1rem;
}

.adverse-header {
  margin-bottom: 0.75rem;
}

.adverse-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.adverse-badge.warning {
  background: #fef3c7;
  color: #92400e;
}

.adverse-details {
  margin-bottom: 0.75rem;
}

.adverse-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  margin: 0 0 0.25rem;
}

.adverse-text {
  font-size: 0.875rem;
  color: #1f2937;
  margin: 0;
  white-space: pre-line;
  background: #f9fafb;
  padding: 0.75rem;
  border-radius: 0.25rem;
}

.adverse-note {
  font-size: 0.75rem;
  color: #6b7280;
  font-style: italic;
  margin: 0;
}

.no-adverse-credit {
  margin-bottom: 1rem;
}

.no-adverse-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  background: #d1fae5;
  color: #065f46;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
}
```

---

## Section 1.5: Residential Section - Address History (NEW SUBSECTION)

**File:** `frontend/src/components/staff/verify/sections/ResidentialSection.vue`

### Missing Fields:

| Field | DB Column | Currently Displayed |
|-------|-----------|---------------------|
| Current Address | `current_address_line1_encrypted`, etc. | ❌ |
| Time at Current Address | `time_at_address_years`, `time_at_address_months` | ❌ |
| Previous Addresses (full 3-year history) | `tenant_reference_previous_addresses` table | ❌ (only 1 shown) |

### Implementation:

#### 1.5.1 Update Props Interface
```typescript
// Add to defineProps
currentAddress?: {
  line1: string
  line2?: string
  city: string
  postcode: string
  country?: string
  timeYears?: number
  timeMonths?: number
}
previousAddresses?: Array<{
  line1: string
  line2?: string
  city: string
  postcode: string
  country?: string
  movedIn?: string
  addressOrder: number
}>
```

#### 1.5.2 Add New Template Section (before Previous Address section)
```vue
<!-- Current Address -->
<div v-if="currentAddress" class="address-section">
  <h4 class="subsection-title">Current Address</h4>
  <div class="address-card current">
    <div class="address-content">
      <p class="address-text">
        {{ currentAddress.line1 }}
        <span v-if="currentAddress.line2">, {{ currentAddress.line2 }}</span>
      </p>
      <p class="address-text">{{ currentAddress.city }}, {{ currentAddress.postcode }}</p>
      <p v-if="currentAddress.country" class="address-country">{{ currentAddress.country }}</p>
    </div>
    <div v-if="currentAddress.timeYears !== undefined || currentAddress.timeMonths !== undefined" class="time-at-address">
      <span class="time-badge">
        {{ formatTimeAtAddress(currentAddress.timeYears, currentAddress.timeMonths) }}
      </span>
    </div>
  </div>
</div>

<!-- Full Address History -->
<div v-if="previousAddresses && previousAddresses.length > 0" class="address-section">
  <h4 class="subsection-title">Address History (3 Years)</h4>
  <div class="address-history-list">
    <div v-for="(addr, index) in previousAddresses" :key="index" class="address-card history">
      <div class="address-order">{{ index + 1 }}</div>
      <div class="address-content">
        <p class="address-text">
          {{ addr.line1 }}
          <span v-if="addr.line2">, {{ addr.line2 }}</span>
        </p>
        <p class="address-text">{{ addr.city }}, {{ addr.postcode }}</p>
        <p v-if="addr.country" class="address-country">{{ addr.country }}</p>
        <p v-if="addr.movedIn" class="address-date">Moved in: {{ formatDate(addr.movedIn) }}</p>
      </div>
    </div>
  </div>
</div>
```

#### 1.5.3 Add Helper Function
```typescript
const formatTimeAtAddress = (years?: number, months?: number) => {
  const parts = []
  if (years) parts.push(`${years} year${years !== 1 ? 's' : ''}`)
  if (months) parts.push(`${months} month${months !== 1 ? 's' : ''}`)
  return parts.length > 0 ? parts.join(', ') : 'Time not specified'
}
```

#### 1.5.4 Add CSS
```css
.address-card.current {
  border-left: 3px solid #10b981;
}

.address-card.history {
  display: flex;
  gap: 1rem;
  border-left: 3px solid #9ca3af;
}

.address-order {
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  flex-shrink: 0;
}

.time-at-address {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
}

.time-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.address-history-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.address-country {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
}

.address-date {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}
```

---

## Section 1.6: Backend API Changes for Verify Flow

**File:** `backend/src/routes/verify.ts`

### 1.6.1 Update `/api/verify/person/:referenceId` Response

Add these fields to the reference object returned:

```typescript
// For tenant_references
{
  // ... existing fields ...

  // NEW: Identity fields
  contact_number: decrypt(row.contact_number_encrypted),
  middle_name: decrypt(row.middle_name_encrypted),

  // NEW: Employment fields
  employment_contract_type: row.employment_contract_type,
  employment_salary_frequency: row.employment_salary_frequency,
  employment_end_date: row.employment_end_date,

  // NEW: Benefits fields
  benefits_monthly_amount: decrypt(row.benefits_monthly_amount_encrypted),
  benefits_annual_amount: decrypt(row.benefits_annual_amount_encrypted),

  // NEW: Adverse credit
  adverse_credit_details: decrypt(row.adverse_credit_details_encrypted),

  // NEW: Address fields
  current_address_line1: decrypt(row.current_address_line1_encrypted),
  current_address_line2: decrypt(row.current_address_line2_encrypted),
  current_city: decrypt(row.current_city_encrypted),
  current_postcode: decrypt(row.current_postcode_encrypted),
  current_country: decrypt(row.current_country_encrypted),
  time_at_address_years: row.time_at_address_years,
  time_at_address_months: row.time_at_address_months,
}
```

### 1.6.2 Update `/api/verify/evidence/:referenceId` Response

Add guarantor financial data when `isGuarantor` is true:

```typescript
// Query guarantor_references table
const guarantorData = await supabaseAdmin
  .from('guarantor_references')
  .select('*')
  .eq('reference_id', referenceId)
  .single()

// Add to response
{
  // ... existing fields ...

  guarantorFinancialData: guarantorData ? {
    homeOwnershipStatus: guarantorData.home_ownership_status,
    propertyValue: decrypt(guarantorData.property_value_encrypted),
    monthlyMortgageRent: decrypt(guarantorData.monthly_mortgage_rent_encrypted),
    pensionAmount: decrypt(guarantorData.pension_amount_encrypted),
    pensionFrequency: guarantorData.pension_frequency,
    otherMonthlyCommitments: decrypt(guarantorData.other_monthly_commitments_encrypted),
    totalMonthlyExpenditure: decrypt(guarantorData.total_monthly_expenditure_encrypted),
    understandsObligations: guarantorData.understands_obligations,
    willingToPayRent: guarantorData.willing_to_pay_rent,
    willingToPayDamages: guarantorData.willing_to_pay_damages,
    previouslyActedAsGuarantor: guarantorData.previously_acted_as_guarantor,
    adverseCredit: guarantorData.adverse_credit,
    adverseCreditDetails: decrypt(guarantorData.adverse_credit_details_encrypted),
  } : null
}
```

### 1.6.3 Fetch Previous Addresses

```typescript
// Query tenant_reference_previous_addresses table
const { data: previousAddresses } = await supabaseAdmin
  .from('tenant_reference_previous_addresses')
  .select('*')
  .eq('tenant_reference_id', referenceId)
  .order('address_order', { ascending: true })

// Add to response
{
  previousAddresses: previousAddresses?.map(addr => ({
    line1: decrypt(addr.address_line1_encrypted),
    line2: decrypt(addr.address_line2_encrypted),
    city: decrypt(addr.city_encrypted),
    postcode: decrypt(addr.postcode_encrypted),
    country: decrypt(addr.country_encrypted),
    movedIn: addr.moved_in,
    addressOrder: addr.address_order
  })) || []
}
```

---

# PART 2: REFERENCES SIDE PANEL CHANGES

## Section 2.1: Current Address Section - Add Time at Address

**File:** `frontend/src/components/references/PersonDrawer.vue`

### Missing Fields:

| Field | DB Column | Currently Displayed |
|-------|-----------|---------------------|
| Time at Address (Years) | `time_at_address_years` | ❌ |
| Time at Address (Months) | `time_at_address_months` | ❌ |

### Implementation:

#### 2.1.1 Update Template (Current Address CollapsibleSection)

Find the Current Address section (around line 395) and add:

```vue
<!-- Current Address -->
<CollapsibleSection title="Current Address" v-if="fullDetails?.current_address_line1">
  <div class="space-y-1">
    <p class="text-sm text-gray-900">{{ fullDetails.current_address_line1 }}</p>
    <p v-if="fullDetails.current_address_line2" class="text-sm text-gray-900">{{ fullDetails.current_address_line2 }}</p>
    <p class="text-sm text-gray-900">{{ fullDetails.current_city }}, {{ fullDetails.current_postcode }}</p>
    <p v-if="fullDetails.current_country" class="text-sm text-gray-500">{{ fullDetails.current_country }}</p>
  </div>

  <!-- ADD THIS: Time at Address -->
  <div v-if="fullDetails.time_at_address_years !== null || fullDetails.time_at_address_months !== null" class="mt-3 pt-3 border-t border-gray-200">
    <label class="block text-xs font-medium text-gray-500 uppercase">Time at Address</label>
    <p class="mt-1 text-sm text-gray-900">
      <span v-if="fullDetails.time_at_address_years">{{ fullDetails.time_at_address_years }} year<span v-if="fullDetails.time_at_address_years !== 1">s</span></span>
      <span v-if="fullDetails.time_at_address_years && fullDetails.time_at_address_months">, </span>
      <span v-if="fullDetails.time_at_address_months">{{ fullDetails.time_at_address_months }} month<span v-if="fullDetails.time_at_address_months !== 1">s</span></span>
    </p>
  </div>

  <div v-if="fullDetails.current_address_moved_in" class="mt-3">
    <label class="block text-xs font-medium text-gray-500 uppercase">Moved In</label>
    <p class="mt-1 text-sm text-gray-900">{{ formatDate(fullDetails.current_address_moved_in) }}</p>
  </div>
</CollapsibleSection>
```

---

## Section 2.2: NEW Address History Section

**File:** `frontend/src/components/references/PersonDrawer.vue`

### Implementation:

#### 2.2.1 Add New CollapsibleSection (after Current Address section)

```vue
<!-- Address History -->
<CollapsibleSection
  v-if="previousAddresses && previousAddresses.length > 0"
  title="Address History"
  :badge="previousAddresses.length.toString()"
>
  <div class="space-y-3">
    <div
      v-for="(addr, index) in previousAddresses"
      :key="index"
      class="p-3 bg-gray-50 rounded-lg border-l-2 border-gray-300"
    >
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <p class="text-sm text-gray-900">{{ addr.address_line1 }}</p>
          <p v-if="addr.address_line2" class="text-sm text-gray-900">{{ addr.address_line2 }}</p>
          <p class="text-sm text-gray-900">{{ addr.city }}, {{ addr.postcode }}</p>
          <p v-if="addr.country" class="text-xs text-gray-500">{{ addr.country }}</p>
        </div>
        <span class="text-xs text-gray-400">#{{ index + 1 }}</span>
      </div>
      <p v-if="addr.moved_in" class="text-xs text-gray-500 mt-2">
        Moved in: {{ formatDate(addr.moved_in) }}
      </p>
    </div>
  </div>
</CollapsibleSection>
```

#### 2.2.2 Add Computed Property

```typescript
// Add to script setup
const previousAddresses = computed(() => {
  return fullDetails.value?.previousAddresses || []
})
```

---

## Section 2.3: NEW Adverse Credit Section

**File:** `frontend/src/components/references/PersonDrawer.vue`

### Implementation:

#### 2.3.1 Add New CollapsibleSection (after Employment & Income section)

```vue
<!-- Adverse Credit (Self-Disclosed) -->
<CollapsibleSection
  v-if="hasAdverseCreditData"
  title="Adverse Credit"
  :status="fullDetails?.adverse_credit_details ? 'warning' : 'pass'"
>
  <div v-if="fullDetails?.adverse_credit_details" class="p-3 bg-amber-50 rounded-lg border border-amber-200">
    <div class="flex items-start gap-2">
      <svg class="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div>
        <p class="text-sm font-medium text-amber-800">Applicant Disclosed Credit Issues</p>
        <p class="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{{ fullDetails.adverse_credit_details }}</p>
      </div>
    </div>
  </div>
  <div v-else class="p-3 bg-green-50 rounded-lg">
    <div class="flex items-center gap-2">
      <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-sm text-green-800">No adverse credit history disclosed</p>
    </div>
  </div>
</CollapsibleSection>
```

#### 2.3.2 Add Computed Property

```typescript
const hasAdverseCreditData = computed(() => {
  // Always show this section - either to show disclosed issues or confirm none disclosed
  return fullDetails.value?.submitted_at !== null // Only show after form submitted
})
```

---

## Section 2.4: Employment & Income Section - Add Missing Fields

**File:** `frontend/src/components/references/PersonDrawer.vue`

### Missing Fields:

| Field | DB Column | Currently Displayed |
|-------|-----------|---------------------|
| Employment Contract Type | `employment_contract_type` | ❌ |
| Salary Frequency | `employment_salary_frequency` | ❌ |
| Employment End Date | `employment_end_date` | ❌ |
| Benefits Amount | `benefits_monthly_amount_encrypted` / `benefits_annual_amount_encrypted` | ❌ (only badge) |

### Implementation:

#### 2.4.1 Update Employment Grid (around line 497-534)

Add these fields to the existing grid:

```vue
<!-- Add after Employment Type -->
<div v-if="fullDetails?.employment_contract_type">
  <label class="block text-xs font-medium text-gray-500 uppercase">Contract Type</label>
  <p class="mt-1 text-sm text-gray-900 capitalize">{{ fullDetails.employment_contract_type.replace(/_/g, ' ') }}</p>
</div>

<div v-if="fullDetails?.employment_salary_frequency">
  <label class="block text-xs font-medium text-gray-500 uppercase">Pay Frequency</label>
  <p class="mt-1 text-sm text-gray-900 capitalize">{{ fullDetails.employment_salary_frequency.replace(/_/g, ' ') }}</p>
</div>

<div v-if="fullDetails?.employment_end_date">
  <label class="block text-xs font-medium text-gray-500 uppercase">Employment End Date</label>
  <p class="mt-1 text-sm text-gray-900">{{ formatDate(fullDetails.employment_end_date) }}</p>
</div>

<!-- Benefits Amount (after Savings section, around line 566) -->
<div v-if="fullDetails?.benefits_monthly_amount || fullDetails?.benefits_annual_amount" class="pt-3 border-t border-gray-200 grid grid-cols-2 gap-4">
  <div v-if="fullDetails?.benefits_monthly_amount">
    <label class="block text-xs font-medium text-gray-500 uppercase">Benefits (Monthly)</label>
    <p class="mt-1 text-sm text-gray-900">{{ formatCurrency(Number(fullDetails.benefits_monthly_amount)) }}</p>
  </div>
  <div v-if="fullDetails?.benefits_annual_amount">
    <label class="block text-xs font-medium text-gray-500 uppercase">Benefits (Annual)</label>
    <p class="mt-1 text-sm text-gray-900">{{ formatCurrency(Number(fullDetails.benefits_annual_amount)) }}</p>
  </div>
</div>
```

---

## Section 2.5: NEW Guarantor Financial Position Section (Guarantors Only)

**File:** `frontend/src/components/references/PersonDrawer.vue`

### Implementation:

#### 2.5.1 Add New CollapsibleSection (after Employment & Income, only for guarantors)

```vue
<!-- Guarantor Financial Position (Guarantors only) -->
<CollapsibleSection
  v-if="person.role === 'GUARANTOR' && guarantorDetails"
  title="Guarantor Financial Position"
>
  <div class="space-y-4">
    <!-- Home Ownership -->
    <div class="grid grid-cols-2 gap-4">
      <div v-if="guarantorDetails.home_ownership_status">
        <label class="block text-xs font-medium text-gray-500 uppercase">Home Ownership</label>
        <p class="mt-1 text-sm text-gray-900">{{ formatHomeOwnership(guarantorDetails.home_ownership_status) }}</p>
      </div>
      <div v-if="guarantorDetails.property_value">
        <label class="block text-xs font-medium text-gray-500 uppercase">Property Value</label>
        <p class="mt-1 text-sm text-gray-900">{{ formatCurrency(Number(guarantorDetails.property_value)) }}</p>
      </div>
      <div v-if="guarantorDetails.monthly_mortgage_rent">
        <label class="block text-xs font-medium text-gray-500 uppercase">Monthly Mortgage/Rent</label>
        <p class="mt-1 text-sm text-gray-900">{{ formatCurrency(Number(guarantorDetails.monthly_mortgage_rent)) }}</p>
      </div>
    </div>

    <!-- Pension (if applicable) -->
    <div v-if="guarantorDetails.pension_amount" class="pt-3 border-t border-gray-200 grid grid-cols-2 gap-4">
      <div>
        <label class="block text-xs font-medium text-gray-500 uppercase">Pension Amount</label>
        <p class="mt-1 text-sm text-gray-900">
          {{ formatCurrency(Number(guarantorDetails.pension_amount)) }}
          <span v-if="guarantorDetails.pension_frequency" class="text-gray-500">/{{ guarantorDetails.pension_frequency }}</span>
        </p>
      </div>
    </div>

    <!-- Monthly Commitments -->
    <div v-if="guarantorDetails.other_monthly_commitments || guarantorDetails.total_monthly_expenditure" class="pt-3 border-t border-gray-200 grid grid-cols-2 gap-4">
      <div v-if="guarantorDetails.other_monthly_commitments">
        <label class="block text-xs font-medium text-gray-500 uppercase">Other Commitments</label>
        <p class="mt-1 text-sm text-gray-900">{{ formatCurrency(Number(guarantorDetails.other_monthly_commitments)) }}/mo</p>
      </div>
      <div v-if="guarantorDetails.total_monthly_expenditure">
        <label class="block text-xs font-medium text-gray-500 uppercase">Total Expenditure</label>
        <p class="mt-1 text-sm text-gray-900">{{ formatCurrency(Number(guarantorDetails.total_monthly_expenditure)) }}/mo</p>
      </div>
    </div>

    <!-- Guarantor Obligations -->
    <div class="pt-3 border-t border-gray-200">
      <label class="block text-xs font-medium text-gray-500 uppercase mb-2">Guarantor Confirmations</label>
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <span :class="guarantorDetails.understands_obligations ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'"
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">
            {{ guarantorDetails.understands_obligations ? '✓ Confirmed' : 'Not confirmed' }}
          </span>
          <span class="text-sm text-gray-700">Understands legal obligations</span>
        </div>
        <div class="flex items-center gap-2">
          <span :class="guarantorDetails.willing_to_pay_rent ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'"
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">
            {{ guarantorDetails.willing_to_pay_rent ? '✓ Confirmed' : 'Not confirmed' }}
          </span>
          <span class="text-sm text-gray-700">Willing to pay rent if tenant defaults</span>
        </div>
        <div class="flex items-center gap-2">
          <span :class="guarantorDetails.willing_to_pay_damages ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'"
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">
            {{ guarantorDetails.willing_to_pay_damages ? '✓ Confirmed' : 'Not confirmed' }}
          </span>
          <span class="text-sm text-gray-700">Willing to pay for damages</span>
        </div>
      </div>
    </div>

    <!-- Previous Guarantor Experience -->
    <div v-if="guarantorDetails.previously_acted_as_guarantor" class="pt-3 border-t border-gray-200">
      <div class="p-3 bg-blue-50 rounded-lg">
        <p class="text-sm text-blue-800">
          <strong>Note:</strong> This guarantor has previously acted as a guarantor for another tenant.
        </p>
      </div>
    </div>
  </div>
</CollapsibleSection>
```

#### 2.5.2 Add Helper Function

```typescript
const formatHomeOwnership = (status: string) => {
  const statuses: Record<string, string> = {
    'owner': 'Owner (Outright)',
    'owner_mortgage': 'Owner with Mortgage',
    'renting': 'Renting',
    'living_with_family': 'Living with Family',
    'other': 'Other'
  }
  return statuses[status] || status.replace(/_/g, ' ')
}
```

---

## Section 2.6: Documents Section - Add Proof of Funds

**File:** `frontend/src/components/references/PersonDrawer.vue`

### Implementation:

#### 2.6.1 Update referenceDocuments Computed Property

Find the `referenceDocuments` computed property and ensure it includes:

```typescript
const referenceDocuments = computed(() => {
  if (!fullDetails.value) return []

  return [
    { type: 'id_document', label: 'ID Document', path: fullDetails.value.id_document_path },
    { type: 'selfie', label: 'Selfie', path: fullDetails.value.selfie_path },
    { type: 'payslips', label: 'Payslips', path: fullDetails.value.payslip_paths },
    { type: 'bank_statement', label: 'Bank Statement', path: fullDetails.value.bank_statement_path },
    { type: 'proof_of_address', label: 'Proof of Address', path: fullDetails.value.proof_of_address_path },
    { type: 'tax_return', label: 'Tax Return / Accounts', path: fullDetails.value.tax_return_path },
    // ADD THIS:
    { type: 'proof_of_funds', label: 'Proof of Funds', path: fullDetails.value.proof_of_funds_path },
    { type: 'proof_of_additional_income', label: 'Proof of Additional Income', path: fullDetails.value.proof_of_additional_income_path },
  ].filter(doc => doc.path)
})
```

---

## Section 2.7: Backend API Changes for References

**File:** `backend/src/routes/references.ts`

### 2.7.1 Update `/api/references/:id` Response

Ensure these fields are returned in the reference object:

```typescript
// Add to the decrypted reference response
{
  // ... existing fields ...

  // NEW: Time at address
  time_at_address_years: row.time_at_address_years,
  time_at_address_months: row.time_at_address_months,

  // NEW: Employment details
  employment_contract_type: row.employment_contract_type,
  employment_salary_frequency: row.employment_salary_frequency,
  employment_end_date: row.employment_end_date,

  // NEW: Benefits amounts
  benefits_monthly_amount: decrypt(row.benefits_monthly_amount_encrypted),
  benefits_annual_amount: decrypt(row.benefits_annual_amount_encrypted),

  // NEW: Adverse credit
  adverse_credit_details: decrypt(row.adverse_credit_details_encrypted),

  // NEW: Proof of funds path
  proof_of_funds_path: row.proof_of_funds_path,
}
```

### 2.7.2 Add Guarantor Details Query

For guarantor references, fetch additional data from `guarantor_references` table:

```typescript
// When person.role === 'GUARANTOR', fetch guarantor-specific data
if (reference.is_guarantor) {
  const { data: guarantorData } = await supabaseAdmin
    .from('guarantor_references')
    .select('*')
    .eq('reference_id', referenceId)
    .single()

  if (guarantorData) {
    response.guarantorDetails = {
      home_ownership_status: guarantorData.home_ownership_status,
      property_value: decrypt(guarantorData.property_value_encrypted),
      monthly_mortgage_rent: decrypt(guarantorData.monthly_mortgage_rent_encrypted),
      pension_amount: decrypt(guarantorData.pension_amount_encrypted),
      pension_frequency: guarantorData.pension_frequency,
      other_monthly_commitments: decrypt(guarantorData.other_monthly_commitments_encrypted),
      total_monthly_expenditure: decrypt(guarantorData.total_monthly_expenditure_encrypted),
      understands_obligations: guarantorData.understands_obligations,
      willing_to_pay_rent: guarantorData.willing_to_pay_rent,
      willing_to_pay_damages: guarantorData.willing_to_pay_damages,
      previously_acted_as_guarantor: guarantorData.previously_acted_as_guarantor,
      adverse_credit: guarantorData.adverse_credit,
      adverse_credit_details: decrypt(guarantorData.adverse_credit_details_encrypted),
    }
  }
}
```

### 2.7.3 Previous Addresses Already Fetched

The existing API already fetches previous addresses from `tenant_reference_previous_addresses` table. Ensure it's included in the response as `previousAddresses` array.

---

# PART 3: SUMMARY OF ALL CHANGES

## Files to Modify:

### Frontend (6 files):
1. `frontend/src/components/staff/verify/sections/IdentitySelfieSection.vue`
2. `frontend/src/components/staff/verify/sections/IncomeSection.vue`
3. `frontend/src/components/staff/verify/sections/CreditSection.vue`
4. `frontend/src/components/staff/verify/sections/ResidentialSection.vue`
5. `frontend/src/components/staff/verify/VerifySectionStack.vue` (parent component)
6. `frontend/src/components/references/PersonDrawer.vue`

### Backend (2 files):
1. `backend/src/routes/verify.ts`
2. `backend/src/routes/references.ts`

## Database Tables Referenced:

| Table | Fields Used |
|-------|-------------|
| `tenant_references` | All tenant PII and form data |
| `guarantor_references` | Home ownership, pension, obligations, adverse credit |
| `tenant_reference_previous_addresses` | Full 3-year address history |
| `verification_sections` | Section decisions and evidence |

## Priority Order:

1. **Phase 1 (Critical):** Adverse Credit display (both sides)
2. **Phase 2 (High):** Guarantor Financial Position (both sides)
3. **Phase 3 (Medium):** Address History with time at address (both sides)
4. **Phase 4 (Medium):** Employment details (contract type, frequency, benefits)
5. **Phase 5 (Low):** Phone/contact number, documents list updates

---

# APPENDIX: Database Column Reference

## tenant_references - Key Columns for This Work

```sql
-- Identity
contact_number_encrypted TEXT
middle_name_encrypted TEXT

-- Address & Time
current_address_line1_encrypted TEXT
current_address_line2_encrypted TEXT
current_city_encrypted TEXT
current_postcode_encrypted TEXT
current_country_encrypted TEXT
time_at_address_years INTEGER
time_at_address_months INTEGER

-- Employment
employment_contract_type TEXT  -- 'full_time', 'part_time', 'contract', 'temporary', 'zero_hours'
employment_salary_frequency TEXT  -- 'weekly', 'bi_weekly', 'monthly', 'annually'
employment_end_date DATE

-- Benefits
benefits_monthly_amount_encrypted TEXT
benefits_annual_amount_encrypted TEXT

-- Adverse Credit
adverse_credit_details_encrypted TEXT

-- Documents
proof_of_funds_path TEXT
```

## guarantor_references - Key Columns for This Work

```sql
-- Home Ownership
home_ownership_status TEXT  -- 'owner', 'owner_mortgage', 'renting', 'living_with_family', 'other'
property_value_encrypted TEXT
monthly_mortgage_rent_encrypted TEXT

-- Pension
pension_amount_encrypted TEXT
pension_frequency TEXT  -- 'monthly', 'annually'

-- Monthly Commitments
other_monthly_commitments_encrypted TEXT
total_monthly_expenditure_encrypted TEXT

-- Adverse Credit
adverse_credit BOOLEAN
adverse_credit_details_encrypted TEXT

-- Obligations
understands_obligations BOOLEAN
willing_to_pay_rent BOOLEAN
willing_to_pay_damages BOOLEAN
previously_acted_as_guarantor BOOLEAN
```

## tenant_reference_previous_addresses - Structure

```sql
id UUID PRIMARY KEY
tenant_reference_id UUID REFERENCES tenant_references(id)
address_line1_encrypted TEXT
address_line2_encrypted TEXT
city_encrypted TEXT
postcode_encrypted TEXT
country_encrypted TEXT
moved_in DATE
address_order INTEGER  -- 1, 2, 3 for ordering
created_at TIMESTAMP
```
