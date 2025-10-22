# Staff Reference Detail Page Enhancements

## Changes Needed

### 1. Add Missing Imports (at top of script section, line ~1329)

```typescript
import ComparisonTable from '../components/ComparisonTable.vue'
import { computed } from 'vue' // Add to existing import from vue
```

### 2. Add Missing Refs (after existing refs, line ~1346)

```typescript
const previousAddresses = ref<any[]>([])
const documents = ref<any[]>([])
const childReferences = ref<any[]>([])
const parentReference = ref<any>(null)
const siblingReferences = ref<any[]>([])
```

### 3. Update fetchReference function (line ~1388-1393)

Add these lines after existing assignments:

```typescript
previousAddresses.value = data.previousAddresses || []
documents.value = data.documents || []
childReferences.value = data.childReferences || []
parentReference.value = data.parentReference
siblingReferences.value = data.siblingReferences || []
```

### 4. Add Computed Properties for Comparison Rows (before closing script tag)

```typescript
// Employment Comparison Rows
const employmentComparisonRows = computed(() => {
  if (!reference.value || !employerReference.value) return []

  return [
    {
      field: 'company_name',
      label: 'Company Name',
      tenantValue: reference.value.employment_company_name,
      referenceValue: employerReference.value.company_name
    },
    {
      field: 'position',
      label: 'Employee Position',
      tenantValue: reference.value.employment_job_title,
      referenceValue: employerReference.value.employee_position
    },
    {
      field: 'employment_start_date',
      label: 'Employment Start Date',
      tenantValue: reference.value.employment_start_date,
      referenceValue: employerReference.value.employment_start_date
    },
    {
      field: 'employment_type',
      label: 'Employment Type',
      tenantValue: reference.value.employment_contract_type,
      referenceValue: employerReference.value.employment_type
    },
    {
      field: 'annual_salary',
      label: 'Annual Salary',
      tenantValue: reference.value.employment_salary_amount ? parseFloat(reference.value.employment_salary_amount) : null,
      referenceValue: employerReference.value.annual_salary ? parseFloat(employerReference.value.annual_salary) : null
    },
    {
      field: 'employer_contact_name',
      label: 'Reference Contact Name',
      tenantValue: reference.value.employer_ref_name,
      referenceValue: employerReference.value.employer_name
    },
    {
      field: 'employer_contact_email',
      label: 'Reference Contact Email',
      tenantValue: reference.value.employer_ref_email,
      referenceValue: employerReference.value.employer_email
    },
    {
      field: 'employer_contact_phone',
      label: 'Reference Contact Phone',
      tenantValue: reference.value.employer_ref_phone,
      referenceValue: employerReference.value.employer_phone
    }
  ]
})

// Landlord Comparison Rows
const landlordComparisonRows = computed(() => {
  if (!reference.value || !landlordReference.value) return []

  return [
    {
      field: 'property_address',
      label: 'Property Address',
      tenantValue: reference.value.previous_rental_address_line1,
      referenceValue: landlordReference.value.property_address
    },
    {
      field: 'property_city',
      label: 'Property City',
      tenantValue: reference.value.previous_rental_city,
      referenceValue: landlordReference.value.property_city
    },
    {
      field: 'property_postcode',
      label: 'Property Postcode',
      tenantValue: reference.value.previous_rental_postcode,
      referenceValue: landlordReference.value.property_postcode
    },
    {
      field: 'landlord_name',
      label: 'Landlord Name',
      tenantValue: reference.value.previous_landlord_name,
      referenceValue: landlordReference.value.landlord_name
    },
    {
      field: 'landlord_email',
      label: 'Landlord Email',
      tenantValue: reference.value.previous_landlord_email,
      referenceValue: landlordReference.value.landlord_email
    },
    {
      field: 'landlord_phone',
      label: 'Landlord Phone',
      tenantValue: reference.value.previous_landlord_phone,
      referenceValue: landlordReference.value.landlord_phone
    },
    {
      field: 'tenancy_start',
      label: 'Tenancy Start Date',
      tenantValue: null, // Tenant doesn't provide exact dates
      referenceValue: landlordReference.value.tenancy_start_date,
      isNotApplicable: !reference.value.previous_landlord_name
    },
    {
      field: 'tenancy_end',
      label: 'Tenancy End Date',
      tenantValue: null,
      referenceValue: landlordReference.value.tenancy_end_date,
      isNotApplicable: !reference.value.previous_landlord_name
    },
    {
      field: 'monthly_rent',
      label: 'Monthly Rent',
      tenantValue: null,
      referenceValue: landlordReference.value.monthly_rent ? `£${landlordReference.value.monthly_rent}` : null,
      isNotApplicable: !reference.value.previous_landlord_name
    }
  ]
})

// Agent Comparison Rows
const agentComparisonRows = computed(() => {
  if (!reference.value || !agentReference.value) return []

  return [
    {
      field: 'property_address',
      label: 'Property Address',
      tenantValue: reference.value.previous_rental_address_line1,
      referenceValue: agentReference.value.property_address
    },
    {
      field: 'property_city',
      label: 'Property City',
      tenantValue: reference.value.previous_rental_city,
      referenceValue: agentReference.value.property_city
    },
    {
      field: 'property_postcode',
      label: 'Property Postcode',
      tenantValue: reference.value.previous_rental_postcode,
      referenceValue: agentReference.value.property_postcode
    },
    {
      field: 'agent_name',
      label: 'Agent Name',
      tenantValue: reference.value.previous_landlord_name, // Reused field
      referenceValue: agentReference.value.agent_name
    },
    {
      field: 'agency_name',
      label: 'Agency Name',
      tenantValue: null,
      referenceValue: agentReference.value.agency_name,
      isNotApplicable: true
    },
    {
      field: 'agent_email',
      label: 'Agent Email',
      tenantValue: reference.value.previous_landlord_email,
      referenceValue: agentReference.value.agent_email
    },
    {
      field: 'agent_phone',
      label: 'Agent Phone',
      tenantValue: reference.value.previous_landlord_phone,
      referenceValue: agentReference.value.agent_phone
    }
  ]
})

// Accountant Comparison Rows
const accountantComparisonRows = computed(() => {
  if (!reference.value || !accountantReference.value) return []

  return [
    {
      field: 'business_name',
      label: 'Business Name',
      tenantValue: reference.value.self_employed_business_name,
      referenceValue: accountantReference.value.business_name
    },
    {
      field: 'nature_of_business',
      label: 'Nature of Business',
      tenantValue: reference.value.self_employed_nature_of_business,
      referenceValue: accountantReference.value.nature_of_business
    },
    {
      field: 'business_start_date',
      label: 'Business Start Date',
      tenantValue: reference.value.self_employed_start_date,
      referenceValue: accountantReference.value.business_start_date
    },
    {
      field: 'annual_income',
      label: 'Annual Income (Stated)',
      tenantValue: reference.value.self_employed_annual_income ? parseFloat(reference.value.self_employed_annual_income) : null,
      referenceValue: accountantReference.value.estimated_monthly_income ? parseFloat(accountantReference.value.estimated_monthly_income) * 12 : null
    },
    {
      field: 'accountant_firm',
      label: 'Accountant Firm',
      tenantValue: reference.value.accountant_name,
      referenceValue: accountantReference.value.accountant_firm
    },
    {
      field: 'accountant_name',
      label: 'Accountant Contact Name',
      tenantValue: reference.value.accountant_contact_name,
      referenceValue: accountantReference.value.accountant_name
    },
    {
      field: 'accountant_email',
      label: 'Accountant Email',
      tenantValue: reference.value.accountant_email,
      referenceValue: accountantReference.value.accountant_email
    },
    {
      field: 'accountant_phone',
      label: 'Accountant Phone',
      tenantValue: reference.value.accountant_phone,
      referenceValue: accountantReference.value.accountant_phone
    }
  ]
})
```

