# Security Deployment Guide

This guide walks you through deploying the security enhancements for PropertyGoose.

## Prerequisites

- Access to your Supabase project SQL Editor
- Access to your Railway environment variables (or local `.env` for development)
- Terminal access for generating encryption key

## Step 1: Generate Encryption Key

Generate a secure 256-bit encryption key:

```bash
openssl rand -base64 32
```

Save this key securely - you'll need it for the environment variables.

**⚠️ IMPORTANT**: This key must be kept secret and never committed to version control!

## Step 2: Run Database Migrations

### 2.1 Add Token Hash Columns

1. Open Supabase SQL Editor
2. Run `backend/migrations/004_add_token_hashing.sql`:

```sql
-- Add token_hash column to invitations table
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- Add reference_token_hash column to tenant_references table
ALTER TABLE tenant_references ADD COLUMN IF NOT EXISTS reference_token_hash TEXT;

-- Add token_hash column to accountant_references table
ALTER TABLE accountant_references ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- Create indexes for hash lookups
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_tenant_references_token_hash ON tenant_references(reference_token_hash);
CREATE INDEX IF NOT EXISTS idx_accountant_references_token_hash ON accountant_references(token_hash);
```

### 2.2 Add Encrypted Field Columns

Run `backend/migrations/005_add_encrypted_fields.sql`:

```sql
-- Add encrypted columns to tenant_references table
ALTER TABLE tenant_references
  ADD COLUMN IF NOT EXISTS tenant_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS tenant_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS contact_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employment_salary_amount_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS self_employed_annual_income_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS savings_amount_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employer_ref_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employer_ref_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_landlord_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_landlord_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS accountant_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS accountant_phone_encrypted TEXT;

-- Add encrypted columns to invitations table
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS email_encrypted TEXT;

-- Add encrypted columns to landlord_references table
ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS landlord_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS landlord_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS monthly_rent_encrypted TEXT;

-- Add encrypted columns to agent_references table
ALTER TABLE agent_references
  ADD COLUMN IF NOT EXISTS agent_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS agent_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS monthly_rent_encrypted TEXT;

-- Add encrypted columns to employer_references table
ALTER TABLE employer_references
  ADD COLUMN IF NOT EXISTS employer_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employer_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS annual_salary_encrypted TEXT;

-- Add encrypted columns to accountant_references table
ALTER TABLE accountant_references
  ADD COLUMN IF NOT EXISTS accountant_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS accountant_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS annual_turnover_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS annual_profit_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS estimated_monthly_income_encrypted TEXT;
```

## Step 3: Set Environment Variables

### Local Development

Add to `backend/.env`:

```bash
# Generate this with: openssl rand -base64 32
ENCRYPTION_KEY=<your-generated-key-here>
```

### Production (Railway)

1. Go to Railway Dashboard → Your Project → Backend Service
2. Navigate to "Variables" tab
3. Add new variable:
   - **Name**: `ENCRYPTION_KEY`
   - **Value**: `<your-generated-key-here>`
4. Click "Save"
5. Railway will automatically redeploy

**Note**: Use a DIFFERENT encryption key for production vs development!

## Step 4: Deploy Application

### Development Testing

1. Start the backend:
   ```bash
   cd backend
   npm run dev
   ```

2. Verify no errors in console
3. Test creating a new invitation or reference
4. Check database - verify `*_hash` columns are being populated

### Production Deployment

1. Commit changes:
   ```bash
   git add .
   git commit -m "Add security enhancements: encryption, token hashing, HTTPS"
   git push origin main
   ```

2. Railway will auto-deploy (if connected to GitHub)
3. Monitor deployment logs for errors

## Step 5: Verify Security Features

### 5.1 Token Hashing

Create a new invitation and verify:

```sql
SELECT token_hash, token FROM invitations ORDER BY created_at DESC LIMIT 1;
```

You should see:
- `token_hash`: A 64-character hex string (SHA-256 hash)
- `token`: The original token (will be removed in future)

