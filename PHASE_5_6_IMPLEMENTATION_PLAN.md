# Phase 5-6 Implementation Plan: Direct Status Display

**Created**: 2026-01-12
**Status**: AWAITING APPROVAL
**Estimated Time**: 2-3 hours
**Risk Level**: MEDIUM (changes user-facing display)

---

## Executive Summary

**Goal**: Replace complex derived status calculations with direct `verification_state` display.

**Current System** (Complex):
```
Database (verification_state)
  → Backend derives PersonStatus from sections + dependencies
  → Backend derives TenancyStatus from PersonStatus
  → Frontend displays derived statuses
```

**New System** (Simple):
```
Database (verification_state)
  → Backend returns verification_state directly
  → Frontend maps verification_state to display labels
```

**Impact**:
- **Backend**: Remove 960-line `tenancyStatusService.ts` or simplify dramatically
- **Frontend**: Update `References.vue` to use `verification_state`
- **User-facing**: Status labels may change slightly (simpler, clearer)

---

## Current Status System (What We're Removing)

### Person Statuses (Derived - Complex)
```typescript
type PersonStatus =
  | 'NOT_STARTED'           // No form activity
  | 'IN_PROGRESS'           // Form started OR refs sent OR deps outstanding
  | 'AWAITING_VERIFICATION' // All data returned, awaiting staff
  | 'ACTION_REQUIRED'       // Staff failed sections
  | 'VERIFIED_PASS'
  | 'VERIFIED_CONDITIONAL'
  | 'VERIFIED_FAIL'
  | 'ARCHIVED'
```

**Derivation Logic** (`derivePersonStatus()` - lines 106-194):
1. Check terminal statuses (completed, rejected, cancelled)
2. Check verification sections for ACTION_REQUIRED
3. Check if in pending_verification
4. Check outstanding chase dependencies
5. Check if form submitted
6. Default to NOT_STARTED

**Problem**: This is calculated on EVERY API call, requires 3+ database queries per person, 800+ lines of code.

### Tenancy Statuses (Derived from Person Statuses)
```typescript
type TenancyStatus =
  | 'SENT'                  // Nobody started
  | 'IN_PROGRESS'           // Any deps exist
  | 'AWAITING_VERIFICATION' // All data returned
  | 'ACTION_REQUIRED'       // Any person needs action
  | 'COMPLETED'
  | 'REJECTED'
```

**Problem**: Aggregate calculation across all people in tenancy.

---

## New Simple System (What We're Adding)

### Use verification_state Directly
```typescript
// Already in database (no calculation needed!)
type VerificationState =
  | 'COLLECTING_EVIDENCE'    // Tenant uploading evidence
  | 'WAITING_ON_REFERENCES'  // Waiting for employer/landlord
  | 'READY_FOR_REVIEW'       // In verify queue
  | 'IN_VERIFICATION'        // Staff reviewing
  | 'ACTION_REQUIRED'        // Staff requested more
  | 'COMPLETED'              // Passed
  | 'REJECTED'               // Failed
  | 'CANCELLED'              // Cancelled
```

**Benefits**:
- ✅ Single database field - no calculation
- ✅ Always accurate (updated by state machine)
- ✅ No complex batch queries
- ✅ 800 lines of code removed

---

## Implementation Plan

### Phase 5: Backend Changes

#### 5.1 Update `/api/tenancies` Endpoint
**File**: `backend/src/routes/tenancies.ts`
**Lines**: 250-312 (and similar sections)

**Current Code**:
```typescript
const person = buildTenancyPersonSync(child, sectionsMap, dependenciesMap, reasonCodeLabels)
// ... complex derivation
const tenancyStatus = deriveTenancyStatus(people)
```

**New Code**:
```typescript
const person = {
  id: child.id,
  role: child.is_guarantor ? 'GUARANTOR' : 'TENANT',
  name: decrypt(child.tenant_first_name_encrypted),
  email: decrypt(child.tenant_email_encrypted),
  verificationState: child.verification_state,  // Direct field!
  // ... other simple fields
}

// Simple tenancy status = worst state of all people
const tenancyStatus = worstVerificationState(people.map(p => p.verificationState))
```

**Changes Required**:
1. Remove call to `buildTenancyPersonSync()`
2. Remove call to `deriveTenancyStatus()`
3. Return `verification_state` directly on each person
4. Calculate tenancy status as "worst state" of all people

**Risk**: MEDIUM - changes API response shape

#### 5.2 Simplify tenancyStatusService.ts
**File**: `backend/src/services/tenancyStatusService.ts`
**Lines**: 960 total

**Option A - Aggressive** (Recommended):
- Delete `derivePersonStatus()` (lines 106-194)
- Delete `deriveTenancyStatus()` (lines 196-236)
- Delete all batch derivation functions (lines 700-900)
- Keep only:
  - Type definitions (for API responses)
  - Simple helper functions (blocking sentence, progress summary)
- **Savings**: ~700 lines removed

