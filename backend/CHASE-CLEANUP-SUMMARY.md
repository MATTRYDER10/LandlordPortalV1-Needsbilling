# Chase Dependencies Cleanup - Summary

## Problem Identified

Chase dependencies were remaining in `CHASING` status even after references were completed/verified. This meant:
- Auto-chase emails/SMS would continue being sent (until the auto-chase service checked terminal states)
- The "Pending Responses" queue showed inflated numbers
- Staff couldn't easily see which chases were truly pending

## Root Cause

When a reference was marked as COMPLETED or REJECTED, the chase_dependencies table was not being updated. The auto-chase service would skip these (lines 142-145 in autoChaseService.ts), but the database still showed them as `CHASING`.

## Solution Implemented

Added automatic chase dependency cleanup when references are completed:

### 1. Verification Complete Endpoint (`/api/verification/:referenceId/complete`)
**File**: `backend/src/routes/verification.ts` (lines 145-160)

When a reference verification is completed with `passed: true`, all remaining chase dependencies (status `PENDING` or `CHASING`) are automatically marked as `RECEIVED`.

```typescript
// Mark any remaining chase dependencies as RECEIVED (reference is now complete)
if (passed) {
  const { error: chaseError } = await supabase
    .from('chase_dependencies')
    .update({
      status: 'RECEIVED',
      updated_at: new Date().toISOString()
    })
    .eq('reference_id', referenceId)
    .in('status', ['PENDING', 'CHASING'])
}
```

### 2. Staff Verify Endpoint (`/api/staff/references/:id/verify`)
**File**: `backend/src/routes/staff.ts` (lines 788-803)

Same logic applied to the legacy verify endpoint (still used by StaffReferenceDetail.vue).

### 3. Reject Endpoint
**File**: `backend/src/routes/staff.ts`

No chase cleanup added for rejected references - they remain in `CHASING` status since the reference might be corrected and resubmitted.

## Database Constraints

The `chase_dependencies` table has a check constraint that only allows these statuses:
- `PENDING` - Initial state
- `CHASING` - Chase emails/SMS have been sent
- `RECEIVED` - The form/reference was submitted
- `EXHAUSTED` - All chase attempts exhausted
- `ACTION_REQUIRED` - Manual intervention needed

There is no `CANCELLED` status, so we use `RECEIVED` to indicate "we got what we needed" (the reference is complete).

## Cleanup Script

Created `cleanup-completed-chases.js` to retroactively clean up existing chase dependencies for already-completed references.

**Results**:
- Found 36 dependencies in PENDING/CHASING status
- Marked 20 as RECEIVED (for completed references)
- 16 remain in CHASING (legitimately pending)
- 8 currently in CHASING status (after recent activity)

## Benefits

1. ✅ Auto-chase emails/SMS stop immediately when reference is verified
2. ✅ "Pending Responses" queue shows accurate numbers
3. ✅ Staff can focus on truly pending chases
4. ✅ Database state reflects actual business state
5. ✅ No manual cleanup needed going forward

## Testing

To verify chase dependencies are cleaned up:
```bash
# Check pending responses
node check-pending-responses.js

# Check all statuses
node check-all-statuses.js

# Run cleanup for existing data
node cleanup-completed-chases.js
```

## Future Considerations

- Consider adding `CANCELLED` status to the database schema for rejected references
- Consider adding chase dependency status to the verification UI
- Consider showing chase history in reference detail view

---

**Implemented**: 2026-01-22
**Files Modified**:
- `backend/src/routes/verification.ts`
- `backend/src/routes/staff.ts`
**Scripts Created**:
- `backend/cleanup-completed-chases.js`
