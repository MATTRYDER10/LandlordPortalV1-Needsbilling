# Duplicate Email Sends Fix

## Problem Identified

Users were receiving duplicate tenancy agreement signature emails:
- Same recipient getting 2 identical emails within seconds
- Happened for signature reminders and resend operations
- Likely caused by double-clicks or rapid frontend re-renders making duplicate API calls

Example:
```
anjudaniel2011@gmail.com - Reminder: Your Tenancy Agreement... (7 min ago)
anjudaniel2011@gmail.com - Reminder: Your Tenancy Agreement... (7 min ago)
danielvarghese1445@gmail.com - Reminder: Your Tenancy Agreement... (9 min ago)
danielvarghese1445@gmail.com - Reminder: Your Tenancy Agreement... (9 min ago)
```

## Root Cause

The agreement signing endpoints had no protection against duplicate requests within a short time window:

1. **Initiate Signing** - Had database-level protection (checks `signing_status='draft'`) but could still have race conditions
2. **Send Reminder** - NO protection against being called multiple times
3. **Resend All Emails** - NO protection against being called multiple times

If the frontend made duplicate API calls (double-click, React re-render, network retry), the backend would send duplicate emails.

## Solution Implemented

Added **request deduplication** with a 5-second cooldown period to prevent duplicate email sends.

### Changes to [backend/src/routes/agreementSigning.ts](../src/routes/agreementSigning.ts)

#### 1. Added Deduplication Helper (Lines 9-31)

```typescript
// In-memory deduplication for email sends (prevents double-click duplicate sends)
const recentEmailSends = new Map<string, number>()
const EMAIL_SEND_COOLDOWN_MS = 5000 // 5 seconds

function isDuplicateEmailSend(key: string): boolean {
  const now = Date.now()
  const lastSend = recentEmailSends.get(key)

  if (lastSend && now - lastSend < EMAIL_SEND_COOLDOWN_MS) {
    return true // Duplicate within cooldown period
  }

  recentEmailSends.set(key, now)

  // Cleanup old entries (older than cooldown period)
  for (const [k, timestamp] of recentEmailSends.entries()) {
    if (now - timestamp > EMAIL_SEND_COOLDOWN_MS) {
      recentEmailSends.delete(k)
    }
  }

  return false
}
```

#### 2. Protected Initiate Signing Endpoint

Added deduplication check before initiating signing:

```typescript
// Check for duplicate send (prevents race condition if called twice simultaneously)
const dedupeKey = `initiate-${id}-${userId}`
if (isDuplicateEmailSend(dedupeKey)) {
  return res.status(429).json({
    error: 'Signing is already being initiated, please wait'
  })
}

await signatureService.initiateSigning(id)
```

#### 3. Protected Send Reminder Endpoint

Added deduplication check before sending reminder:

```typescript
// Check for duplicate send (prevents double-click duplicate emails)
const dedupeKey = `reminder-${signatureId}-${userId}`
if (isDuplicateEmailSend(dedupeKey)) {
  return res.status(429).json({
    error: 'Please wait a few seconds before sending another reminder'
  })
}

await signatureService.sendReminderEmail(signatureId)
```

#### 4. Protected Resend All Emails Endpoint

Added deduplication check before resending to all signers:

```typescript
// Check for duplicate send (prevents double-click duplicate emails)
const dedupeKey = `resend-all-${id}-${userId}`
if (isDuplicateEmailSend(dedupeKey)) {
  return res.status(429).json({
    error: 'Please wait a few seconds before resending emails'
  })
}

await signatureService.sendAllSigningEmails(id)
```

## How It Works

1. Each endpoint creates a unique deduplication key combining the operation type, agreement/signature ID, and user ID
2. When an email send request comes in, check if the same key was used within the last 5 seconds
3. If yes, reject with HTTP 429 (Too Many Requests)
4. If no, allow the request and record the timestamp
5. Old entries are automatically cleaned up to prevent memory leaks

## Benefits

- ✅ Prevents duplicate emails from double-clicks
- ✅ Prevents race conditions from simultaneous API calls
- ✅ Lightweight in-memory solution (no database calls)
- ✅ Automatic cleanup prevents memory leaks
- ✅ Per-user deduplication (won't block different users)
- ✅ 5-second cooldown is short enough to not impact legitimate retries

## Testing

To verify the fix:

1. Try double-clicking "Send Reminder" or "Resend Emails" buttons rapidly
2. Check that only ONE email is sent per recipient
3. Verify that after 5 seconds, the button works again normally

## Alternative Solutions Considered

1. **Frontend debouncing** - Could be bypassed by network issues or browser issues
2. **Database-level locking** - Too heavy for this use case, adds latency
3. **Redis-based deduplication** - Overkill for this issue, requires Redis infrastructure

The in-memory solution is appropriate because:
- Email sending is synchronous (happens immediately)
- 5-second window is sufficient for catching duplicates
- No cross-server coordination needed (each server instance tracks its own requests)

---

**Implemented**: 2026-01-22

**Files Modified**:
- `backend/src/routes/agreementSigning.ts` (lines 9-31, 291-306, 393-405, 494-506)