**Option B - Conservative**:
- Keep existing functions but mark as `@deprecated`
- Add new simple functions alongside
- Gradual migration
- **Savings**: 0 lines initially, migrate over time

**Recommendation**: Option A - clean break, simpler codebase

#### 5.3 Update API Response Type
**File**: `backend/src/services/tenancyStatusService.ts`

**Current**:
```typescript
export interface TenancyPerson {
  status: PersonStatus  // Derived (NOT_STARTED, IN_PROGRESS, etc.)
  // ... other fields
}
```

**New**:
```typescript
export interface TenancyPerson {
  verificationState: VerificationState  // Direct from DB!
  // ... other fields
}
```

---

### Phase 6: Frontend Changes

#### 6.1 Update References.vue
**File**: `frontend/src/views/References.vue`
**Lines**: 1407 total

**Current Code** (shows derived `person.status`):
```vue
<template>
  <StatusBadge :status="person.status" />  <!-- NOT_STARTED, IN_PROGRESS, etc. -->
</template>
```

**New Code** (shows `person.verificationState`):
```vue
<template>
  <VerificationStateBadge :state="person.verificationState" />  <!-- COLLECTING_EVIDENCE, etc. -->
</template>
```

**Changes Required**:
1. Update status badge components to accept `verificationState` prop
2. Change status color logic to use verification state
3. Update filters (if any) to filter by verification state
4. Update any conditional rendering based on status

**Lines Changed**: ~20-30 lines (status display logic)

#### 6.2 Create Status Label Mapping
**File**: `frontend/src/utils/statusLabels.ts` (NEW FILE)

```typescript
export function getVerificationStateDisplayLabel(state: VerificationState): string {
  const labels: Record<VerificationState, string> = {
    COLLECTING_EVIDENCE: 'In Progress',
    WAITING_ON_REFERENCES: 'Awaiting References',
    READY_FOR_REVIEW: 'Ready for Verification',
    IN_VERIFICATION: 'Being Verified',
    ACTION_REQUIRED: 'Action Required',
    COMPLETED: 'Verified',
    REJECTED: 'Failed Verification',
    CANCELLED: 'Cancelled'
  }
  return labels[state] || state
}

export function getVerificationStateColor(state: VerificationState): string {
  const colors: Record<VerificationState, string> = {
    COLLECTING_EVIDENCE: 'blue',
    WAITING_ON_REFERENCES: 'yellow',
    READY_FOR_REVIEW: 'purple',
    IN_VERIFICATION: 'purple',
    ACTION_REQUIRED: 'orange',
    COMPLETED: 'green',
    REJECTED: 'red',
    CANCELLED: 'gray'
  }
  return colors[state] || 'gray'
}
```

**User-Facing Changes**:
| Old Status | New Label | Notes |
|------------|-----------|-------|
| NOT_STARTED | In Progress | Slight change |
| IN_PROGRESS | In Progress / Awaiting References | More specific |
| AWAITING_VERIFICATION | Ready for Verification | Clearer |
| VERIFIED_PASS | Verified | Simpler |
| VERIFIED_CONDITIONAL | Verified | Same |
| VERIFIED_FAIL | Failed Verification | Clearer |

#### 6.3 Update StatusBadge Component
**File**: `frontend/src/components/StatusBadge.vue` (if exists)

Update to handle `VerificationState` instead of `PersonStatus`.

---

## File Modification Summary

### Backend Files to Modify:
1. ✏️ **`backend/src/routes/tenancies.ts`** - Update API endpoint (30-50 lines changed)
2. ✂️ **`backend/src/services/tenancyStatusService.ts`** - Remove derivation logic (700 lines deleted)
3. ➕ **`backend/src/utils/statusHelpers.ts`** - Add simple helper functions (NEW, 50 lines)

### Frontend Files to Modify:
1. ✏️ **`frontend/src/views/References.vue`** - Update status display (20-30 lines changed)
2. ➕ **`frontend/src/utils/statusLabels.ts`** - Status mapping functions (NEW, 50 lines)
3. ✏️ **`frontend/src/components/StatusBadge.vue`** - Update props (10-15 lines changed)

### TypeScript Type Files:
1. ✏️ **`backend/src/services/tenancyStatusService.ts`** - Update TenancyPerson interface
2. ✏️ **`frontend/src/types/references.ts`** - Update type definitions (if exists)

**Total Changes**:
- Lines modified: ~100-150
- Lines deleted: ~700
- Lines added: ~100
- **Net result**: ~500-600 fewer lines of code

---

## Migration Strategy

### Step 1: Backend First (Can deploy separately)
1. Update `/api/tenancies` to return both `status` AND `verificationState`
2. Frontend continues using `status` (no change yet)
3. Deploy and test - should be no user-facing change

### Step 2: Frontend Migration
1. Update References.vue to use `verificationState`
2. Remove old status display logic
3. Deploy and test - user sees new labels

### Step 3: Backend Cleanup
1. Remove old `status` field from API response
2. Delete derivation functions from tenancyStatusService
3. Deploy - ~700 lines removed

