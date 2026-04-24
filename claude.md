# PropertyGoose Landlord Portal

## Overview
Landlord self-management portal at `landlord.propertygoose.co.uk`. This is a **frontend-only** project — the backend is shared with the main agent app (app.propertygoose.co.uk).

## Architecture
- **Frontend**: `/frontend` (Vue 3 + Vite + TypeScript + Tailwind CSS + Pinia)
- **Backend**: Shared — hosted at `backend-production-xxx.up.railway.app`
- **Database**: Shared Supabase PostgreSQL (same as agent app)
- **Auth**: Supabase Auth (JWT-based)
- **Deployment**: Railway via Nixpacks (frontend only)

## Key Concept
The landlord IS the client. They replace the agent role from the main app. There is no staff portal, no admin panel, no branch selection. One landlord per account, with optional "My Companies" (SPVs/Ltd) for agreements.

## Running Locally

From the root directory:
```bash
npm run dev
```
This starts the frontend on port 5173. API calls proxy to the backend (configure `VITE_API_URL` in `.env`).

Or start directly:
```bash
cd frontend && npm run dev
```

**Important**: Frontend dev command exits immediately when run in background by Claude — must be started manually in a new terminal.

## Environment Variables
- `VITE_API_URL` — Backend API URL (e.g., `https://backend-production-xxx.up.railway.app`)
- `VITE_SUPABASE_URL` — Supabase project URL (same as main app)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key (same as main app)

## Pricing Model
- **Pay-as-you-go**: £14/reference (launch until 30 Apr), £17.50 standard
- **Full Self-Management**: £11.99/month (launch until 1 May), £14.99 standard — unlocks Tenancies tab, £13/ref discount
- Pricing constants in `/frontend/src/utils/pricing.ts`

## Navigation
Dashboard → Offers (free) → Referencing (paywall) → Tenancies (subscription) → Properties → Agreements → Settings → Help Centre

## What's Different from Agent App
- No `/backend` directory (shared backend)
- No staff portal, admin panel, or branch selection
- No V1 references — only V2 "Referencing"
- No RentGoose, InventoryGoose tab, Landlords tab
- Tenancies locked behind subscription paywall
- Referencing requires per-reference payment
- Settings stripped: no company, branding, team, Apex27, review links, property settings
- All emails to `landlords@propertygoose.co.uk` (not support@ or info@)

## Backend Dependencies (flagged for backend team)
1. Per-reference Stripe payment endpoint
2. Tenancies subscription Stripe product
3. Landlord companies CRUD endpoints
4. Onboarding step count (7 steps vs 5)
5. AML in authenticated context
6. CORS whitelist: `landlord.propertygoose.co.uk`

## When Making Changes
- Check if changes affect the shared backend — update both apps' CLAUDE.md
- The verify queue, referencing pipeline, and tenancy management all flow through the shared backend
- Test that public routes (referee forms, agreement signing) still work on both frontends
