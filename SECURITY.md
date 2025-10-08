# Security Policy

## Overview

PropertyGoose implements enterprise-grade security measures to protect sensitive tenant data, financial information, and personally identifiable information (PII).

## Security Features

### 1. Field-Level Encryption (AES-256-GCM)

All sensitive PII and financial data is encrypted at rest using AES-256-GCM encryption with PBKDF2 key derivation.

#### Encrypted Fields

**Tenant References:**
- `tenant_email` - Tenant email addresses
- `tenant_phone` - Tenant phone numbers
- `contact_number` - Contact numbers
- `date_of_birth` - Date of birth information
- `employment_salary_amount` - Employment salary data
- `self_employed_annual_income` - Self-employment income
- `savings_amount` - Savings balances
- `employer_ref_email` - Employer reference emails
- `employer_ref_phone` - Employer reference phones
- `previous_landlord_email` - Previous landlord emails
- `previous_landlord_phone` - Previous landlord phones
- `accountant_email` - Accountant emails
- `accountant_phone` - Accountant phones

**Invitations:**
- `email` - Invitation email addresses

**Reference Forms:**
- Landlord/Agent reference emails and phones
- Employer reference emails and phones
- Accountant reference emails and phones
- All financial data (rent, salaries, income)

#### Encryption Implementation

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2 with SHA-512, 100,000 iterations
- **IV**: Random 16-byte initialization vector per encryption
- **Salt**: Random 64-byte salt per encryption
- **Authentication**: GCM authentication tag for integrity

### 2. Token Hashing (SHA-256)

All access tokens are hashed before database storage to prevent token reuse if the database is compromised.

#### Hashed Tokens

- **Invitation tokens** (`invitations.token_hash`)
- **Reference tokens** (`tenant_references.reference_token_hash`)
- **Accountant reference tokens** (`accountant_references.token_hash`)

#### Token Security

- Plaintext tokens sent via email (one-time use)
- Only SHA-256 hashes stored in database
- Token verification compares hashes, not plaintext
- Backward compatible during migration period

### 3. HTTP Security Headers (Helmet.js)

Comprehensive security headers protect against common web vulnerabilities:

- **Content Security Policy (CSP)** - Prevents XSS attacks
- **HTTP Strict Transport Security (HSTS)** - Enforces HTTPS
- **X-Frame-Options** - Prevents clickjacking
- **X-Content-Type-Options** - Prevents MIME sniffing
- **X-XSS-Protection** - Browser XSS filter
- **Hide Powered-By** - Obscures technology stack

### 4. HTTPS Enforcement

- Automatic HTTP → HTTPS redirect in production
- HSTS header with 1-year max-age
- Proxy trust configuration for Railway/Cloudflare

### 5. Data in Transit Encryption

- All API requests use TLS 1.2+
- Supabase connections encrypted via TLS
- Email delivery encrypted via SendGrid TLS

### 6. Row Level Security (RLS)

Supabase Row Level Security policies ensure:
- Users only see data for their companies
- Multi-tenant data isolation
- Role-based access control (Owner, Admin, Member)

## Environment Variables

### Required Security Variables

```bash
# Encryption key - MUST be kept secret
ENCRYPTION_KEY=<base64-encoded-32-byte-key>

# Generate a secure key:
openssl rand -base64 32
```

### Production Configuration

