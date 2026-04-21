# PropertyGoose Platform Knowledge Base
> This document is GooseBot's brain. It's loaded into the system prompt so the bot can help users navigate the platform.

---

## What is PropertyGoose?

PropertyGoose is an end-to-end tenant referencing, agreements, and tenancy management platform for UK letting agents. Agents use it to:
- Send offers to prospective tenants
- Collect holding deposits
- Run full tenant references (identity, right to rent, income, residential history, credit, AML)
- Generate tenancy agreements
- Manage active tenancies, rent tracking, and compliance

---

## The Offer Flow

1. **Agent sends an offer link** to a tenant (via email or by copying a universal offer link)
2. **Tenant fills in the offer form** — property address, postcode, city, monthly rent, move-in date, tenancy length, their name/email/phone, optional co-tenants, and any special conditions
3. **Offer appears on the agent's dashboard** as "Pending"
4. **Agent reviews and approves** (or declines, or accepts with changes)
5. **Once approved**, the tenant is asked to pay the holding deposit
6. **After payment**, referencing begins automatically

### Offer statuses
- **Pending** — submitted, awaiting agent review
- **Approved** — agent accepted, awaiting deposit payment
- **Accepted with Changes** — agent modified terms, tenant needs to confirm
- **Payment Pending** — tenant marked payment as made, agent needs to confirm receipt
- **Deposit Received** — holding deposit confirmed, referencing can begin
- **Referencing** — references are in progress
- **Sent to Landlord** — offer summary sent to the property landlord
- **Declined** — agent rejected the offer
- **Withdrawn** — tenant withdrew

---

## The Reference Process (V2)

Once referencing begins, tenants complete a multi-step form. There are 6 sections assessed:

### 1. Identity
- Full name, date of birth, phone number
- ID type: Passport, Driving Licence, BRP, or National ID
- Upload a photo/scan of the ID document (max 25MB — PDF, JPG, PNG, HEIC, WebP accepted)
- Take a selfie for facial comparison
- Mobile capture option via QR code for better camera quality

### 2. Right to Rent (RTR)
- Verification of the tenant's right to rent in the UK
- Assessed by PropertyGoose staff using the submitted ID

### 3. Income
- Employment status and monthly income
- Supporting documents: payslips, tax returns, bank statements, or accountant letter
- If employed: employer details collected, employer reference request sent automatically
- If self-employed: accountant reference request sent
- Affordability assessed (rent must be affordable based on income)

### 4. Residential History
- Current and previous addresses (postcode lookup available)
- How long at each address
- Previous landlord/agent reference request sent automatically
- Council tax or utility bill upload as proof of address

### 5. Credit Check
- Run via Creditsafe against the tenant's details
- Checks for CCJs, IVAs, bankruptcy, and overall credit score
- Assessed by PropertyGoose staff

### 6. AML (Anti-Money Laundering)
- Sanctions and PEP (Politically Exposed Person) screening
- Automated check against provided identity details

### Reference statuses
- **Sent** — form link sent to tenant, not yet started
- **Collecting Evidence** — tenant is filling in their form / referees responding
- **Action Required** — PropertyGoose staff need to assess something
- **Individual Complete** — all sections assessed for this person
- **Group Assessment** — combined affordability check across all tenants
- **Accepted** — passed all checks
- **Accepted with Guarantor** — passed but requires a guarantor
- **Accepted on Condition** — conditional pass (conditions noted)
- **Rejected** — failed referencing

### Section decisions
Each section gets one of: **Pass**, **Pass with Condition**, **Fail**, or **Refer** (needs escalation).

---

## Guarantor References

If a tenant doesn't meet affordability requirements, a guarantor may be required. Guarantors complete a similar form:
- Identity verification (same as tenant)
- Proof of address
- Income verification (guarantor must earn at least 30x the monthly rent annually)
- Relationship to tenant (type, how long known, willingness to guarantee)
- Digital signature declaration

---

## Referee Forms

PropertyGoose automatically sends reference requests to:

### Employer Reference
The tenant's employer is asked to confirm:
- Employment status, job title, start date
- Pay type (salary/hourly), amount, employment type
- Probation status
- Takes about 5 minutes to complete

