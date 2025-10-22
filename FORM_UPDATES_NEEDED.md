# Form Updates Required for Complete Comparison Data

## ✅ Step 1: Run Database Migration

**Run this SQL in your Supabase SQL Editor:**

```sql
ALTER TABLE public.tenant_references
  ADD COLUMN IF NOT EXISTS previous_monthly_rent_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_tenancy_start_date DATE,
  ADD COLUMN IF NOT EXISTS previous_tenancy_end_date DATE,
  ADD COLUMN IF NOT EXISTS previous_agency_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employment_end_date DATE,
  ADD COLUMN IF NOT EXISTS employment_salary_frequency TEXT;
```

The migration SQL file is saved at: `backend/migrations/add_missing_comparison_fields.sql`

---

## Step 2: Update Backend Encryption/Decryption

Add these fields to the encryption/decryption logic in your backend:

**File:** `backend/src/routes/references.ts` (or wherever encryption happens)

Add to encrypted fields array:
```javascript
'previous_monthly_rent',
'previous_agency_name'
```

---

## Step 3: Update Frontend Form (SubmitReference.vue)

### A. Previous Landlord/Agent Section

**Add after existing previous landlord fields:**

```vue
<!-- Previous Monthly Rent -->
<div>
  <label class="block text-sm font-medium text-gray-700 mb-2">
    Monthly Rent at Previous Address*
  </label>
  <div class="relative">
    <span class="absolute left-3 top-3 text-gray-500">£</span>
    <input
      v-model="formData.previous_monthly_rent"
      type="number"
      required
      class="pl-7 w-full px-3 py-2 border border-gray-300 rounded-md"
      placeholder="800"
    />
  </div>
</div>

<!-- Previous Tenancy Start Date -->
<div>
  <label class="block text-sm font-medium text-gray-700 mb-2">
    Tenancy Start Date*
  </label>
  <input
    v-model="formData.previous_tenancy_start_date"
    type="date"
    required
    class="w-full px-3 py-2 border border-gray-300 rounded-md"
  />
</div>

<!-- Previous Tenancy End Date -->
<div>
  <label class="block text-sm font-medium text-gray-700 mb-2">
    Tenancy End Date*
  </label>
  <input
    v-model="formData.previous_tenancy_end_date"
    type="date"
    required
    class="w-full px-3 py-2 border border-gray-300 rounded-md"
  />
  <p class="mt-1 text-xs text-gray-500">
    If still living there, use today's date
  </p>
</div>

<!-- Agency Name (only show if reference_type is 'agent') -->
<div v-if="formData.reference_type === 'agent'">
  <label class="block text-sm font-medium text-gray-700 mb-2">
    Letting Agency Name*
  </label>
  <input
    v-model="formData.previous_agency_name"
    type="text"
    required
    class="w-full px-3 py-2 border border-gray-300 rounded-md"
    placeholder="e.g., Foxtons, Rightmove Lettings"
  />
</div>
```

### B. Employment Section

**Add after employment start date:**

```vue
<!-- Employment End Date (for previous employment) -->
<div>
  <label class="block text-sm font-medium text-gray-700 mb-2">
    Employment End Date
  </label>
  <input
    v-model="formData.employment_end_date"
    type="date"
    class="w-full px-3 py-2 border border-gray-300 rounded-md"
  />
  <p class="mt-1 text-xs text-gray-500">
    Leave blank if current employment
  </p>
</div>

<!-- Salary Payment Frequency -->
<div>
  <label class="block text-sm font-medium text-gray-700 mb-2">
    How Often Are You Paid?*
  </label>
  <select
    v-model="formData.employment_salary_frequency"
    required
    class="w-full px-3 py-2 border border-gray-300 rounded-md"
  >
    <option value="">Select frequency...</option>
    <option value="weekly">Weekly</option>
    <option value="bi-weekly">Bi-weekly (Every 2 weeks)</option>
    <option value="monthly">Monthly</option>
    <option value="annually">Annually</option>
  </select>
</div>
```

