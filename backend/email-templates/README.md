# PropertyGoose Email Templates

This directory contains branded HTML email templates for Supabase authentication flows.

## Templates

### 1. Confirm Signup (`confirm-signup.html`)
**Supabase Template:** Confirm Signup
**Purpose:** Email confirmation when a new user signs up
**Variables:**
- `{{ .ConfirmationURL }}` - Link to confirm email address

### 2. Invite User (`invite-user.html`)
**Supabase Template:** Invite User
**Purpose:** Email invitation for new team members
**Variables:**
- `{{ .ConfirmationURL }}` - Link to accept invitation

### 3. Magic Link (`magic-link.html`)
**Supabase Template:** Magic Link
**Purpose:** Passwordless login link
**Variables:**
- `{{ .ConfirmationURL }}` - Magic link for signing in

### 4. Change Email (`change-email.html`)
**Supabase Template:** Change Email Address
**Purpose:** Email confirmation when user changes their email
**Variables:**
- `{{ .Email }}` - Current email address
- `{{ .NewEmail }}` - New email address
- `{{ .ConfirmationURL }}` - Link to confirm email change

### 5. Reset Password (`reset-password.html`)
**Supabase Template:** Reset Password
**Purpose:** Password reset request
**Variables:**
- `{{ .ConfirmationURL }}` - Link to reset password

### 6. Reauthentication (`reauthentication.html`)
**Supabase Template:** Reauthentication
**Purpose:** Verification code for sensitive operations
**Variables:**
- `{{ .Token }}` - Verification code

## How to Use

1. Go to your Supabase Dashboard
2. Navigate to **Authentication → Email Templates**
3. Select the template you want to update
4. Copy the HTML from the corresponding file
5. Paste it into the Supabase template editor
6. Save changes

## Branding

All templates use consistent PropertyGoose branding:
- **Logo:** PropertyGoose horizontal logo with icon and text (PNG format for email compatibility)
- **Colors:**
  - CTA buttons in orange (#f97316)
- **Copyright:** © 2025 PropertyGoose

## Image URL

The templates use the hosted logo at:
```
https://app.propertygoose.co.uk/PropertyGooseLogo.png
```

If you need to change this URL, update all template files.

## Notes

- All templates are designed for email client compatibility
- Uses table-based layouts (standard for HTML emails)
- Includes fallback text links for button CTAs
- Security warnings included where appropriate
- Mobile responsive design
