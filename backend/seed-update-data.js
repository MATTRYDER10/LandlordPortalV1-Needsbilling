const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const COMPANY_ID = 'd0ad3a14-9b07-4be8-91fb-98624e0d1c71';
const USER_ID = 'd8ec1676-5e6e-4a6e-b37d-3dbbb0f13023';

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

async function updateData() {
  console.log('Updating landlords and adding compliance docs...\n');

  // Get all landlords for this company
  const { data: landlords } = await supabase
    .from('landlords')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`Found ${landlords?.length || 0} landlords to update`);

  // Landlord details to apply
  const landlordDetails = [
    {
      title: 'Mr',
      first_name: 'James',
      last_name: 'Wilson',
      address_line1: '10 Victoria Road',
      address_line2: 'Flat 4',
      city: 'London',
      postcode: 'SW1A 1AA',
      country: 'United Kingdom',
      bank_name: 'James Wilson',
      bank_number: '12345678',
      bank_sort: '12-34-56'
    },
    {
      title: 'Mrs',
      first_name: 'Sarah',
      last_name: 'Thompson',
      address_line1: '25 Oak Avenue',
      address_line2: '',
      city: 'Manchester',
      postcode: 'M1 1AA',
      country: 'United Kingdom',
      bank_name: 'Sarah Thompson',
      bank_number: '87654321',
      bank_sort: '65-43-21'
    },
    {
      title: 'Dr',
      first_name: 'Robert',
      last_name: 'Brown',
      address_line1: '5 High Street',
      address_line2: 'Suite 12',
      city: 'Birmingham',
      postcode: 'B1 1AA',
      country: 'United Kingdom',
      bank_name: 'Robert Brown',
      bank_number: '11223344',
      bank_sort: '11-22-33'
    },
    {
      title: 'Ms',
      first_name: 'Emily',
      last_name: 'Davies',
      address_line1: '88 Queens Road',
      address_line2: '',
      city: 'Bristol',
      postcode: 'BS1 4AA',
      country: 'United Kingdom',
      bank_name: 'Emily Davies',
      bank_number: '99887766',
      bank_sort: '99-88-77'
    },
    {
      title: 'Mr',
      first_name: 'Michael',
      last_name: 'Taylor',
      address_line1: '42 Church Lane',
      address_line2: 'Ground Floor',
      city: 'Leeds',
      postcode: 'LS1 5PQ',
      country: 'United Kingdom',
      bank_name: 'Michael Taylor',
      bank_number: '55443322',
      bank_sort: '55-44-33'
    }
  ];

  // Update each landlord
  for (let i = 0; i < (landlords?.length || 0); i++) {
    const landlord = landlords[i];
    const details = landlordDetails[i] || landlordDetails[0];

    const { error } = await supabase
      .from('landlords')
      .update({
        title_encrypted: encrypt(details.title),
        first_name_encrypted: encrypt(details.first_name),
        last_name_encrypted: encrypt(details.last_name),
        residential_address_line1_encrypted: encrypt(details.address_line1),
        residential_address_line2_encrypted: encrypt(details.address_line2),
        residential_city_encrypted: encrypt(details.city),
        residential_postcode_encrypted: encrypt(details.postcode),
        residential_country_encrypted: encrypt(details.country),
        bank_account_name_encrypted: encrypt(details.bank_name),
        bank_account_number_encrypted: encrypt(details.bank_number),
        bank_sort_code_encrypted: encrypt(details.bank_sort)
      })
      .eq('id', landlord.id);

    if (error) {
      console.error(`Error updating landlord ${landlord.id}:`, error.message);
    } else {
      console.log(`  Updated landlord: ${details.first_name} ${details.last_name}`);
    }
  }

  // Get all properties for this company
  const { data: properties } = await supabase
    .from('properties')
    .select('id, postcode')
    .eq('company_id', COMPANY_ID);

  console.log(`\nFound ${properties?.length || 0} properties to add compliance docs`);

  // Compliance document types with dates
  const complianceDocs = [
    {
      tag: 'epc',
      file_name: 'EPC_Certificate.pdf',
      description: 'Energy Performance Certificate - Rating B',
      // Valid for 10 years, expires in 8 years
      daysFromNow: 8 * 365
    },
    {
      tag: 'gas',
      file_name: 'Gas_Safety_Certificate.pdf',
      description: 'Annual Gas Safety Certificate - CP12',
      // Valid for 1 year, expires in 10 months
      daysFromNow: 300
    },
    {
      tag: 'other',
      custom_tag_name: 'EICR',
      file_name: 'EICR_Electrical_Report.pdf',
      description: 'Electrical Installation Condition Report',
      // Valid for 5 years, expires in 4 years
      daysFromNow: 4 * 365
    },
    {
      tag: 'other',
      custom_tag_name: 'Insurance',
      file_name: 'Buildings_Insurance.pdf',
      description: 'Buildings Insurance Certificate',
      // Expires in 6 months
      daysFromNow: 180
    },
    {
      tag: 'inventory',
      file_name: 'Property_Inventory.pdf',
      description: 'Full property inventory with photographs',
      daysFromNow: null // No expiry
    }
  ];

  // Add compliance docs to each property
  for (const property of (properties || [])) {
    console.log(`  Adding docs to property: ${property.postcode}`);

    for (const doc of complianceDocs) {
      // Calculate expiry date if applicable
      let expiryNote = '';
      if (doc.daysFromNow) {
        const expiryDate = new Date(Date.now() + doc.daysFromNow * 24 * 60 * 60 * 1000);
        expiryNote = ` - Expires: ${expiryDate.toLocaleDateString('en-GB')}`;
      }

      const { error } = await supabase.from('property_documents').insert({
        id: uuidv4(),
        property_id: property.id,
        file_name: doc.file_name,
        file_path: `compliance/${property.id}/${doc.file_name}`,
        file_size: Math.floor(Math.random() * 500000) + 100000, // Random size 100KB-600KB
        file_type: 'application/pdf',
        tag: doc.tag,
        custom_tag_name: doc.custom_tag_name || null,
        description: doc.description + expiryNote,
        uploaded_at: new Date().toISOString(),
        uploaded_by: USER_ID,
        source_type: 'manual'
      });

      if (error) {
        console.error(`    Error adding ${doc.file_name}:`, error.message);
      }
    }
  }

  console.log('\n✅ Update complete!');
  console.log('\nUpdated:');
  console.log(`- ${landlords?.length || 0} landlords with full address and bank details`);
  console.log(`- ${properties?.length || 0} properties with 5 compliance documents each`);
}

updateData().catch(console.error);
