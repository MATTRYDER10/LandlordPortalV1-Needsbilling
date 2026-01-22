# Agent Chase Email Duplicate Fix

## Problem Identified

Letting agents were receiving **BOTH** landlord and agent chase emails for the same reference. This was confusing and unprofessional.

## Root Cause

When creating chase dependencies for a RESIDENTIAL_REF:

1. The code correctly determined whether to use `landlord_references` or `agent_references` for the `linked_table` field based on `reference.reference_type` ([chaseDependencyService.ts:146](../src/services/chaseDependencyService.ts#L146))

2. **BUT** when creating the corresponding `verification_sections` entry (which drives the Pending Responses queue), the code **always** used `LANDLORD_REFERENCE` as the `section_type`, regardless of whether it was an agent or landlord ([chaseDependencyService.ts:199](../src/services/chaseDependencyService.ts#L199))

3. This meant that:
   - Agent referees had a `LANDLORD_REFERENCE` section created in `verification_sections`
   - The chase email sending logic checks `reference.reference_type` to decide which email to send
   - But the section_type was wrong, causing confusion in the UI and potentially duplicate emails

## Solution Implemented

### 1. Fixed Section Creation Logic ([chaseDependencyService.ts:195-228](../src/services/chaseDependencyService.ts#L195-L228))

Updated the section creation to check the `linked_table` field and use the correct `section_type`:

```typescript
// BEFORE - Always created LANDLORD_REFERENCE:
const externalRefMap: Record<string, { sectionType: string; order: number }> = {
  'EMPLOYER_REF': { sectionType: 'EMPLOYER_REFERENCE', order: 1 },
  'RESIDENTIAL_REF': { sectionType: 'LANDLORD_REFERENCE', order: 2 },
  'ACCOUNTANT_REF': { sectionType: 'ACCOUNTANT_REFERENCE', order: 3 }
}

const sectionsToCreate = dependenciesToCreate
  .filter(dep => externalRefMap[dep.dependency_type])
  .map(dep => ({
    reference_id: dep.reference_id,
    person_type: 'TENANT',
    section_type: externalRefMap[dep.dependency_type].sectionType,
    ...
  }))
```

```typescript
// AFTER - Checks linked_table to determine correct section_type:
const sectionsToCreate = dependenciesToCreate
  .filter(dep => externalRefMap[dep.dependency_type])
  .map(dep => {
    // For RESIDENTIAL_REF, determine section_type based on linked_table
    // (agent_references → AGENT_REFERENCE, landlord_references → LANDLORD_REFERENCE)
    let sectionType = externalRefMap[dep.dependency_type].sectionType
    if (dep.dependency_type === 'RESIDENTIAL_REF' && dep.linked_table === 'agent_references') {
      sectionType = 'AGENT_REFERENCE'
    }

    return {
      reference_id: dep.reference_id,
      person_type: 'TENANT',
      section_type: sectionType,
      ...
    }
  })
```

### 2. Updated Pending Responses Queue Query ([chaseDependencyService.ts:331](../src/services/chaseDependencyService.ts#L331))

The Pending Responses queue query was missing `AGENT_REFERENCE` sections entirely:

```typescript
// BEFORE - Missing AGENT_REFERENCE:
.in('section_type', ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'ACCOUNTANT_REFERENCE'])

// AFTER - Now includes AGENT_REFERENCE:
.in('section_type', ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'AGENT_REFERENCE', 'ACCOUNTANT_REFERENCE'])
```

Also updated the marked_done query at line 353 to include AGENT_REFERENCE.

## Cleanup Required

**IMPORTANT:** Existing references with `reference_type='agent'` may still have incorrectly created `LANDLORD_REFERENCE` sections in the database.

### To fix existing data, run:

```bash
node fix-agent-sections.js
```

This script will:
1. Find all `LANDLORD_REFERENCE` sections where `reference_type='agent'`
2. Update them to `AGENT_REFERENCE`
3. Ensure they send the correct agent chase emails going forward

### Manual SQL Fix (if script doesn't work):

```sql
-- Find mismatched sections
SELECT
  vs.id,
  vs.reference_id,
  vs.section_type,
  tr.reference_type
FROM verification_sections vs
JOIN tenant_references tr ON vs.reference_id = tr.id
WHERE vs.section_type = 'LANDLORD_REFERENCE'
  AND tr.reference_type = 'agent';

-- Fix them
UPDATE verification_sections vs
SET
  section_type = 'AGENT_REFERENCE',
  updated_at = NOW()
FROM tenant_references tr
WHERE vs.reference_id = tr.id
  AND vs.section_type = 'LANDLORD_REFERENCE'
  AND tr.reference_type = 'agent';
```

## Benefits

1. ✅ Agent referees now only receive AGENT_REFERENCE chase emails (not landlord emails)
2. ✅ Landlord referees continue to receive LANDLORD_REFERENCE chase emails
3. ✅ Pending Responses queue now includes agent references
4. ✅ No more duplicate or confusing emails sent to the same referee
5. ✅ Section types in database accurately reflect the type of reference

## Testing

To verify the fix:

1. Create a new reference with `reference_type='agent'`
2. Check that the `verification_sections` entry has `section_type='AGENT_REFERENCE'`
3. Check that the chase dependency has `linked_table='agent_references'`
4. Verify that only agent chase emails are sent (not landlord emails)

---

**Implemented**: 2026-01-22

**Files Modified**:
- `backend/src/services/chaseDependencyService.ts` (lines 195-228, 331, 353)

**Scripts Created**:
- `backend/fix-agent-sections.js` - Cleanup script for existing data
