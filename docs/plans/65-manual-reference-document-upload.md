# #65 - Manual Reference Document Upload for Landlords/Employers/Agents

## Problem
Some referees cannot fill out online forms due to work PC restrictions and must send physical letters to the agent/requester or Info@PropertyGoose.

## Solution
Add "Manual Reference Letter" as an evidence upload option for all reference sections (income, residential, etc.), allowing staff to upload scanned letters and mark the reference as complete.

## Scope
- All reference types: Landlord, Employer, Agent, Accountant
- Upload location: Within verification sections (Income for employer/accountant, Residential for landlord/agent)
- Effect: Marks referee as complete (sets `submitted_at`), stops chase reminders

---

## Implementation Steps

### 1. Database Migration
Add columns to track manual uploads:

```sql
ALTER TABLE landlord_references ADD COLUMN manual_letter_path TEXT, ADD COLUMN is_manual_upload BOOLEAN DEFAULT FALSE;
ALTER TABLE employer_references ADD COLUMN manual_letter_path TEXT, ADD COLUMN is_manual_upload BOOLEAN DEFAULT FALSE;
ALTER TABLE agent_references ADD COLUMN manual_letter_path TEXT, ADD COLUMN is_manual_upload BOOLEAN DEFAULT FALSE;
ALTER TABLE accountant_references ADD COLUMN manual_letter_path TEXT, ADD COLUMN is_manual_upload BOOLEAN DEFAULT FALSE;
```

### 2. Backend Endpoint
**File:** `/backend/src/routes/staff.ts`

Add new endpoint `POST /staff/references/:referenceId/upload-manual-reference`

Logic:
1. Accept file upload + `reference_type` (landlord|employer|agent|accountant)
2. Upload file to Supabase Storage at `{referenceId}/manual_references/{type}_{timestamp}.{ext}`
3. Update appropriate reference table:
   - Set `submitted_at = now()`
   - Set `manual_letter_path = filePath`
   - Set `is_manual_upload = true`
4. Call `markDependencyReceivedByType()` to mark chase as RECEIVED
5. Check verification readiness and transition state if ready
6. Log audit action

**Key mappings:**
| reference_type | Table | FK Field | Chase Dependency Type |
|---------------|-------|----------|----------------------|
| landlord | landlord_references | reference_id | RESIDENTIAL_REF |
| agent | agent_references | reference_id | RESIDENTIAL_REF |
| employer | employer_references | reference_id | EMPLOYER_REF |
| accountant | accountant_references | tenant_reference_id | ACCOUNTANT_REF |

### 3. Frontend Component
**New file:** `/frontend/src/components/staff/verify/shared/ManualReferenceUpload.vue`

Props:
- `referenceId: string`
- `referenceType: 'landlord' | 'employer' | 'agent' | 'accountant'`

Emits: `@uploaded` when complete

UI:
- Button: "Upload Manual Reference Letter"
- Expands to file input (PDF/JPG/PNG)
- Upload button: "Upload & Mark Complete"
- Shows upload progress and success message

### 4. Income Section Integration
**File:** `/frontend/src/components/staff/verify/sections/IncomeSection.vue`

Add upload option when employer/accountant reference not received:

```vue
<!-- After line ~232, where employer reference is displayed -->
<div v-if="!evidenceEmployerRef" class="no-reference">
  <p>Employer reference not received</p>
  <ManualReferenceUpload
    :reference-id="referenceId"
    reference-type="employer"
    @uploaded="refreshEvidenceData"
  />
</div>

<!-- After line ~549, where accountant reference is displayed -->
<div v-if="!evidenceAccountantRef" class="no-reference">
  <p>Accountant reference not received</p>
  <ManualReferenceUpload
    :reference-id="referenceId"
    reference-type="accountant"
    @uploaded="refreshEvidenceData"
  />
</div>
```

### 5. Residential Section Integration
**File:** `/frontend/src/components/staff/verify/sections/ResidentialSection.vue`

Add upload option when landlord/agent reference not received:

```vue
<div v-if="!evidenceLandlordRef && !evidenceAgentRef && needsResidentialReference" class="no-reference">
  <p>{{ referenceType === 'agent' ? 'Agent' : 'Landlord' }} reference not received</p>
  <ManualReferenceUpload
    :reference-id="referenceId"
    :reference-type="referenceType === 'agent' ? 'agent' : 'landlord'"
    @uploaded="refreshData"
  />
</div>
```

### 6. API Response Update
**File:** `/backend/src/routes/verify.ts`

Include `isManualUpload` and `manualLetterPath` in reference objects returned by the API so UI can display indicator.

### 7. Display Manual Upload Indicator
When reference was manually uploaded, show badge in UI:
```vue
<span v-if="reference.isManualUpload" class="manual-badge">
  Manual Letter
</span>
```

---

## Critical Files

| File | Changes |
|------|---------|
| `/backend/src/routes/staff.ts` | New upload endpoint (line ~2010) |
| `/backend/src/services/chaseDependencyService.ts` | Use existing `markDependencyReceivedByType()` (line 491) |
| `/frontend/src/components/staff/verify/sections/IncomeSection.vue` | Add upload for employer/accountant |
| `/frontend/src/components/staff/verify/sections/ResidentialSection.vue` | Add upload for landlord/agent |
| `/frontend/src/components/staff/verify/shared/ManualReferenceUpload.vue` | New component |
| `/backend/src/routes/verify.ts` | Include manual upload fields in API response |

---

## Edge Cases

1. **No referee record exists yet**: Create new record with just `submitted_at`, `manual_letter_path`, `is_manual_upload`
2. **Re-upload**: Update existing record, replace file path
3. **Accountant FK difference**: Uses `tenant_reference_id` instead of `reference_id`