### Landlord/Agent Reference
The tenant's previous landlord or letting agent confirms:
- Tenancy dates and rent amount
- Whether rent was paid on time (Always / Mostly / Sometimes / Rarely)
- Property condition on departure
- Any damage, anti-social behaviour, or disputes
- Whether they would rent to this tenant again

### Accountant Reference
For self-employed tenants, the accountant confirms:
- Client relationship and business name
- How long they've been a client
- Declared annual income
- Whether accounts are up to date
- Any financial concerns

---

## Waiting for Referee Responses

When a referee (employer, landlord, accountant) hasn't responded yet:

- PropertyGoose actively follows up with referees on behalf of the agent — no action needed from agents
- Referees are contacted by email, SMS, and phone until they respond
- The reference status will show "Collecting Evidence" while we're waiting

### What tenants can do to speed things up
- Ask their employer/landlord to check their inbox (including spam/junk folder)
- The email comes from hello@notifications.propertygoose.co.uk — they should add this to contacts
- Provide alternative contact details for their referee if the current ones aren't working
- Upload additional documents directly through their reference form
- If a referee is unresponsive, let us know via this chat and we can explore alternatives

### What agents can see
- Each reference on the References page shows which sections are complete and which are still in progress
- Agents can see which references are progressing and which are waiting for responses

---

## Document Uploads

### Accepted formats
PDF, JPG, PNG, HEIC, WebP, GIF, BMP

### Size limit
25MB per file

### How to upload
- Click the upload area or drag and drop a file
- On mobile, you can take a photo directly from the camera
- Use the "Mobile Capture" QR code for better quality photos from your phone
- Upload links sent via email/SMS are single-use and expire

### Common upload issues
- **"File too large"** — compress the image or use a lower resolution
- **"Unsupported file type"** — convert to PDF or JPG
- **"Upload link expired"** — request a new link from your agent or PropertyGoose
- **Blurry photos** — use the mobile capture option for better quality

---

## Agent Dashboard — How To Do Everything

### Sending an offer to a tenant
1. Go to **Tenant Offers** in the sidebar
2. Click the **"Send Offer"** button (top-right, orange)
3. Fill in the form: tenant's email, select or manually enter the property address, set the advertised rent, and optionally tick deposit replacement (Reposit) or bills included
4. Click **"Send Offer"** — the tenant receives an email with a link to submit their offer

### Copying the universal offer link
1. Go to **Tenant Offers**
2. Click **"Copy Offer Link"** (next to Send Offer)
3. The link is copied to your clipboard — you can share it anywhere (email, social media, your website)
4. Any tenant who visits the link can fill in their offer details and submit

### Approving an offer
1. Go to **Tenant Offers** and click on the offer
2. Review the tenant's details
3. Click the green **"Approve"** button
4. Confirm — this sends the tenant an email with your bank details and a request for the holding deposit payment

### Declining an offer
1. Open the offer from **Tenant Offers**
2. Click the red **"Decline"** button
3. Enter a reason for declining (required)
4. Click **"Confirm Decline"** — the tenant is notified by email with the reason

### Accepting an offer with changes
1. Open the offer from **Tenant Offers**
2. Click **"Accept with Changes"**
3. Edit any fields (rent, move-in date, tenancy length, deposit, special conditions)
4. Click **"Save Changes"** — a confirmation dialog asks if the changes have been agreed with the tenant
5. Click **OK** to approve and notify the tenant, or **Cancel** to save changes without approving yet

### Marking a holding deposit as received
1. Open the approved offer from **Tenant Offers**
2. Click the green **"Holding Deposit Received - Send References"** button
3. If there are multiple tenants, you'll first set rent shares for each tenant
4. Enter the amount received
5. Click **"Confirm"** — this records the deposit AND automatically creates and sends reference forms to all tenants

### Checking reference progress
1. Go to **References** in the sidebar (make sure V2 is selected)
2. References are grouped by property — each reference shows coloured section blocks:
   - **Green** = passed, **Orange** = evidence submitted/in progress, **Grey** = pending
3. Sections shown: ID, RTR, Income, Residential, Credit, AML
4. Click anywhere on a reference row to open the detail drawer with full section breakdowns
5. Use the tabs at the top to filter: All, Sent, Collecting, In Review, Completed

### Creating a tenancy from completed references
1. Go to **References** in the sidebar
2. Find the property group with the completed references
3. Click the **"Create Tenancy"** button on the property group header
4. The tenancy conversion modal opens — all tenant details, property info, and deposit details are pre-filled from the references
5. Select the deposit scheme, set the deposit amount and rent due day
6. Click **"Convert to Tenancy"** — the tenancy is created with everything pre-populated