### 5.2 HTTPS Headers

Use browser DevTools → Network tab:

1. Make any API request
2. Check Response Headers for:
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `X-XSS-Protection: 1; mode=block`

### 5.3 HTTPS Redirect (Production Only)

1. Try accessing `http://your-domain.com`
2. Should automatically redirect to `https://your-domain.com`

## Step 6: Migration Period

During the migration period (recommended: 30 days):

✅ **Current State**:
- New invitations/references write to both plaintext and hashed columns
- Token verification checks hashed columns first, falls back to plaintext
- Backward compatible with old tokens

✅ **What Works**:
- Old invitation/reference links continue to work
- New links use secure hashed tokens
- Gradual transition without breaking changes

## Step 7: Monitor for Issues

### Check Application Logs

Look for any errors related to:
- `ENCRYPTION_KEY not set`
- Decryption failures
- Token hash mismatches

### Railway Logs

```bash
# View real-time logs
railway logs --service backend
```

### Common Issues

**Issue**: `ENCRYPTION_KEY environment variable is not set`
**Solution**: Add `ENCRYPTION_KEY` to Railway environment variables

**Issue**: Token verification failing
**Solution**: Ensure migrations ran successfully and indexes were created

**Issue**: CORS errors in production
**Solution**: Verify `FRONTEND_URL` is set correctly in Railway

## Step 8: Future Cleanup (30+ days after deployment)

After all old tokens have expired:

1. **Verify no active old tokens**:
   ```sql
   -- Check for NULL hash values in active records
   SELECT COUNT(*) FROM invitations
   WHERE status = 'pending'
   AND expires_at > NOW()
   AND token_hash IS NULL;

   SELECT COUNT(*) FROM tenant_references
   WHERE reference_token_hash IS NULL
   AND token_expires_at > NOW();
   ```

2. **If count is 0, safe to remove plaintext columns**:
   ```sql
   -- Remove plaintext token columns (future migration)
   ALTER TABLE invitations DROP COLUMN token;
   ALTER TABLE tenant_references DROP COLUMN reference_token;
   ALTER TABLE accountant_references DROP COLUMN token;
   ```

## Security Checklist

- [ ] Generated secure encryption key
- [ ] Set `ENCRYPTION_KEY` in development environment
- [ ] Ran migration 004 (token hashing) in Supabase
- [ ] Ran migration 005 (encrypted fields) in Supabase
- [ ] Verified indexes created successfully
- [ ] Set `ENCRYPTION_KEY` in Railway production
- [ ] Set `NODE_ENV=production` in Railway
- [ ] Deployed application to production
- [ ] Verified HTTPS headers present
- [ ] Verified HTTPS redirect works
- [ ] Tested creating new invitation (token hash populated)
- [ ] Tested creating new reference (token hash populated)
- [ ] Monitored logs for 24 hours post-deployment
- [ ] Documented encryption key location (password manager)
- [ ] Scheduled future cleanup (30 days)

## Rollback Plan

If critical issues arise:

### Immediate Rollback

1. **Revert code changes**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Railway auto-deploys previous version**

3. **Database is unaffected** (new columns simply unused)

### Rollback Considerations

✅ **Safe to rollback**: New columns don't break old code
✅ **Data preserved**: No data loss on rollback
❌ **New tokens won't work**: Tokens created with new code won't work with old code

## Support

If you encounter issues:

1. Check `SECURITY.md` for troubleshooting
2. Review application logs
3. Verify environment variables are set correctly
4. Check Supabase migrations executed successfully

---

**Security Features Enabled:**
✅ AES-256-GCM Encryption
✅ SHA-256 Token Hashing
✅ Helmet Security Headers
✅ HTTPS Enforcement
✅ Proxy Trust Configuration

**Next Steps:**
- Monitor application for 24 hours
- Test all user flows (create invitation, submit reference, etc.)
- Review audit logs for unusual activity
- Schedule encryption key rotation (annually)