### 5. Add Comparison Table Sections in Template

#### A. Add after line 68 (in Overview section - after status banner):

```vue
<!-- Group Application Info -->
<div v-if="reference.is_group_parent || reference.parent_reference_id" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
  <h3 class="text-sm font-semibold text-blue-900 mb-2">Group Application</h3>
  <div v-if="reference.is_group_parent" class="text-sm text-blue-800">
    <p><strong>Type:</strong> Primary Applicant (Parent Reference)</p>
    <p><strong>Total Tenants:</strong> {{ childReferences.length + 1 }}</p>
    <p><strong>Total Monthly Rent:</strong> £{{ reference.monthly_rent }}</p>
  </div>
  <div v-else-if="reference.parent_reference_id" class="text-sm text-blue-800">
    <p><strong>Type:</strong> Co-Tenant #{{ reference.tenant_position }}</p>
    <p><strong>Rent Share:</strong> £{{ reference.rent_share }} of £{{ reference.monthly_rent }} total</p>
    <button @click="$router.push(`/staff/references/${reference.parent_reference_id}`)" class="mt-2 text-blue-600 hover:text-blue-800 underline">
      View Parent Application
    </button>
  </div>
</div>
```

#### B. Replace existing Employment section (around line 270-490) with comparison version:

```vue
<!-- Employment Verification with Comparison -->
<div v-if="reference.income_regular_employment" class="bg-white rounded-lg shadow p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Employment Verification</h3>

  <!-- Employment Details Comparison -->
  <div v-if="employerReference" class="mb-6">
    <h4 class="text-md font-semibold text-gray-700 mb-3">Employment Details Comparison</h4>
    <ComparisonTable
      :rows="employmentComparisonRows"
      tenant-column-label="Tenant Provided"
      reference-column-label="Employer Confirmed"
    />
  </div>

  <!-- Employer Assessment (keep existing) -->
  <div v-if="employerReference" class="mt-6 pt-6 border-t">
    <h4 class="text-md font-semibold text-gray-700 mb-3">Employer's Assessment</h4>
    <!-- Keep existing employer assessment display -->
  </div>
</div>
```

