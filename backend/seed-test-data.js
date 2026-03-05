const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Load env
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COMPANY_ID = 'd0ad3a14-9b07-4be8-91fb-98624e0d1c71';
const USER_ID = 'd8ec1676-5e6e-4a6e-b37d-3dbbb0f13023';
const TEST_EMAIL = 'info@propertygoose.co.uk';

// Encryption
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;

function encrypt(plaintext) {
  if (!plaintext) return null;
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
  const salt = Buffer.alloc(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  return combined.toString('base64');
}

// Generate tenancy reference number
let tenancyCounter = 6; // Start after TEN-26-0005
function generateTenancyRef() {
  const num = tenancyCounter++;
  return `TEN-26-${String(num).padStart(4, '0')}`;
}

async function seedData() {
  console.log('Starting seed data creation...\n');

  // ============ LANDLORDS ============
  console.log('Creating landlords...');
  const landlords = [
    {
      id: uuidv4(),
      company_id: COMPANY_ID,
      title_encrypted: encrypt('Mr'),
      first_name_encrypted: encrypt('James'),
      last_name_encrypted: encrypt('Wilson'),
      email_encrypted: encrypt(TEST_EMAIL),
      phone_encrypted: encrypt('07700900001'),
      residential_address_line1_encrypted: encrypt('10 Victoria Road'),
      residential_city_encrypted: encrypt('London'),
      residential_postcode_encrypted: encrypt('SW1A 1AA'),
      bank_account_name_encrypted: encrypt('James Wilson'),
      bank_account_number_encrypted: encrypt('12345678'),
      bank_sort_code_encrypted: encrypt('123456'),
      created_by: USER_ID
    },
    {
      id: uuidv4(),
      company_id: COMPANY_ID,
      title_encrypted: encrypt('Mrs'),
      first_name_encrypted: encrypt('Sarah'),
      last_name_encrypted: encrypt('Thompson'),
      email_encrypted: encrypt(TEST_EMAIL),
      phone_encrypted: encrypt('07700900002'),
      residential_address_line1_encrypted: encrypt('25 Oak Avenue'),
      residential_city_encrypted: encrypt('Manchester'),
      residential_postcode_encrypted: encrypt('M1 1AA'),
      bank_account_name_encrypted: encrypt('Sarah Thompson'),
      bank_account_number_encrypted: encrypt('87654321'),
      bank_sort_code_encrypted: encrypt('654321'),
      created_by: USER_ID
    },
    {
      id: uuidv4(),
      company_id: COMPANY_ID,
      title_encrypted: encrypt('Dr'),
      first_name_encrypted: encrypt('Robert'),
      last_name_encrypted: encrypt('Brown'),
      email_encrypted: encrypt(TEST_EMAIL),
      phone_encrypted: encrypt('07700900003'),
      residential_address_line1_encrypted: encrypt('5 High Street'),
      residential_city_encrypted: encrypt('Birmingham'),
      residential_postcode_encrypted: encrypt('B1 1AA'),
      bank_account_name_encrypted: encrypt('Robert Brown'),
      bank_account_number_encrypted: encrypt('11223344'),
      bank_sort_code_encrypted: encrypt('112233'),
      created_by: USER_ID
    }
  ];

  for (const landlord of landlords) {
    const { error } = await supabase.from('landlords').insert(landlord);
    if (error) console.error('Error creating landlord:', error.message);
    else console.log(`  Created landlord: ${landlord.id}`);
  }

  // ============ PROPERTIES ============
  console.log('\nCreating properties...');
  const properties = [
    {
      id: uuidv4(),
      company_id: COMPANY_ID,
      address_line1_encrypted: encrypt('42 Baker Street'),
      city_encrypted: encrypt('London'),
      postcode: 'NW1 6XE',
      property_type: 'flat',
      number_of_bedrooms: 2,
      number_of_bathrooms: 1,
      status: 'vacant',
      created_by: USER_ID,
      landlord_id: landlords[0].id
    },
    {
      id: uuidv4(),
      company_id: COMPANY_ID,
      address_line1_encrypted: encrypt('15 Privet Drive'),
      city_encrypted: encrypt('London'),
      postcode: 'E1 6AN',
      property_type: 'house',
      number_of_bedrooms: 3,
      number_of_bathrooms: 2,
      status: 'vacant',
      created_by: USER_ID,
      landlord_id: landlords[0].id
    },
    {
      id: uuidv4(),
      company_id: COMPANY_ID,
      address_line1_encrypted: encrypt('221B Maple Road'),
      city_encrypted: encrypt('Manchester'),
      postcode: 'M20 1AA',
      property_type: 'flat',
      number_of_bedrooms: 1,
      number_of_bathrooms: 1,
      status: 'vacant',
      created_by: USER_ID,
      landlord_id: landlords[1].id
    },
    {
      id: uuidv4(),
      company_id: COMPANY_ID,
      address_line1_encrypted: encrypt('7 Elm Grove'),
      city_encrypted: encrypt('Birmingham'),
      postcode: 'B15 2TT',
      property_type: 'house',
      number_of_bedrooms: 4,
      number_of_bathrooms: 2,
      status: 'vacant',
      created_by: USER_ID,
      landlord_id: landlords[2].id
    },
    {
      id: uuidv4(),
      company_id: COMPANY_ID,
      address_line1_encrypted: encrypt('33 Station Road'),
      city_encrypted: encrypt('Manchester'),
      postcode: 'M15 4FX',
      property_type: 'flat',
      number_of_bedrooms: 2,
      number_of_bathrooms: 1,
      status: 'vacant',
      created_by: USER_ID,
      landlord_id: landlords[1].id
    }
  ];

  for (const property of properties) {
    const landlordId = property.landlord_id;
    delete property.landlord_id;

    const { error } = await supabase.from('properties').insert(property);
    if (error) {
      console.error('Error creating property:', error.message);
    } else {
      console.log(`  Created property: ${property.postcode}`);
      // Link landlord
      await supabase.from('property_landlords').insert({
        id: uuidv4(),
        property_id: property.id,
        landlord_id: landlordId,
        ownership_percentage: 100,
        is_primary_contact: true,
        created_by: USER_ID
      });
    }
  }

  // ============ TENANT OFFERS ============
  console.log('\nCreating tenant offers...');

  const createOffer = async (offerData, tenants) => {
    const { error: offerError } = await supabase.from('tenant_offers').insert(offerData);
    if (offerError) {
      console.error('Error creating offer:', offerError.message);
      return;
    }

    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i];
      const { error: tenantError } = await supabase.from('tenant_offer_tenants').insert({
        id: uuidv4(),
        tenant_offer_id: offerData.id,
        tenant_order: i + 1,
        name_encrypted: encrypt(tenant.name),
        email_encrypted: encrypt(TEST_EMAIL),
        phone_encrypted: encrypt(tenant.phone),
        rent_share: tenant.rent_share
      });
      if (tenantError) console.error('Error creating offer tenant:', tenantError.message);
    }
    console.log(`  Created offer: ${offerData.status}`);
  };

  // Offer 1: Pending (no linked property - just address)
  await createOffer({
    id: uuidv4(),
    company_id: COMPANY_ID,
    property_address_encrypted: encrypt('42 Baker Street'),
    property_city_encrypted: encrypt('London'),
    property_postcode_encrypted: encrypt('NW1 6XE'),
    status: 'pending',
    offered_rent_amount: 1500,
    deposit_amount: 1500,
    proposed_move_in_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
    proposed_tenancy_length_months: 12,
    created_by: USER_ID
  }, [
    { name: 'Alice Johnson', phone: '07700100001', rent_share: 1500 }
  ]);

  // Offer 2: Approved
  await createOffer({
    id: uuidv4(),
    company_id: COMPANY_ID,
    property_address_encrypted: encrypt('15 Privet Drive'),
    property_city_encrypted: encrypt('London'),
    property_postcode_encrypted: encrypt('E1 6AN'),
    status: 'approved',
    offered_rent_amount: 2200,
    deposit_amount: 2200,
    proposed_move_in_date: new Date(Date.now() + 21*24*60*60*1000).toISOString().split('T')[0],
    proposed_tenancy_length_months: 12,
    approved_at: new Date().toISOString(),
    approved_by: USER_ID,
    created_by: USER_ID
  }, [
    { name: 'Bob Smith', phone: '07700100002', rent_share: 1100 },
    { name: 'Carol Davis', phone: '07700100003', rent_share: 1100 }
  ]);

  // Offer 3: Declined
  await createOffer({
    id: uuidv4(),
    company_id: COMPANY_ID,
    property_address_encrypted: encrypt('221B Maple Road'),
    property_city_encrypted: encrypt('Manchester'),
    property_postcode_encrypted: encrypt('M20 1AA'),
    status: 'declined',
    offered_rent_amount: 900,
    deposit_amount: 900,
    proposed_move_in_date: new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0],
    proposed_tenancy_length_months: 6,
    declined_reason_encrypted: encrypt('Rent offer too low'),
    declined_at: new Date().toISOString(),
    declined_by: USER_ID,
    created_by: USER_ID
  }, [
    { name: 'David Wilson', phone: '07700100004', rent_share: 900 }
  ]);

  // Offer 4: Holding deposit received
  await createOffer({
    id: uuidv4(),
    company_id: COMPANY_ID,
    property_address_encrypted: encrypt('33 Station Road'),
    property_city_encrypted: encrypt('Manchester'),
    property_postcode_encrypted: encrypt('M15 4FX'),
    status: 'holding_deposit_received',
    offered_rent_amount: 1200,
    deposit_amount: 1200,
    proposed_move_in_date: new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0],
    proposed_tenancy_length_months: 12,
    holding_deposit_received: true,
    holding_deposit_received_at: new Date().toISOString(),
    holding_deposit_amount_paid: 240,
    approved_at: new Date().toISOString(),
    approved_by: USER_ID,
    created_by: USER_ID
  }, [
    { name: 'Emma Brown', phone: '07700100005', rent_share: 1200 }
  ]);

  // ============ REFERENCES ============
  console.log('\nCreating references...');

  // Token expires in 40 days
  const tokenExpiry = new Date(Date.now() + 40*24*60*60*1000).toISOString();

  const createReference = async (refData) => {
    const { error: refError } = await supabase.from('tenant_references').insert({
      ...refData,
      token_expires_at: tokenExpiry
    });
    if (refError) {
      console.error('Error creating reference:', refError.message);
      return;
    }
    console.log(`  Created reference: ${refData.status}`);
  };

  // Reference 1: pending (not started)
  await createReference({
    id: uuidv4(),
    company_id: COMPANY_ID,
    created_by: USER_ID,
    property_address_encrypted: encrypt('42 Baker Street'),
    property_city_encrypted: encrypt('London'),
    property_postcode_encrypted: encrypt('NW1 6XE'),
    monthly_rent: 1500,
    move_in_date: new Date(Date.now() + 28*24*60*60*1000).toISOString().split('T')[0],
    status: 'pending',
    tenant_first_name_encrypted: encrypt('Frank'),
    tenant_last_name_encrypted: encrypt('Miller'),
    tenant_email_encrypted: encrypt(TEST_EMAIL),
    tenant_phone_encrypted: encrypt('07700200001'),
    rent_share: 1500
  });

  // Reference 2: in_progress
  await createReference({
    id: uuidv4(),
    company_id: COMPANY_ID,
    created_by: USER_ID,
    property_address_encrypted: encrypt('15 Privet Drive'),
    property_city_encrypted: encrypt('London'),
    property_postcode_encrypted: encrypt('E1 6AN'),
    monthly_rent: 2200,
    move_in_date: new Date(Date.now() + 21*24*60*60*1000).toISOString().split('T')[0],
    status: 'in_progress',
    tenant_first_name_encrypted: encrypt('Grace'),
    tenant_last_name_encrypted: encrypt('Taylor'),
    tenant_email_encrypted: encrypt(TEST_EMAIL),
    tenant_phone_encrypted: encrypt('07700200002'),
    rent_share: 1100,
    date_of_birth_encrypted: encrypt('1990-05-15'),
    nationality_encrypted: encrypt('British'),
    current_address_line1_encrypted: encrypt('55 Current Road'),
    current_city_encrypted: encrypt('London'),
    current_postcode_encrypted: encrypt('E2 7AX'),
    employment_company_name_encrypted: encrypt('Tech Corp Ltd'),
    employment_position_encrypted: encrypt('Software Developer'),
    employment_salary_amount_encrypted: encrypt('55000'),
    employer_ref_email_encrypted: encrypt(TEST_EMAIL),
    employer_ref_phone_encrypted: encrypt('02012345678'),
    income_regular_employment: true
  });

  // Reference 3: pending_verification (awaiting staff review)
  await createReference({
    id: uuidv4(),
    company_id: COMPANY_ID,
    created_by: USER_ID,
    property_address_encrypted: encrypt('221B Maple Road'),
    property_city_encrypted: encrypt('Manchester'),
    property_postcode_encrypted: encrypt('M20 1AA'),
    monthly_rent: 950,
    move_in_date: new Date(Date.now() + 14*24*60*60*1000).toISOString().split('T')[0],
    status: 'pending_verification',
    tenant_first_name_encrypted: encrypt('Ivy'),
    tenant_last_name_encrypted: encrypt('Clark'),
    tenant_email_encrypted: encrypt(TEST_EMAIL),
    tenant_phone_encrypted: encrypt('07700200004'),
    rent_share: 950,
    date_of_birth_encrypted: encrypt('1988-12-10'),
    nationality_encrypted: encrypt('British'),
    current_address_line1_encrypted: encrypt('75 Current Place'),
    current_city_encrypted: encrypt('Manchester'),
    current_postcode_encrypted: encrypt('M1 2AB'),
    employment_company_name_encrypted: encrypt('Finance Corp'),
    employment_position_encrypted: encrypt('Accountant'),
    employment_salary_amount_encrypted: encrypt('45000'),
    employer_ref_email_encrypted: encrypt(TEST_EMAIL),
    employer_ref_phone_encrypted: encrypt('02011112222'),
    previous_landlord_name_encrypted: encrypt('Previous Properties Ltd'),
    previous_landlord_email_encrypted: encrypt(TEST_EMAIL),
    previous_landlord_phone_encrypted: encrypt('02033334444'),
    income_regular_employment: true,
    submitted_at: new Date().toISOString()
  });

  // Reference 4: in_progress (needing more info)
  await createReference({
    id: uuidv4(),
    company_id: COMPANY_ID,
    created_by: USER_ID,
    property_address_encrypted: encrypt('33 Station Road'),
    property_city_encrypted: encrypt('Manchester'),
    property_postcode_encrypted: encrypt('M15 4FX'),
    monthly_rent: 1200,
    move_in_date: new Date(Date.now() + 10*24*60*60*1000).toISOString().split('T')[0],
    status: 'in_progress',
    tenant_first_name_encrypted: encrypt('Jack'),
    tenant_last_name_encrypted: encrypt('White'),
    tenant_email_encrypted: encrypt(TEST_EMAIL),
    tenant_phone_encrypted: encrypt('07700200005'),
    rent_share: 1200,
    date_of_birth_encrypted: encrypt('1995-03-25'),
    nationality_encrypted: encrypt('British')
  });

  // Reference 5: completed
  await createReference({
    id: uuidv4(),
    company_id: COMPANY_ID,
    created_by: USER_ID,
    property_address_encrypted: encrypt('7 Elm Grove'),
    property_city_encrypted: encrypt('Birmingham'),
    property_postcode_encrypted: encrypt('B15 2TT'),
    monthly_rent: 1800,
    move_in_date: new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0],
    status: 'completed',
    tenant_first_name_encrypted: encrypt('Kate'),
    tenant_last_name_encrypted: encrypt('Evans'),
    tenant_email_encrypted: encrypt(TEST_EMAIL),
    tenant_phone_encrypted: encrypt('07700200006'),
    rent_share: 900,
    date_of_birth_encrypted: encrypt('1985-07-12'),
    nationality_encrypted: encrypt('British'),
    current_address_line1_encrypted: encrypt('150 Current Street'),
    current_city_encrypted: encrypt('Birmingham'),
    current_postcode_encrypted: encrypt('B2 3CD'),
    employment_company_name_encrypted: encrypt('Big Company Ltd'),
    employment_position_encrypted: encrypt('Manager'),
    employment_salary_amount_encrypted: encrypt('65000'),
    employer_ref_email_encrypted: encrypt(TEST_EMAIL),
    employer_ref_phone_encrypted: encrypt('02055556666'),
    previous_landlord_name_encrypted: encrypt('Good Landlords Inc'),
    previous_landlord_email_encrypted: encrypt(TEST_EMAIL),
    previous_landlord_phone_encrypted: encrypt('02077778888'),
    income_regular_employment: true,
    submitted_at: new Date(Date.now() - 14*24*60*60*1000).toISOString(),
    completed_at: new Date(Date.now() - 7*24*60*60*1000).toISOString(),
    verified_by: USER_ID,
    verified_at: new Date(Date.now() - 7*24*60*60*1000).toISOString()
  });

  // ============ TENANCIES ============
  console.log('\nCreating tenancies...');

  // Tenancy 1: Draft
  const tenancy1Id = uuidv4();
  const { error: t1Error } = await supabase.from('tenancies').insert({
    id: tenancy1Id,
    company_id: COMPANY_ID,
    property_id: properties[3].id,
    landlord_id: landlords[2].id,
    reference_number: generateTenancyRef(),
    status: 'draft',
    rent_amount: 1800,
    deposit_amount: 1800,
    tenancy_start_date: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0],
    tenancy_end_date: new Date(Date.now() + 372*24*60*60*1000).toISOString().split('T')[0],
    rent_due_day: 1,
    property_address_encrypted: encrypt('7 Elm Grove, Birmingham, B15 2TT'),
    property_postcode_encrypted: encrypt('B15 2TT'),
    created_by: USER_ID
  });
  if (t1Error) console.error('Error creating tenancy 1:', t1Error.message);
  else {
    await supabase.from('tenancy_tenants').insert([
      { id: uuidv4(), tenancy_id: tenancy1Id, tenant_name_encrypted: encrypt('Kate Evans'), tenant_email_encrypted: encrypt(TEST_EMAIL), tenant_phone_encrypted: encrypt('07700200006'), rent_share_amount: 900, is_active: true },
      { id: uuidv4(), tenancy_id: tenancy1Id, tenant_name_encrypted: encrypt('Leo Martin'), tenant_email_encrypted: encrypt(TEST_EMAIL), tenant_phone_encrypted: encrypt('07700200007'), rent_share_amount: 900, is_active: true }
    ]);
    console.log('  Created tenancy: Draft - B15 2TT');
  }

  // Tenancy 2: Agreement Signed (Active)
  const tenancy2Id = uuidv4();
  const { error: t2Error } = await supabase.from('tenancies').insert({
    id: tenancy2Id,
    company_id: COMPANY_ID,
    property_id: properties[0].id,
    landlord_id: landlords[0].id,
    reference_number: generateTenancyRef(),
    status: 'agreement_signed',
    rent_amount: 1500,
    deposit_amount: 1500,
    tenancy_start_date: new Date(Date.now() - 60*24*60*60*1000).toISOString().split('T')[0],
    tenancy_end_date: new Date(Date.now() + 305*24*60*60*1000).toISOString().split('T')[0],
    rent_due_day: 15,
    deposit_protected_at: new Date(Date.now() - 55*24*60*60*1000).toISOString(),
    deposit_scheme: 'TDS',
    deposit_reference: 'TDS-12345678',
    initial_monies_paid: true,
    initial_monies_paid_at: new Date(Date.now() - 59*24*60*60*1000).toISOString(),
    property_address_encrypted: encrypt('42 Baker Street, London, NW1 6XE'),
    property_postcode_encrypted: encrypt('NW1 6XE'),
    created_by: USER_ID
  });
  if (t2Error) console.error('Error creating tenancy 2:', t2Error.message);
  else {
    await supabase.from('tenancy_tenants').insert([
      { id: uuidv4(), tenancy_id: tenancy2Id, tenant_name_encrypted: encrypt('Mike Green'), tenant_email_encrypted: encrypt(TEST_EMAIL), tenant_phone_encrypted: encrypt('07700300001'), rent_share_amount: 1500, is_active: true }
    ]);
    console.log('  Created tenancy: Agreement Signed - NW1 6XE');
  }

  // Tenancy 3: Notice Given
  const tenancy3Id = uuidv4();
  const { error: t3Error } = await supabase.from('tenancies').insert({
    id: tenancy3Id,
    company_id: COMPANY_ID,
    property_id: properties[1].id,
    landlord_id: landlords[0].id,
    reference_number: generateTenancyRef(),
    status: 'notice_given',
    rent_amount: 2200,
    deposit_amount: 2200,
    tenancy_start_date: new Date(Date.now() - 180*24*60*60*1000).toISOString().split('T')[0],
    tenancy_end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
    rent_due_day: 1,
    deposit_protected_at: new Date(Date.now() - 175*24*60*60*1000).toISOString(),
    deposit_scheme: 'DPS',
    deposit_reference: 'DPS-87654321',
    initial_monies_paid: true,
    notice_served_at: new Date(Date.now() - 30*24*60*60*1000).toISOString(),
    notice_type: 'section21',
    property_address_encrypted: encrypt('15 Privet Drive, London, E1 6AN'),
    property_postcode_encrypted: encrypt('E1 6AN'),
    created_by: USER_ID
  });
  if (t3Error) console.error('Error creating tenancy 3:', t3Error.message);
  else {
    await supabase.from('tenancy_tenants').insert([
      { id: uuidv4(), tenancy_id: tenancy3Id, tenant_name_encrypted: encrypt('Nancy Blue'), tenant_email_encrypted: encrypt(TEST_EMAIL), tenant_phone_encrypted: encrypt('07700300002'), rent_share_amount: 1100, is_active: true },
      { id: uuidv4(), tenancy_id: tenancy3Id, tenant_name_encrypted: encrypt('Oscar Red'), tenant_email_encrypted: encrypt(TEST_EMAIL), tenant_phone_encrypted: encrypt('07700300003'), rent_share_amount: 1100, is_active: true }
    ]);
    console.log('  Created tenancy: Notice Given - E1 6AN');
  }

  // Tenancy 4: Ended
  const tenancy4Id = uuidv4();
  const { error: t4Error } = await supabase.from('tenancies').insert({
    id: tenancy4Id,
    company_id: COMPANY_ID,
    property_id: properties[2].id,
    landlord_id: landlords[1].id,
    reference_number: generateTenancyRef(),
    status: 'ended',
    rent_amount: 950,
    deposit_amount: 950,
    tenancy_start_date: new Date(Date.now() - 400*24*60*60*1000).toISOString().split('T')[0],
    tenancy_end_date: new Date(Date.now() - 35*24*60*60*1000).toISOString().split('T')[0],
    actual_end_date: new Date(Date.now() - 35*24*60*60*1000).toISOString().split('T')[0],
    rent_due_day: 25,
    deposit_protected_at: new Date(Date.now() - 395*24*60*60*1000).toISOString(),
    deposit_scheme: 'MyDeposits',
    deposit_reference: 'MYD-11223344',
    initial_monies_paid: true,
    property_address_encrypted: encrypt('221B Maple Road, Manchester, M20 1AA'),
    property_postcode_encrypted: encrypt('M20 1AA'),
    created_by: USER_ID
  });
  if (t4Error) console.error('Error creating tenancy 4:', t4Error.message);
  else {
    await supabase.from('tenancy_tenants').insert([
      { id: uuidv4(), tenancy_id: tenancy4Id, tenant_name_encrypted: encrypt('Paul Yellow'), tenant_email_encrypted: encrypt(TEST_EMAIL), tenant_phone_encrypted: encrypt('07700300004'), rent_share_amount: 950, is_active: false }
    ]);
    console.log('  Created tenancy: Ended - M20 1AA');
  }

  console.log('\n✅ Seed data creation complete!');
  console.log('\nSummary:');
  console.log('- 3 Landlords (James Wilson, Sarah Thompson, Robert Brown)');
  console.log('- 5 Properties (Baker St, Privet Dr, Maple Rd, Elm Grove, Station Rd)');
  console.log('- 4 Tenant Offers (pending, approved, declined, holding_deposit_received)');
  console.log('- 5 References (pending, in_progress x2, pending_verification, completed)');
  console.log('- 4 Tenancies (draft, agreement_signed, notice_given, ended)');
  console.log('\nAll emails set to: info@propertygoose.co.uk');
}

seedData().catch(console.error);
