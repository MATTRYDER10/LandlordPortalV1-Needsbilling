# Guarantor Reference Form - Remaining Tasks

## ✅ Completed
1. ✅ Database table created (`035_create_guarantor_references_table.sql`)
2. ✅ GuarantorReference.vue copied from SubmitReference.vue
3. ✅ Title and intro text updated to guarantor context
4. ✅ Warning message added about guarantor legal obligations

## 📋 Remaining Frontend Work (GuarantorReference.vue)

### Pages 1-4: Keep Mostly As-Is
- **Page 1 (ID Document)**: ✅ Updated intro - keep the rest
- **Page 2 (Personal Details)**: Change "Tenant" labels to "Guarantor" where appropriate
- **Page 3 (Selfie)**: Keep as-is
- **Page 4 (Address)**: Keep as-is

### Page 5: Add Home Ownership Status (NEW)
**Location**: After Page 4 (Address History)
```vue
<!-- PAGE 5: Home Ownership Status -->
<div v-if="currentPage === 5" class="bg-white rounded-lg shadow p-6">
  <h2>Home Ownership Status</h2>
  <div>
    <label>Do you own or rent your current home? *</label>
    <select v-model="formData.home_ownership_status" required>
      <option value="">Select an option</option>
      <option value="owner">I own my home</option>
      <option value="owner_with_mortgage">I own my home (with mortgage)</option>
      <option value="renting">I am renting</option>
      <option value="living_with_family">Living with family/friends</option>
      <option value="other">Other</option>
    </select>
  </div>

  <!-- If owner, ask for property value -->
  <div v-if="formData.home_ownership_status === 'owner' || formData.home_ownership_status === 'owner_with_mortgage'">
    <label>Estimated Property Value (£) *</label>
    <input v-model.number="formData.property_value" type="number" required />
  </div>

  <!-- If owner with mortgage, ask for outstanding balance -->
  <div v-if="formData.home_ownership_status === 'owner_with_mortgage'">
    <label>Outstanding Mortgage Balance (£) *</label>
    <input v-model.number="formData.mortgage_balance" type="number" required />
  </div>
</div>
```

### Page 6: Modify Financial/Income Section
**Changes needed**:
1. **Remove**: `income_student` and `income_unemployed` checkboxes
2. **Add**: Retired option with pension fields
3. **Add**: "Other" option for non-standard income

```vue
<!-- Page 6: Income Sources - MODIFY EXISTING -->
<div>
  <label class="flex items-center">
    <input v-model="formData.income_retired" type="checkbox" />
    <span>Retired (Pension)</span>
  </label>
</div>

<!-- If retired, show pension fields -->
<div v-if="formData.income_retired">
  <h3>Pension Details</h3>
  <div>
    <label>Monthly Pension Amount (£) *</label>
    <input v-model.number="formData.pension_monthly_amount" type="number" required />
  </div>
  <div>
    <label>Pension Provider *</label>
    <input v-model="formData.pension_provider" type="text" required />
  </div>
</div>
```

### Page 7: Savings & Assets (NEW)
**Location**: After Page 6 (Income)
```vue
<!-- PAGE 7: Savings & Assets -->
<div v-if="currentPage === 7" class="bg-white rounded-lg shadow p-6">
  <h2>Savings & Assets</h2>

  <div>
    <label>Total Savings (£)</label>
    <input v-model.number="formData.savings_amount" type="number" />
    <p class="text-xs text-gray-500">Include all bank accounts, ISAs, and liquid savings</p>
  </div>

  <div>
    <label>Do you have any other significant assets?</label>
    <textarea v-model="formData.other_assets" rows="3"></textarea>
    <p class="text-xs text-gray-500">e.g., investments, stocks, shares, vehicles</p>
  </div>

  <!-- Upload bank statement -->
  <div>
    <label>Bank Statement (Last 3 months) *</label>
    <input type="file" @change="handleBankStatementUpload" required />
    <p class="text-xs text-gray-500">Required to verify financial capability</p>
  </div>
</div>
```

### Page 8: Financial Obligations (NEW)
**Location**: After Page 7 (Savings)
```vue
<!-- PAGE 8: Financial Obligations -->
<div v-if="currentPage === 8" class="bg-white rounded-lg shadow p-6">
  <h2>Financial Obligations</h2>

  <div>
    <label>Monthly Mortgage/Rent Payment (£) *</label>
    <input v-model.number="formData.monthly_mortgage_rent" type="number" required />
  </div>

  <div>
    <label>Other Monthly Financial Commitments (£)</label>
    <input v-model.number="formData.other_monthly_commitments" type="number" />
    <p class="text-xs text-gray-500">Loans, credit cards, car payments, etc.</p>
  </div>

  <div>
    <label>Estimated Total Monthly Expenditure (£) *</label>
    <input v-model.number="formData.total_monthly_expenditure" type="number" required />
    <p class="text-xs text-gray-500">Including bills, food, transport, etc.</p>
  </div>
</div>
```

### Page 9: Credit History
**Keep existing credit history section from tenant form**

### Page 10: Previous Guarantor Experience (NEW)
**Location**: After credit history
```vue
<!-- PAGE 10: Previous Guarantor Experience -->
<div v-if="currentPage === 10" class="bg-white rounded-lg shadow p-6">
  <h2>Previous Guarantor Experience</h2>

  <div>
    <label>Have you acted as a guarantor before?</label>
    <div class="flex gap-2">
      <button type="button" @click="formData.previously_acted_as_guarantor = true">Yes</button>
      <button type="button" @click="formData.previously_acted_as_guarantor = false">No</button>
    </div>
  </div>

  <div v-if="formData.previously_acted_as_guarantor">
    <label>Please provide details</label>
    <textarea v-model="formData.previous_guarantor_details" rows="3" required></textarea>
    <p class="text-xs text-gray-500">When, for whom, and any relevant outcomes</p>
  </div>
</div>
```

