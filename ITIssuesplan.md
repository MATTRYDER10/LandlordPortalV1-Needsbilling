# IT Issues / Support Button - Implementation Plan

> **READ THIS FULLY BEFORE STARTING. DO NOT deviate from this plan.**
> This adds a floating "Report Issue" button across the app that lets users submit bug reports / support requests. Submissions create a GitHub Issue on this repo and send confirmation emails.

---

## Overview

- A persistent floating button (bottom-right corner) visible on all authenticated pages
- Opens a modal form with: page context, issue details, screenshot uploads, and optional entity search (reference, property, landlord, tenancy)
- Submits to a new backend endpoint that:
  1. Creates a GitHub Issue via the GitHub API on `CR88/PropertyGooseApp`
  2. Sends a confirmation email to the reporting user
  3. Sends a CC copy of the issue to `info@propertygoose.co.uk`

---

## Step 1: Backend - GitHub Issues API Route

### File: `/backend/src/routes/support.ts` (NEW)

Create a new route file for support/issue reporting.

```
POST /api/support/report
```

**Auth:** Requires authenticated user (use existing `auth` middleware from `/backend/src/middleware/auth.ts`).

**Request body (multipart/form-data):**
```typescript
{
  page: string            // The page/route the user was on when reporting
  title: string           // Short summary of the issue
  description: string     // Detailed description
  severity: 'low' | 'medium' | 'high'  // How urgent
  entityType?: 'reference' | 'property' | 'landlord' | 'tenancy' | null
  entityId?: string       // The UUID/ID of the linked entity
  entityLabel?: string    // Human-readable label (e.g. "John Smith - Ref #1234")
  screenshots?: File[]    // Up to 3 image files (max 5MB each)
}
```

**Implementation steps:**

1. **Validate** the request body. Title and description are required. Screenshots are optional.

