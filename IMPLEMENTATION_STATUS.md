# Implementation Status - Reference Data Display

## ✅ Completed

### 1. Backend API
- **Status:** COMPLETE - No changes needed
- API endpoint `/api/staff/references/:id` already returns all data:
  - reference (main tenant data)
  - employerReference
  - landlordReference
  - agentReference
  - accountantReference
  - previousAddresses
  - documents
  - childReferences (for group applications)
  - parentReference (for group applications)
  - siblingReferences (for group applications)

### 2. Comparison Table Component
- **File:** `/frontend/src/components/ComparisonTable.vue`
- **Status:** COMPLETE
- **Features:**
  - Side-by-side data comparison
  - Automatic match/mismatch detection
  - Visual indicators (✓ Match, ⚠ Minor Difference, ✗ Mismatch)
  - Color-coded rows (red for mismatches, yellow for minor differences)
  - Smart string similarity matching
  - Supports dates, numbers, booleans, strings
  - Custom comparison logic support

### 3. StaffReferenceDetail.vue Script Section
- **File:** `/frontend/src/views/StaffReferenceDetail.vue`
- **Status:** COMPLETE
- **Changes Made:**
  1. ✅ Added imports: `computed` from vue, `ComparisonTable` component
  2. ✅ Added refs: previousAddresses, documents, childReferences, parentReference, siblingReferences
  3. ✅ Updated `fetchReference()` to populate new refs from API response
  4. ✅ Added helper functions:
     - `calculateTotalAddressHistory()` - Calculates total time across all addresses
     - `formatFileSize()` - Formats bytes to human-readable size
  5. ✅ Added computed properties:
     - `employmentComparisonRows` - 8 comparison rows for employment data
     - `landlordComparisonRows` - 9 comparison rows for landlord reference
     - `agentComparisonRows` - 7 comparison rows for agent reference
     - `accountantComparisonRows` - 8 comparison rows for accountant reference

## 📋 Pending - Template Sections

### Template Sections That Need to Be Added/Updated

The following sections need to be added to the template in `StaffReferenceDetail.vue`:

#### 1. Group Application Banner (After line 68 - Status Banner)
```vue
<!-- Group Application Info -->
<div v-if="reference.is_group_parent || reference.parent_reference_id" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
  <h3 class="text-sm font-semibold text-blue-900 mb-2">Group Application</h3>
  <div v-if="reference.is_group_parent" class="text-sm text-blue-800">
    <p><strong>Type:</strong> Primary Applicant (Parent Reference)</p>
    <p><strong>Total Tenants:</strong> {{ childReferences.length + 1 }}</p>
    <p><strong>Total Monthly Rent:</strong> £{{ reference.monthly_rent }}</p>
    <div v-if="childReferences.length > 0" class="mt-2">
      <p class="font-semibold mb-1">Co-Tenants:</p>
      <div v-for="child in childReferences" :key="child.id" class="ml-4">
        <button
          @click="$router.push(`/staff/references/${child.id}`)"
          class="text-blue-600 hover:text-blue-800 underline"
        >
          {{ child.tenant_first_name }} {{ child.tenant_last_name }} - £{{ child.rent_share }} rent share
        </button>
      </div>
    </div>
  </div>
  <div v-else-if="reference.parent_reference_id" class="text-sm text-blue-800">
    <p><strong>Type:</strong> Co-Tenant #{{ reference.tenant_position }}</p>
    <p><strong>Rent Share:</strong> £{{ reference.rent_share }} of £{{ reference.monthly_rent }} total</p>
    <button @click="$router.push(`/staff/references/${reference.parent_reference_id}`)" class="mt-2 text-blue-600 hover:text-blue-800 underline">
      View Primary Application
    </button>
  </div>
</div>
```

#### 2. Employment Comparison Table (Find and add after employerReference block, around line 405)
```vue
<!-- Employment Verification Comparison -->
<div v-if="reference.income_regular_employment && employerReference" class="bg-white rounded-lg shadow p-6 mt-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Employment Data Verification</h3>
  <p class="text-sm text-gray-600 mb-4">Compare tenant-provided information with employer-confirmed details</p>
  <ComparisonTable
    :rows="employmentComparisonRows"
    tenant-column-label="Tenant Provided"
    reference-column-label="Employer Confirmed"
  />
</div>
```

#### 3. Landlord/Agent Comparison Table (Find and add after landlord/agent reference block)
```vue
<!-- Rental History Comparison -->
<div v-if="landlordReference || agentReference" class="bg-white rounded-lg shadow p-6 mt-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">
    {{ reference.reference_type === 'agent' ? 'Agent' : 'Landlord' }} Reference Data Verification
  </h3>
  <p class="text-sm text-gray-600 mb-4">Compare tenant-provided information with reference details</p>
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
```

