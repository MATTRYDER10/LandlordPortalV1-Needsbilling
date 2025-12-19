# VAPI Voice Call Integration

## Overview
VAPI AI voice calls are integrated into the chase queue as the 3rd step after email and SMS. A dedicated testing page allows staff to verify calls before going live.

## Current Status: Testing Phase
- Test page functional at `/staff/vapi-test`
- Calls working with real references
- Webhook not yet configured (manual fetch from VAPI required)

---

## Configuration

### Environment Variables (backend/.env)
```
VAPI_API_KEY="f1ef21fc-64d0-44b5-b53e-72726649ac18"
VAPI_PHONE_NUMBER_ID="e9be73d2-f387-45fe-8f05-45016a74bbf6"
VAPI_ASSISTANT_TENANT="7b245988-f7e9-403a-8127-bd1dca5b70d1"
VAPI_ASSISTANT_GUARANTOR="3d4280f8-94ae-42e7-8cc9-1c215e6b739f"
VAPI_ASSISTANT_EMPLOYER="1872dd1f-0258-4049-b59f-3b71b0a3ec39"
VAPI_ASSISTANT_LANDLORD=""      # TODO: Create and add
VAPI_ASSISTANT_ACCOUNTANT=""    # TODO: Create and add
ENABLE_CALLS_DEV="true"         # Enables calls in development mode
```

### VAPI Assistant Variables
The following variables are passed to VAPI assistants (use with LiquidJS syntax `{{variableName}}`):
- `{{contactName}}` - Person being called
- `{{tenantName}}` - Tenant's full name
- `{{dependencyType}}` - "tenant reference application", "employment reference", etc.
- `{{propertyAddress}}` - Full property address
- `{{companyName}}` - Letting agent's company name

---

## Database

### Migration: `122_add_vapi_call_tracking.sql`
- Added `call_attempts` column to `chase_dependencies`
- Created `call_delivery_logs` table for tracking calls

---

## Files Modified/Created

### Backend
| File | Description |
|------|-------------|
| `src/services/vapiService.ts` | Core VAPI integration - initiateCall, updateCallStatus, etc. |
| `src/routes/vapi.ts` | Staff API routes for testing and call management |
| `src/routes/webhooks.ts` | VAPI webhook handler (needs webhook URL configured in VAPI) |
| `src/services/chaseDependencyService.ts` | Updated to support 'call' method in chase cycle |
| `src/services/autoChaseService.ts` | Updated to include calls as 3rd step in auto-chase |
| `src/routes/chase.ts` | Updated to accept 'call' as valid method |

### Frontend
| File | Description |
|------|-------------|
| `src/views/StaffVapiTest.vue` | Testing page at /staff/vapi-test |
| `src/router/index.ts` | Added /staff/vapi-test route |

---

## Chase Cycle Logic
Order per cycle: **Email → SMS → VAPI Call → (8 hour wait)**

- Cycle completes when all 3 methods sent
- Calls have stricter hours: 9 AM - 7 PM GMT, weekdays only
- After 3 cycles: auto-escalate to ACTION_REQUIRED

---

## Phone Number Normalization
The `normalizePhoneNumber()` function in `vapi.ts` handles:
- UK numbers: `07356030292` → `+447356030292`
- Missing +: `447356030292` → `+447356030292`
- Double country code: `+44447356030292` → `+447356030292`
- Extra 0: `+4407356030292` → `+447356030292`

---

## API Endpoints

### Staff Testing Routes (`/api/vapi/`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Check VAPI configuration status |
| POST | `/test-call` | Make a test call with custom data |
| GET | `/references` | Get all references with callable contacts |
| GET | `/calls` | Get call logs with pagination |
| GET | `/calls/:callId` | Get single call from local DB |
| GET | `/calls/:callId/fetch` | Fetch call details from VAPI API |

---

## TODO: Before Going Live

1. **Configure VAPI Webhook**
   - In VAPI Dashboard, set webhook URL to: `https://your-production-url/api/webhooks/vapi`
   - This enables automatic call status updates and transcript/summary storage

2. **Create Missing Assistants**
   - Landlord assistant (add ID to `VAPI_ASSISTANT_LANDLORD`)
   - Accountant assistant (add ID to `VAPI_ASSISTANT_ACCOUNTANT`)

3. **Test All Dependency Types**
   - Tenant form calls
   - Employer reference calls
   - Landlord reference calls
   - Guarantor form calls
   - Accountant reference calls

4. **Production Environment**
   - Add all VAPI env vars to production
   - Remove `ENABLE_CALLS_DEV` or set to false
   - Verify webhook endpoint is accessible

---

## Testing Checklist
- [x] Manual test call works
- [x] Reference-based test call works
- [x] Phone number normalization handles UK formats
- [x] Call logs display correctly
- [x] Fetch from VAPI API works
- [ ] Webhook receives call updates
- [ ] Auto-chase includes calls
- [ ] All assistant types configured