2. **Upload screenshots to GitHub** (if any):
   - Use the GitHub API to upload each image as a base64-encoded file to the repo (or use GitHub's markdown image attachment approach)
   - Simpler alternative: Convert screenshots to base64 data URIs and embed them inline in the issue body as markdown images. GitHub Issues support image pasting via the API — use `![screenshot](data:image/png;base64,...)` or better yet, upload to an S3 bucket (the app already uses S3 for file storage) and embed the public URL in the issue body.
   - **Recommended approach:** Upload to S3 using the existing S3 service pattern in the app, generate a signed/public URL, and embed in the GitHub issue body as `![Screenshot](https://s3-url)`.

3. **Build the GitHub Issue body** in markdown:
   ```markdown
   ## Bug Report

   **Reported by:** {user.email}
   **Company:** {company.name}
   **Page:** {page}
   **Severity:** {severity}
   **Entity:** {entityType} - {entityLabel} (ID: {entityId})
   **Date:** {ISO timestamp}

   ---

   ### Description
   {description}

   ### Screenshots
   ![Screenshot 1](url)
   ![Screenshot 2](url)
   ```

4. **Create the GitHub Issue** using the GitHub REST API:
   ```typescript
   // Use node-fetch or the built-in fetch
   const response = await fetch('https://api.github.com/repos/CR88/PropertyGooseApp/issues', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${process.env.GITHUB_ISSUES_TOKEN}`,
       'Accept': 'application/vnd.github+json',
       'X-GitHub-Api-Version': '2022-11-28'
     },
     body: JSON.stringify({
       title: `[Support] ${title}`,
       body: markdownBody,
       labels: ['bug', `severity:${severity}`],
     })
   })
   ```

5. **Send confirmation email to user** using the existing `emailService` pattern:
   - Use the template `support-issue-confirmation.html` (create in step 2)
   - Send to `req.user.email`
   - Include: issue title, description, GitHub issue link, entity reference if provided

6. **Send CC email to info@propertygoose.co.uk**:
   - Use template `support-issue-notification.html` (create in step 2)
   - Include all details: who reported, from which page, description, screenshots, entity link, GitHub issue URL

7. **Return** the created GitHub issue URL and issue number to the frontend.

**Response:**
```typescript
{
  success: true,
  issueNumber: 42,
  issueUrl: 'https://github.com/CR88/PropertyGooseApp/issues/42'
}
```

### Environment Variable Needed

Add to `.env`:
```
GITHUB_ISSUES_TOKEN=ghp_xxxxxxxxxxxx
```

This must be a GitHub Personal Access Token (classic) with `repo` scope, generated from the CR88 account or an account with write access to CR88/PropertyGooseApp. Create one at https://github.com/settings/tokens.

### Register the route

In the main Express app file (wherever routes are registered — check `/backend/src/index.ts` or similar), add:
```typescript
import supportRoutes from './routes/support'
app.use('/api/support', supportRoutes)
```

Use `multer` middleware on the route for handling file uploads (multer is likely already a dependency — check `package.json`; if not, install it).

---

## Step 2: Backend - Email Templates

### File: `/backend/email-templates/support-issue-confirmation.html` (NEW)

Template for the user who reported the issue. Follow the existing template pattern with `{{ VariableName }}` syntax.

**Variables:**
- `{{ UserName }}` - The reporting user's name
- `{{ IssueTitle }}` - The issue title
- `{{ IssueDescription }}` - The issue description (truncated to ~500 chars)
- `{{ IssueSeverity }}` - low/medium/high
- `{{ IssueNumber }}` - GitHub issue number
- `{{ IssueUrl }}` - GitHub issue URL
- `{{ PageReported }}` - Which page the issue was on
- `{{ EntityInfo }}` - Optional entity reference string (e.g. "Property: 10 High Street")

**Content should say:**
- "Your support request has been received"
- Show a summary of what they reported
- Provide the GitHub issue link so they can track it
- "Our team will review this shortly"

### File: `/backend/email-templates/support-issue-notification.html` (NEW)

Template for the CC to info@propertygoose.co.uk. Same variables plus:
- `{{ ReporterEmail }}` - Who submitted it
- `{{ CompanyName }}` - Their company
- Include screenshot URLs if any

---

## Step 3: Frontend - Entity Search Composable

### File: `/frontend/src/composables/useEntitySearch.ts` (NEW)

Create a composable that provides unified search across entity types. This reuses the existing API search endpoints.

```typescript
import { ref } from 'vue'
import { useApi } from '@/composables/useApi'

interface SearchResult {
  id: string
  type: 'reference' | 'property' | 'landlord' | 'tenancy'
  label: string        // Display text
  sublabel?: string    // Secondary info (e.g. address, tenant name)
}