#### C. Add Landlord/Agent Comparison (insert after employment section):

```vue
<!-- Rental History Comparison -->
<div v-if="landlordReference || agentReference" class="bg-white rounded-lg shadow p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">
    {{ reference.reference_type === 'agent' ? 'Agent' : 'Landlord' }} Reference Comparison
  </h3>

  <!-- Comparison Table -->
  <div class="mb-6">
    <ComparisonTable
      v-if="landlordReference"
      :rows="landlordComparisonRows"
      tenant-column-label="Tenant Provided"
      reference-column-label="Landlord Confirmed"
    />
    <ComparisonTable
      v-else-if="agentReference"
      :rows="agentComparisonRows"
      tenant-column-label="Tenant Provided"
      reference-column-label="Agent Confirmed"
    />
  </div>

  <!-- Reference Assessment -->
  <div class="mt-6 pt-6 border-t">
    <h4 class="text-md font-semibold text-gray-700 mb-3">Tenancy Assessment</h4>
    <!-- Keep existing assessment display -->
  </div>
</div>
```

#### D. Add Accountant Comparison (replace self-employed section around line 492):

```vue
<!-- Self-Employment & Accountant Verification -->
<div v-if="reference.income_self_employed" class="bg-white rounded-lg shadow p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Self-Employment Verification</h3>

  <!-- Business Details Comparison -->
  <div v-if="accountantReference && accountantReference.submitted_at" class="mb-6">
    <h4 class="text-md font-semibold text-gray-700 mb-3">Business Details Comparison</h4>
    <ComparisonTable
      :rows="accountantComparisonRows"
      tenant-column-label="Tenant Provided"
      reference-column-label="Accountant Confirmed"
    />
  </div>

  <!-- Accountant Assessment -->
  <div v-if="accountantReference && accountantReference.submitted_at" class="mt-6 pt-6 border-t">
    <h4 class="text-md font-semibold text-gray-700 mb-3">Accountant's Assessment</h4>
    <!-- Keep existing accountant assessment display -->
  </div>
</div>
```

