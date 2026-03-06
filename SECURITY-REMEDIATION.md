# PropertyGoose Security Remediation Plan

Based on authorized pentest conducted 2026-03-06.

---

## Code Fixes (we can implement)

### F1: Source Maps in Production [CRITICAL]
- **File:** `frontend/vite.config.ts`
- **Change:** Add `build: { sourcemap: false }` to explicitly disable source maps in production builds
- **Risk:** None -- one-line config change
- **Status:** [ ] Pending

### F2: Recursive RLS Policies [CRITICAL]
- **File:** New migration `backend/migrations/XXX_fix_recursive_rls_policies.sql`
- **Change:** Create a `SECURITY DEFINER` function `auth.user_company_ids()` that checks `company_users` membership without triggering RLS. Rewrite policies on `agreements`, `staff_users`, `company_users`, `invitations`, `companies`, `tenant_changes` to use this function instead of directly querying `company_users`
- **Risk:** Medium -- must test thoroughly; incorrect policies could lock out real users
- **Status:** [ ] Pending

### F5: Frontend Security Headers [MEDIUM]
- **File:** `frontend/vite.config.ts`
- **Change:** Add `preview.headers` with CSP, X-Frame-Options (DENY), HSTS, X-Content-Type-Options (nosniff), Referrer-Policy. CSP must allow Stripe JS, Supabase, and the backend API origin
- **Risk:** Low -- CSP misconfiguration could break external integrations; needs testing
- **Status:** [ ] Pending

### F6: Invitation Accept Error Leak [MEDIUM]
- **File:** `backend/src/routes/invitations.ts` (~line 372)
- **Change:** Add body validation before destructuring. Return generic `{ "error": "Invalid request" }` instead of leaking JS error details
- **Risk:** None
- **Status:** [ ] Pending

### F7/F10: Rate Limiting on Public Endpoints [MEDIUM]
- **Files:** `backend/src/routes/references.ts`, `backend/src/routes/tenant-offers.ts`
- **Change:** Install `express-rate-limit`, apply to public endpoints (reference branding/submit, confirm-payment). Also stop auto-resending reference links on expired token probe -- return "This link has expired" without triggering an email
- **Risk:** Low -- additive change, doesn't affect business logic
- **Status:** [ ] Pending

### F9: Verbose Auth Error Messages [LOW]
- **File:** `backend/src/middleware/auth.ts` (lines 141, 342)
- **Change:** Replace `"No token provided"` with `"Unauthorized"` in both locations
- **Risk:** None
- **Status:** [ ] Pending

### F11: confirm-payment Unauthenticated [INFO]
- **File:** `backend/src/routes/tenant-offers.ts` (~line 827)
- **Change:** Replace bare `offer_id` with a signed/hashed token (similar to how `tenant-change.ts` already does it). Or at minimum, add rate limiting
- **Risk:** Medium -- changes the payment confirmation flow; needs testing against real tenant journey
- **Status:** [ ] Pending

---

## Manual Actions (Supabase Dashboard / Infrastructure)

### F3: Table Enumeration via PostgREST Hints [HIGH]
- **Where:** Supabase Dashboard
- **Action:** Consider moving tables to a dedicated schema or accept as informational. Low practical risk once RLS is fixed
- **Status:** [ ] Pending

### F4: Disable Public Signup [HIGH] -- DO THIS FIRST
- **Where:** Supabase Dashboard > Authentication > Settings > Disable Sign Up = ON
- **Action:** Toggle off public signup. User creation already happens server-side via `admin.createUser()` in the invitation flow. This is a 30-second change that closes a major attack vector
- **Status:** [ ] Pending

### F8: Backend URL Exposed [LOW]
- **Where:** Infrastructure / DNS
- **Action:** Optional -- set up `api.propertygoose.co.uk` pointing to Railway backend. Low priority; URL is discoverable via network tab regardless
- **Status:** [ ] Pending

---

## Already Solid (no action needed)

- Backend API authentication -- all protected endpoints correctly reject unauthenticated requests
- CORS -- properly configured, rejects non-whitelisted origins
- Backend security headers -- comprehensive (CSP, HSTS, X-Frame-Options via Helmet)
- JWT validation -- correctly rejects malformed/fake tokens
- SQL injection protection -- route-level validation on public endpoints
- Password reset -- no email enumeration (returns 200 for all)
- Supabase Storage -- no public buckets exposed
- Stripe publishable key (F7) -- public by design, no fix needed