### Page 11: Legal Consent & Understanding (NEW - CRITICAL!)
**Location**: Final page before submission
```vue
<!-- PAGE 11: Legal Consent & Understanding -->
<div v-if="currentPage === 11" class="bg-white rounded-lg shadow p-6">
  <h2>Legal Obligations & Consent</h2>

  <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
    <h3 class="font-semibold text-red-900 mb-2">Important Legal Information</h3>
    <p class="text-sm text-red-800">As a guarantor, you are entering into a legally binding agreement. Please read carefully.</p>
  </div>

  <div class="space-y-4">
    <label class="flex items-start">
      <input v-model="formData.understands_obligations" type="checkbox" required class="mt-1" />
      <span class="ml-2 text-sm">
        <strong>I understand</strong> that I am legally responsible for ensuring the rent is paid for the duration of the tenancy agreement. *
      </span>
    </label>

    <label class="flex items-start">
      <input v-model="formData.willing_to_pay_rent" type="checkbox" required class="mt-1" />
      <span class="ml-2 text-sm">
        <strong>I confirm</strong> that I am willing and financially able to pay the rent if {{ reference.tenant_first_name }} {{ reference.tenant_last_name }} is unable to do so. *
      </span>
    </label>

    <label class="flex items-start">
      <input v-model="formData.willing_to_pay_damages" type="checkbox" required class="mt-1" />
      <span class="ml-2 text-sm">
        <strong>I confirm</strong> that I am willing and financially able to cover any damages to the property caused by the tenant if they fail to do so. *
      </span>
    </label>

    <label class="flex items-start">
      <input v-model="formData.consent_legal_checks" type="checkbox" required class="mt-1" />
      <span class="ml-2 text-sm">
        <strong>I consent</strong> to credit and background checks being performed to verify my financial capability. *
      </span>
    </label>
  </div>

  <!-- Signature -->
  <div class="mt-6">
    <label>Full Name (Signature) *</label>
    <input v-model="formData.consent_signature_name" type="text" required />
  </div>

  <div>
    <label>Draw your signature below *</label>
    <canvas ref="signatureCanvas" class="border-2 border-gray-300"></canvas>
    <!-- Add signature canvas implementation like in tenant form -->
  </div>

  <div>
    <label>Date *</label>
    <input v-model="formData.consent_date" type="date" required />
  </div>
</div>
```

## 📋 formData Object Updates

Add these fields to the `formData` ref (around line 2548):

```typescript
const formData = ref({
  // ... existing fields ...

  // Home Ownership
  home_ownership_status: '',
  property_value: null as number | null,
  mortgage_balance: null as number | null,

  // Income - Add retired option
  income_retired: false,
  pension_monthly_amount: null as number | null,
  pension_provider: '',

  // Savings & Assets
  savings_amount: null as number | null,
  other_assets: '',
  bank_statement_path: '',

  // Financial Obligations
  monthly_mortgage_rent: null as number | null,
  other_monthly_commitments: null as number | null,
  total_monthly_expenditure: null as number | null,

  // Previous Guarantor Experience
  previously_acted_as_guarantor: false,
  previous_guarantor_details: '',

  // Legal Consent
  understands_obligations: false,
  willing_to_pay_rent: false,
  willing_to_pay_damages: false,
  consent_legal_checks: false,
  consent_signature_name: '',
  consent_signature: '',
  consent_date: ''
})
```

## 📋 Update Submission Endpoint

Around line 2200-2300, change:
```typescript
// OLD:
const response = await fetch(`${API_URL}/api/references/submit/${token}`, {

// NEW:
const response = await fetch(`${API_URL}/api/guarantor-references/submit/${token}`, {
```

## 📋 Update Page Count

Change from 11 pages to appropriate count (likely 11-12 pages total with new sections):
```typescript
// Update progress bar calculation
<span class="text-sm font-medium text-gray-700">Page {{ currentPage }} of 12</span>
<div class="h-2 rounded-full transition-all duration-300" :style="{ width: (currentPage / 12 * 100) + '%', backgroundColor: primaryColor }"></div>
```

## 📋 Update Router

In `/frontend/src/router/index.ts`, add:
```typescript
{
  path: '/guarantor-reference/:token',
  name: 'GuarantorReference',
  component: () => import('../views/GuarantorReference.vue')
},
```

## 📋 Backend Route

Create `/backend/src/routes/guarantor-references.ts`:
- Similar to employer/landlord reference routes
- POST `/api/guarantor-references/submit/:token`
- Encrypt all data
- Insert into guarantor_references table
- Link to tenant_references via reference_id

## 📋 Email Template

Create `/backend/email-templates/guarantor-reference-request.html`:
- Explain what a guarantor is
- List legal obligations clearly
- Include link to guarantor form
- Sent when agent creates/requests guarantor reference

## 📋 Update Agent Notification

Modify the guarantor request notification we created earlier to auto-send the guarantor reference request email to the guarantor's email address (not just notify the agent).

---

## Priority Order
1. Complete GuarantorReference.vue modifications (pages 5-11)
2. Update formData object
3. Change submission endpoint
4. Add router route
5. Create backend route
6. Create email template
7. Update agent notification to auto-send guarantor email