#### E. Add Previous Addresses Section (new section):

```vue
<!-- Previous Addresses History -->
<div v-if="previousAddresses && previousAddresses.length > 0" class="bg-white rounded-lg shadow p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Address History</h3>
  <div class="space-y-4">
    <div v-for="(addr, index) in previousAddresses" :key="addr.id" class="p-4 border border-gray-200 rounded-lg">
      <div class="flex justify-between items-start mb-2">
        <h4 class="text-sm font-semibold text-gray-700">Previous Address #{{ index + 1 }}</h4>
        <span class="text-sm text-gray-500">
          {{ addr.time_at_address_years || 0 }} year(s), {{ addr.time_at_address_months || 0 }} month(s)
        </span>
      </div>
      <div class="text-sm text-gray-900">
        <p>{{ addr.address_line1 }}</p>
        <p v-if="addr.address_line2">{{ addr.address_line2 }}</p>
        <p>{{ addr.city }}, {{ addr.postcode }}</p>
        <p v-if="addr.country">{{ addr.country }}</p>
      </div>
    </div>
    <div class="pt-4 border-t">
      <p class="text-sm font-medium text-gray-700">
        Total Address History:
        <span class="text-gray-900">
          {{ calculateTotalAddressHistory() }}
        </span>
      </p>
    </div>
  </div>
</div>
```

#### F. Add Additional Documents Section (new section):

```vue
<!-- Additional Supporting Documents -->
<div v-if="documents && documents.length > 0" class="bg-white rounded-lg shadow p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Additional Supporting Documents</h3>
  <div class="space-y-2">
    <div v-for="doc in documents" :key="doc.id" class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
      <div class="flex items-center flex-1">
        <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-900">{{ doc.file_name }}</p>
          <p class="text-xs text-gray-500">{{ formatFileSize(doc.file_size) }} • Uploaded {{ formatDate(doc.created_at) }}</p>
        </div>
      </div>
      <div class="flex gap-2 ml-4">
        <button
          @click="viewFile(doc.file_url)"
          class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
        >
          View
        </button>
        <button
          @click="downloadFile(doc.file_url)"
          class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80 rounded-md border border-primary"
        >
          Download
        </button>
      </div>
    </div>
  </div>
</div>
```

### 6. Add Helper Functions (in script section):

```typescript
const calculateTotalAddressHistory = () => {
  if (!reference.value && (!previousAddresses.value || previousAddresses.value.length === 0)) {
    return 'Not provided'
  }

  let totalYears = reference.value?.time_at_address_years || 0
  let totalMonths = reference.value?.time_at_address_months || 0

  previousAddresses.value.forEach(addr => {
    totalYears += addr.time_at_address_years || 0
    totalMonths += addr.time_at_address_months || 0
  })

  // Convert excess months to years
  totalYears += Math.floor(totalMonths / 12)
  totalMonths = totalMonths % 12

  const parts = []
  if (totalYears > 0) parts.push(`${totalYears} year${totalYears !== 1 ? 's' : ''}`)
  if (totalMonths > 0) parts.push(`${totalMonths} month${totalMonths !== 1 ? 's' : ''}`)

  return parts.length > 0 ? parts.join(', ') : 'Not provided'
}

const formatFileSize = (bytes: number) => {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
```

## Implementation Order

1. Add imports
2. Add missing refs
3. Update fetchReference
4. Add computed properties
5. Add helper functions
6. Add/update template sections one by one

This will ensure all data is displayed according to the plan with comparison tables showing match/mismatch status.