---

## Step 4: Update Comparison Rows

Update the computed properties in both `StaffReferenceDetail.vue` and `ReferenceDetail.vue`:

### landlordComparisonRows (Line ~1890 in StaffReferenceDetail.vue)

**Replace the monthly_rent row:**
```javascript
{
  field: 'monthly_rent',
  label: 'Monthly Rent',
  tenantValue: reference.value.previous_monthly_rent,  // NOW PROVIDED BY TENANT
  referenceValue: landlordReference.value.monthly_rent ? `£${landlordReference.value.monthly_rent}` : null,
  isNotApplicable: false  // CHANGED: Now both sides provide it
}
```

**Replace the tenancy dates rows:**
```javascript
{
  field: 'tenancy_start',
  label: 'Tenancy Start Date',
  tenantValue: reference.value.previous_tenancy_start_date,  // NOW PROVIDED BY TENANT
  referenceValue: landlordReference.value.tenancy_start_date,
  isNotApplicable: false  // CHANGED
},
{
  field: 'tenancy_end',
  label: 'Tenancy End Date',
  tenantValue: reference.value.previous_tenancy_end_date,  // NOW PROVIDED BY TENANT
  referenceValue: landlordReference.value.tenancy_end_date,
  isNotApplicable: false  // CHANGED
}
```

### agentComparisonRows

**Add agency name comparison:**
```javascript
{
  field: 'agency_name',
  label: 'Agency Name',
  tenantValue: reference.value.previous_agency_name,  // NOW PROVIDED BY TENANT
  referenceValue: agentReference.value.agency_name,
  isNotApplicable: false  // CHANGED
}
```

**Update rent and dates same as landlord above**

### employmentComparisonRows

**Add employment end date:**
```javascript
{
  field: 'employment_end_date',
  label: 'Employment End Date',
  tenantValue: reference.value.employment_end_date,
  referenceValue: employerReference.value.employment_end_date,
  isNotApplicable: false
}
```

**Add salary frequency:**
```javascript
{
  field: 'salary_frequency',
  label: 'Payment Frequency',
  tenantValue: reference.value.employment_salary_frequency,
  referenceValue: employerReference.value.salary_frequency,
  isNotApplicable: false
}
```

---

## Step 5: Validation & Notes

### Important Considerations:

1. **Backward Compatibility**: Existing references won't have these new fields filled. Handle gracefully:
   ```javascript
   tenantValue: reference.value.previous_monthly_rent || null
   ```

2. **Form Validation**: Make these fields required for NEW submissions, but not break existing data

3. **Date Calculations**: You can still keep `tenancy_years` and `tenancy_months` as a backup/alternative input method

4. **Migration Timing**: Run the migration before deploying the form updates

---

## Testing Checklist

After implementing:

- [ ] Run database migration successfully
- [ ] Test form submission with new fields
- [ ] Verify encryption/decryption works for new encrypted fields
- [ ] Check comparison tables show new fields
- [ ] Test with existing references (should handle missing data)
- [ ] Verify match/mismatch detection works for new fields

---

## Files That Need Updates

1. ✅ Database: Run migration SQL
2. Backend:
   - `backend/src/routes/references.ts` - Add encryption/decryption
   - Any validation schemas
3. Frontend:
   - `frontend/src/views/SubmitReference.vue` - Add form fields
   - `frontend/src/views/StaffReferenceDetail.vue` - Update comparison rows (lines ~1890+)
   - `frontend/src/views/ReferenceDetail.vue` - Update comparison rows (lines ~2348+)

---

## Why These Changes Matter

**Before:** One-sided fields meant no true comparison
- Tenant: "I paid £800/month" ← No verification
- Landlord: "They paid £1000/month" ← No comparison possible

**After:** Both sides provide data = True verification
- Tenant: "I paid £800/month"
- Landlord: "They paid £1000/month"
- System: ✗ **MISMATCH** - Red flag for fraud!

This significantly improves fraud detection and data accuracy.