```bash
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

## Database Migrations

### Migration Order

1. **004_add_token_hashing.sql** - Adds `*_hash` columns for tokens
2. **005_add_encrypted_fields.sql** - Adds `*_encrypted` columns for PII

### Running Migrations

Execute in Supabase SQL Editor:

```sql
-- Run migrations in order
\i backend/migrations/004_add_token_hashing.sql
\i backend/migrations/005_add_encrypted_fields.sql
```

### Migration Strategy

The application supports a gradual migration:

1. **Phase 1**: Deploy code with encryption enabled
   - Writes to both plaintext and encrypted columns
   - Reads check encrypted columns first, fall back to plaintext

2. **Phase 2**: Migrate existing data (future release)
   - Batch encrypt all existing plaintext data
   - Verify encrypted data integrity

3. **Phase 3**: Remove plaintext columns (future release)
   - Drop plaintext columns after full migration
   - Enforce encrypted-only reads/writes

## Key Rotation

### Encryption Key Rotation Procedure

1. **Generate new encryption key**:
   ```bash
   openssl rand -base64 32
   ```

2. **Decrypt all data with old key, re-encrypt with new key**:
   - Create migration script to batch process records
   - Update `ENCRYPTION_KEY` environment variable
   - Re-deploy application

3. **Verify data integrity**:
   - Test decryption of sample records
   - Monitor application logs for decryption errors

### Token Hash Rotation

Tokens are single-use and time-limited (7-30 days), so rotation happens naturally through expiration.

## Incident Response

### Suspected Key Compromise

If the `ENCRYPTION_KEY` is compromised:

1. **Immediate**:
   - Rotate encryption key immediately
   - Re-encrypt all data
   - Invalidate all active invitation/reference tokens
   - Audit access logs

2. **Within 24 hours**:
   - Notify affected users
   - Document incident
   - Review security practices

3. **Within 1 week**:
   - Post-mortem analysis
   - Implement preventive measures
   - Update security documentation

### Suspected Database Breach

If database access is compromised:

1. **Immediate**:
   - Verify encryption keys are secure (stored in environment, not DB)
   - Invalidate all active tokens
   - Review audit logs for unauthorized access

2. **Assessment**:
   - Encrypted data remains protected if keys not compromised
   - Token hashes prevent reuse
   - Determine scope of breach

3. **Remediation**:
   - Rotate all secrets
   - Force re-authentication for all users
   - Notify affected parties per data protection regulations

## Security Best Practices

### Development

- ✅ Never commit `.env` files to version control
- ✅ Use `.env.example` for documentation only
- ✅ Rotate encryption key between environments
- ✅ Use different Supabase projects for dev/prod
- ✅ Test encryption/decryption locally before deployment

### Production

- ✅ Store `ENCRYPTION_KEY` in Railway secrets/environment variables
- ✅ Enable HTTPS enforcement
- ✅ Use Cloudflare for DDoS protection and rate limiting
- ✅ Monitor logs for decryption failures
- ✅ Regularly audit user permissions
- ✅ Keep dependencies updated

### Deployment

- ✅ Run database migrations before deploying code changes
- ✅ Test encryption with sample data before full deployment
- ✅ Monitor error logs for 24 hours post-deployment
- ✅ Have rollback plan ready

## Security Auditing

### Audit Log System

PropertyGoose includes comprehensive audit logging:
- User actions (create, update, delete)
- Authentication events
- Reference status changes
- Administrative actions

### Monitoring

Regular security monitoring should include:
- Failed authentication attempts
- Unusual API access patterns
- Decryption error rates
- Token verification failures

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public GitHub issue
2. Email security concerns to: [your-security-email]
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

## Compliance

PropertyGoose security measures support compliance with:

- **GDPR** (General Data Protection Regulation)
  - Right to erasure (encrypted data can be securely deleted)
  - Data minimization (only necessary PII encrypted)
  - Security of processing (AES-256 encryption)

- **UK Data Protection Act 2018**
  - Appropriate technical measures (encryption, hashing)
  - Audit trail (comprehensive logging)
  - Access controls (RLS policies)

## Security Update History

| Date | Update | Version |
|------|--------|---------|
| 2025-10-08 | Initial security implementation | 1.0 |
| | - Added AES-256-GCM encryption | |
| | - Added SHA-256 token hashing | |
| | - Added Helmet security headers | |
| | - Added HTTPS enforcement | |

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)

---

**Last Updated**: October 8, 2025
**Security Contact**: [your-security-email]