### Generating a tenancy agreement
1. Go to **Agreements** in the sidebar
2. On the **Generate** tab, fill in the agreement details (property, landlord, tenants, rent, term, deposit)
3. Click **"Generate Agreement"**
4. Preview the agreement, then click **"Send for Signature"** — the tenant receives a signing link by email
5. Once signed, it appears in the **History** tab where you can download the PDF

### Managing tenancies
1. Go to **Tenancies** in the sidebar
2. Four tabs: **Draft** (pending), **Active** (live), **Notice Served** (ending), **Archived** (ended)
3. Click any tenancy row to open the detail drawer
4. Available actions: change rent due date, end tenancy, change tenant, send rent increase notice, email tenants

### Adding team members
1. Go to **Settings** in the sidebar, then the **Team** tab
2. Enter the new member's email, set an initial password, and choose their role
3. Click **"Send Invite"** — they receive an email to accept and activate their account

---

## Common Questions — Tenants

**Q: How long does referencing take?**
A: Typically 2-5 working days, depending on how quickly your referees respond. You can speed things up by asking your employer and previous landlord to look out for our email.

**Q: What documents do I need?**
A: Photo ID (passport or driving licence), proof of address (utility bill or council tax), and proof of income (recent payslips, tax return, or bank statements).

**Q: I can't complete a section of my form — what do I do?**
A: Save your progress and come back later. If you're stuck on a specific section, use this chat to tell us what's wrong and we'll help.

**Q: My employer/landlord hasn't received the reference request.**
A: Ask them to check their spam/junk folder. The email comes from PropertyGoose (hello@notifications.propertygoose.co.uk). If they still can't find it, let us know and we can resend or try an alternative contact.

**Q: What happens if I fail a reference check?**
A: Your agent will be informed and will discuss next steps with you. Options may include providing a guarantor or additional evidence.

**Q: Can I upload documents from my phone?**
A: Yes! Use the QR code on the upload page to open the camera on your phone for better quality photos.

**Q: Is my data secure?**
A: Yes. All personal data is encrypted at rest and in transit. PropertyGoose complies with UK GDPR requirements.

---

## Common Questions — Agents

**Q: How do I send an offer to a tenant?**
A: On the Tenant Offers page, click "Send Offer" (top-right), fill in their email and property details, and click send. They'll get an email with a link to submit their offer.

**Q: How do I approve an offer?**
A: Click the offer, then click the green "Approve" button. This emails the tenant your bank details for the holding deposit.

**Q: How do I mark a holding deposit as received?**
A: Open the approved offer and click "Holding Deposit Received - Send References". Enter the amount received and confirm. This automatically creates references and sends forms to the tenant.

**Q: How do I create a tenancy from references?**
A: Go to the References page, find the property group, and click "Create Tenancy". The conversion modal pre-fills everything from the references — just select your deposit scheme and confirm.

**Q: How do I check reference progress?**
A: On the References page, each reference shows coloured section blocks (green = passed, orange = in progress, grey = pending). Click a reference row to see the full breakdown.

**Q: How do I generate a tenancy agreement?**
A: Go to Agreements > Generate, fill in the details, click "Generate Agreement", preview it, then "Send for Signature" — the tenant gets a signing link by email.

**Q: Can I add team members?**
A: Go to Settings > Team, enter their email, set a password and role, and click "Send Invite".

---

## Troubleshooting

**Page not loading / white screen**
- Try refreshing the page (Ctrl+R or Cmd+R)
- Clear your browser cache
- Try a different browser (Chrome or Edge recommended)

**Can't log in**
- Check your email and password are correct
- Try the "Forgot Password" link
- Contact your company admin if your account may have been deactivated

**Form not saving**
- Check your internet connection
- Make sure all required fields (marked with *) are filled in
- Try a different browser if the issue persists

**Upload failing**
- Check file size (max 25MB)
- Check file format (PDF, JPG, PNG, HEIC, WebP)
- Try compressing the image
- Try the mobile capture QR option instead

**Email not received**
- Check spam/junk folder
- Check the email address is correct
- Emails come from hello@notifications.propertygoose.co.uk — add this to your contacts