#### 4. Accountant Comparison Table (Find and add after accountant reference block)
```vue
<!-- Self-Employment Verification Comparison -->
<div v-if="reference.income_self_employed && accountantReference && accountantReference.submitted_at" class="bg-white rounded-lg shadow p-6 mt-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Business Data Verification</h3>
  <p class="text-sm text-gray-600 mb-4">Compare tenant-provided information with accountant-confirmed details</p>
  <ComparisonTable
    :rows="accountantComparisonRows"
    tenant-column-label="Tenant Provided"
    reference-column-label="Accountant Confirmed"
  />
</div>
```

#### 5. Previous Addresses Section (New section - add after Current Address section)
```vue
<!-- Previous Addresses History -->
<div v-if="previousAddresses && previousAddresses.length > 0" class="bg-white rounded-lg shadow p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Address History</h3>
  <p class="text-sm text-gray-600 mb-4">Full 3-year address history for verification</p>
  <div class="space-y-4">
    <div v-for="(addr, index) in previousAddresses" :key="addr.id" class="p-4 border border-gray-200 rounded-lg bg-gray-50">
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
    <div class="pt-4 border-t border-gray-300">
      <p class="text-sm font-medium text-gray-700">
        Total Address History:
        <span class="text-lg font-semibold text-gray-900 ml-2">
          {{ calculateTotalAddressHistory() }}
        </span>
      </p>
    </div>
  </div>
</div>
```

#### 6. Additional Documents Section (New section - add before or after documents section)
```vue
<!-- Additional Supporting Documents -->
<div v-if="documents && documents.length > 0" class="bg-white rounded-lg shadow p-6">
  <h3 class="text-lg font-semibold text-gray-900 mb-4">Additional Supporting Documents</h3>
  <p class="text-sm text-gray-600 mb-4">Extra documents uploaded by tenant or staff</p>
  <div class="space-y-2">
    <div v-for="doc in documents" :key="doc.id" class="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg hover:bg-gray-100 transition-colors">
      <div class="flex items-center flex-1">
        <svg class="w-5 h-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-900">{{ doc.file_name }}</p>
          <p class="text-xs text-gray-500">
            {{ formatFileSize(doc.file_size) }} • Uploaded {{ formatDate(doc.created_at) }}
            <span v-if="doc.uploaded_by" class="ml-2">by {{ doc.uploaded_by }}</span>
          </p>
        </div>
      </div>
      <div class="flex gap-2 ml-4">
        <button
          @click="viewFile(doc.file_url)"
          class="px-3 py-1 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
        >
          View
        </button>
        <button
          @click="downloadFile(doc.file_url)"
          class="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80 rounded-md border border-primary transition-colors"
        >
          Download
        </button>
      </div>
    </div>
  </div>
</div>
```

## Next Steps

1. **Add Template Sections** - Insert the 6 template sections above into StaffReferenceDetail.vue
2. **Apply Similar Changes to ReferenceDetail.vue** (Agent View)
3. **Test with Real Data** - Start frontend and verify:
   - Comparison tables display correctly
   - Match/mismatch indicators work
   - Group application info shows
   - Previous addresses display
   - Additional documents work

## Files Modified

- ✅ `/frontend/src/components/ComparisonTable.vue` (NEW)
- ✅ `/frontend/src/views/StaffReferenceDetail.vue` (PARTIAL - script complete, template pending)
- ⏳ `/frontend/src/views/ReferenceDetail.vue` (NOT STARTED)

## Testing Checklist

Once template sections are added:
- [ ] Employment comparison shows all 8 fields
- [ ] Landlord/Agent comparison shows all 9/7 fields
- [ ] Accountant comparison shows all 8 fields
- [ ] Previous addresses display with total history calculation
- [ ] Additional documents list with proper file size formatting
- [ ] Group application banner shows for parent/child references
- [ ] Match status indicators (✓⚠✗) display correctly
- [ ] Color coding (green/yellow/red) works for rows
- [ ] All encrypted fields decrypt properly

## Known Considerations

1. **Field Mapping**: Some tenant fields are reused (e.g., `previous_landlord_name` for both landlord and agent)
2. **Date Handling**: Tenant provides duration, references provide exact dates
3. **Income Calculations**: Different formats (annual vs monthly, salary vs turnover)
4. **Empty States**: Handle cases where references haven't been submitted yet
5. **Performance**: Large comparison tables with many rows