export function useEntitySearch() {
  const { apiFetch } = useApi()
  const results = ref<SearchResult[]>([])
  const loading = ref(false)

  async function search(query: string, type: 'reference' | 'property' | 'landlord' | 'tenancy') {
    if (!query || query.length < 2) {
      results.value = []
      return
    }
    loading.value = true
    try {
      let endpoint = ''
      switch (type) {
        case 'property':
          endpoint = `/api/properties/search?q=${encodeURIComponent(query)}&limit=10`
          break
        case 'landlord':
          endpoint = `/api/landlords?search=${encodeURIComponent(query)}&limit=10`
          break
        case 'tenancy':
          endpoint = `/api/tenancies?search=${encodeURIComponent(query)}&limit=10`
          break
        case 'reference':
          endpoint = `/api/references?search=${encodeURIComponent(query)}&limit=10`
          break
      }
      const data = await apiFetch(endpoint)
      // Map response to SearchResult format
      // NOTE: Check actual API response shapes — each endpoint may return differently.
      // Properties likely return { id, address_line_1, postcode }
      // Landlords likely return { id, name, email }
      // Tenancies likely return { id, property, tenant_name }
      // References likely return { id, tenant_name, reference_number }
      results.value = mapResults(data, type)
    } finally {
      loading.value = false
    }
  }

  function mapResults(data: any, type: string): SearchResult[] {
    // Adapt based on actual API response shapes found in the codebase.
    // Check each route file for response format before implementing.
    const items = Array.isArray(data) ? data : (data?.data || data?.results || [])
    return items.map((item: any) => ({
      id: item.id,
      type,
      label: /* derive from item based on type */,
      sublabel: /* secondary info */
    }))
  }

  return { results, loading, search }
}
```

**IMPORTANT:** Before implementing `mapResults`, read the actual response shapes from:
- `/backend/src/routes/properties.ts` — check the search endpoint response
- `/backend/src/routes/landlords.ts` — check list/search response
- `/backend/src/routes/tenancies.ts` — check list/search response
- `/backend/src/routes/references.ts` — check list/search response

Adapt the field mappings to match what each endpoint actually returns.

---

## Step 4: Frontend - Report Issue Modal Component

### File: `/frontend/src/components/support/ReportIssueModal.vue` (NEW)

A modal component following the existing modal patterns in the app (fixed overlay + centered card).

**Props:**
```typescript
defineProps<{
  show: boolean
}>()
defineEmits(['close'])
```

**Form fields:**

1. **Page** (auto-filled, read-only):
   - Use `useRoute()` from vue-router to get the current route path
   - Display as a read-only text field so the user can see which page context is being reported

2. **Title** (required, text input):
   - Placeholder: "Brief summary of the issue"
   - Max 100 chars

3. **Severity** (required, select/button group):
   - Options: Low, Medium, High
   - Default to "Medium"
   - Style as 3 pill buttons (green/amber/red)

4. **Description** (required, textarea):
   - Placeholder: "Describe what happened, what you expected, and any steps to reproduce..."
   - Min 20 chars

5. **Link to entity** (optional, collapsible section):
   - A dropdown to select entity type: Reference, Property, Landlord, Tenancy
   - A search input that uses the `useEntitySearch` composable
   - Shows search results as a dropdown list
   - Selected entity displays as a chip/tag with an X to remove
   - Stores: `entityType`, `entityId`, `entityLabel`

6. **Screenshots** (optional, file input):
   - Accept: `image/png, image/jpeg, image/webp`
   - Max 3 files, max 5MB each
   - Show image previews as small thumbnails with remove buttons
   - Use a native file input styled as a drop zone or button

**Submit button:**
- Text: "Submit Report"
- Loading state while submitting
- On success: show toast notification "Issue reported successfully" with the GitHub issue number
- On error: show toast with error message
- Close modal on success

**Styling:**
- Follow existing Tailwind patterns in the app
- Use the app's color system from `/frontend/src/config/colors.ts`
- Use `lucide-vue-next` icons: `Bug`, `Upload`, `Search`, `X`, `Check`
- Max width: `max-w-2xl`
- Scrollable if content overflows

**API call on submit:**
```typescript
const formData = new FormData()
formData.append('page', currentRoute)
formData.append('title', title.value)
formData.append('description', description.value)
formData.append('severity', severity.value)
if (selectedEntity.value) {
  formData.append('entityType', selectedEntity.value.type)
  formData.append('entityId', selectedEntity.value.id)
  formData.append('entityLabel', selectedEntity.value.label)
}
screenshots.value.forEach(file => formData.append('screenshots', file))

// Use fetch directly (not apiFetch) since we need multipart/form-data
// OR check if useApi's apiFetch supports FormData — if it does, use that
const response = await fetch('/api/support/report', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
})
```

---

## Step 5: Frontend - Floating Support Button

### File: `/frontend/src/components/support/ReportIssueButton.vue` (NEW)

A small floating action button (FAB) positioned in the bottom-right corner.

```vue
<template>
  <div>
    <!-- Floating button -->
    <button
      @click="showModal = true"
      class="fixed bottom-6 right-6 z-50 bg-primary-500 hover:bg-primary-600 text-white rounded-full p-3 shadow-lg transition-all hover:scale-105"
      title="Report an issue"
    >
      <Bug :size="20" />
    </button>

    <!-- Modal -->
    <ReportIssueModal
      :show="showModal"
      @close="showModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Bug } from 'lucide-vue-next'