**Total Time**: 2-3 hours for all steps

---

## Risks & Mitigations

### Risk 1: Status Labels Change (User-Facing)
**Impact**: Users see slightly different status text
**Severity**: LOW - labels are clearer and more accurate
**Mitigation**:
- Keep labels similar to old ones where possible
- Document changes in release notes

### Risk 2: Breaking Frontend Components
**Impact**: Status badges might not display correctly
**Severity**: MEDIUM - visual issue, not functional
**Mitigation**:
- Test thoroughly before deploying
- Keep old `status` field temporarily during migration

### Risk 3: API Response Shape Changes
**Impact**: Frontend expects different fields
**Severity**: MEDIUM - could break UI
**Mitigation**:
- Migration strategy: add new field before removing old
- Deploy backend first, verify no errors

### Risk 4: Missing Edge Cases
**Impact**: Some statuses might not map correctly
**Severity**: LOW - all states are well-defined
**Mitigation**:
- Comprehensive testing with all verification states
- Fallback to showing raw state if mapping fails

---

## Testing Plan

### Backend Testing:
1. ✅ Call `/api/tenancies` - verify `verificationState` field present
2. ✅ Check each verification state returns correctly
3. ✅ Verify no errors in logs
4. ✅ Performance test - should be FASTER (no derivation)

### Frontend Testing:
1. ✅ Load References page - verify statuses display
2. ✅ Check status badge colors are correct
3. ✅ Test filtering by status (if applicable)
4. ✅ Verify action required items show correctly
5. ✅ Test all verification states (use test data if needed)

### Integration Testing:
1. ✅ Upload evidence → verify status updates in UI
2. ✅ External reference received → verify status changes
3. ✅ Staff finalizes verification → verify COMPLETED shows
4. ✅ Check person drawer opens correctly

---

## Rollback Plan

If issues arise:

### Backend Rollback:
1. Revert `tenancies.ts` changes
2. Re-enable `derivePersonStatus()` calls
3. Backend returns old `status` field
4. **Time**: 5 minutes (git revert + deploy)

### Frontend Rollback:
1. Revert References.vue changes
2. Display old `status` field instead of `verificationState`
3. **Time**: 5 minutes (git revert + deploy)

**Critical**: Keep old derivation functions during Phase 5-6.1 (don't delete until Step 3).

---

## Success Criteria

✅ **Backend**:
- `/api/tenancies` returns `verificationState` for each person
- No status derivation calculations in API calls
- Response time improved (no complex queries)
- All tests pass

✅ **Frontend**:
- References page displays verification states correctly
- Status badges show appropriate colors
- Action required items clearly marked
- No console errors

✅ **Performance**:
- API response faster (estimate: 30-50% improvement)
- Fewer database queries
- Lower server CPU usage

✅ **Maintainability**:
- 700 fewer lines of complex derivation code
- Single source of truth (verification_state field)
- Easier to understand status flow

---

## Post-Implementation Cleanup

After Phase 5-6 is stable (1 week monitoring):

1. **Delete deprecated functions** from tenancyStatusService.ts
2. **Remove PersonStatus type** (replaced by VerificationState)
3. **Remove TenancyStatus derivation** (use simple worst-state logic)
4. **Delete batch query functions** (no longer needed)
5. **Update documentation** to reflect new system

**Final Savings**: ~700 lines removed, 50% less complexity

---

## Questions to Resolve Before Implementation

1. **Status Label Preferences**: Are the proposed labels acceptable?
   - "In Progress" vs "NOT_STARTED"
   - "Awaiting References" vs "IN_PROGRESS"
   - "Ready for Verification" vs "AWAITING_VERIFICATION"

2. **Migration Timing**: Deploy all at once or phased?
   - **Option A**: Backend + Frontend together (recommended)
   - **Option B**: Backend first, wait 1 day, then Frontend

3. **Old Field Retention**: Keep old `status` field during transition?
   - **Option A**: Yes, for safety (1-2 weeks)
   - **Option B**: No, clean break

4. **Tenancy Status**: How should tenancy-level status be calculated?
   - **Option A**: Worst state of all people (COMPLETED only if ALL completed)
   - **Option B**: Custom rules (e.g., AWAITING_VERIFICATION if any person ready)

---

## Approval Checklist

Before proceeding, confirm:

- [ ] Proposed status labels are acceptable
- [ ] Migration strategy approved (backend → frontend → cleanup)
- [ ] Risk level (MEDIUM) is acceptable
- [ ] Testing plan is sufficient
- [ ] Rollback plan is clear
- [ ] Ready to proceed with implementation

---

**Next Steps After Approval**:
1. Implement Phase 5 (backend changes) - 1 hour
2. Test backend changes - 30 mins
3. Implement Phase 6 (frontend changes) - 1 hour
4. Test full integration - 30 mins
5. Deploy and monitor

**Total Implementation Time**: 2-3 hours

---

**Status**: 🟡 AWAITING YOUR APPROVAL TO PROCEED