import ReportIssueModal from './ReportIssueModal.vue'

const showModal = ref(false)
</script>
```

**Where to mount it:**

Add this component to the **main authenticated layout**. Look for the layout component that wraps all authenticated pages — likely in `/frontend/src/App.vue` or a layout component used by the router. It should only render when the user is authenticated.

Check how the app structures its layout:
- Look at `App.vue` for a `<router-view>` wrapper
- Or check if there's a `DefaultLayout.vue` / `AuthenticatedLayout.vue`
- The button should appear INSIDE the auth guard, so it only shows for logged-in users

Place it as a sibling to `<router-view>`:
```vue
<template>
  <div>
    <Sidebar v-if="isAuthenticated" />
    <main>
      <router-view />
    </main>
    <ReportIssueButton v-if="isAuthenticated" />
  </div>
</template>
```

Use the auth store (`/frontend/src/stores/auth.ts`) to check `isAuthenticated`.

---

## Step 6: GitHub Labels Setup (One-Time Manual Step)

The following labels should be created on the GitHub repo `CR88/PropertyGooseApp` (via GitHub UI or API):

- `bug` (likely already exists)
- `severity:low` — color: `#0e8a16` (green)
- `severity:medium` — color: `#fbca04` (yellow)
- `severity:high` — color: `#d93f0b` (red)
- `user-reported` — color: `#1d76db` (blue)

Add `'user-reported'` to the labels array in the GitHub issue creation call.

---

## File Checklist

| # | File | Action |
|---|------|--------|
| 1 | `/backend/src/routes/support.ts` | CREATE - API endpoint |
| 2 | `/backend/email-templates/support-issue-confirmation.html` | CREATE - User email template |
| 3 | `/backend/email-templates/support-issue-notification.html` | CREATE - CC notification template |
| 4 | `/frontend/src/composables/useEntitySearch.ts` | CREATE - Search composable |
| 5 | `/frontend/src/components/support/ReportIssueModal.vue` | CREATE - Modal form |
| 6 | `/frontend/src/components/support/ReportIssueButton.vue` | CREATE - Floating button |
| 7 | Main Express app file (where routes mount) | EDIT - Register `/api/support` route |
| 8 | Main layout / `App.vue` | EDIT - Add `<ReportIssueButton>` |
| 9 | `.env` | EDIT - Add `GITHUB_ISSUES_TOKEN` |

---

## Dependencies to Check/Install

- `multer` — for multipart file upload handling (check if already in backend `package.json`)
- No new frontend dependencies needed (all icons, toast, etc. already available)

---

## Testing Checklist

1. Click the floating bug button — modal should open
2. Form validates: title required, description required (min 20 chars), severity required
3. Entity search works for each type (reference, property, landlord, tenancy)
4. Can attach up to 3 screenshots, previews display, can remove them
5. Submit creates a GitHub issue with correct title, body, labels
6. User receives confirmation email
7. info@propertygoose.co.uk receives CC email with full details
8. Modal closes and toast appears on success
9. Button does not appear on public/unauthenticated pages
10. Error states handled gracefully (GitHub API down, email fails, etc.)

---

## Important Notes

- **Do NOT install @octokit/rest** — a simple fetch call to the GitHub API is sufficient and avoids adding a heavy dependency.
- **Screenshots via S3:** The app already has S3 integration. Reuse the existing upload pattern to store screenshots, then embed the URLs in the GitHub issue markdown.
- **Rate limiting:** The email service already has rate limiting built in. No additional rate limiting needed for this feature since it's user-initiated and infrequent.
- **Keep it simple:** This is a support tool, not a ticketing system. No database table needed — GitHub Issues IS the database.
