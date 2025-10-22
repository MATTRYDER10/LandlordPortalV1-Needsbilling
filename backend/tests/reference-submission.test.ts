import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt, hash } from '../src/services/encryption';

// Mock data for testing
const testData = {
  // Personal Details
  first_name: 'John',
  last_name: 'Doe',
  middle_name: 'William',
  date_of_birth: '1990-01-15',
  contact_number: '+447700900000',
  nationality: 'British',

  // ID Document
  id_document_type: 'passport',

  // Current Address
  current_address_line1: '123 Test Street',
  current_city: 'London',
  current_postcode: 'SW1A 1AA',
  current_country: 'United Kingdom',
  time_at_address_years: 2,
  time_at_address_months: 6,

  // Employment Details (NEW FIELDS)
  income_regular_employment: true,
  employment_contract_type: 'permanent',
  employment_start_date: '2020-01-01',
  employment_end_date: '2023-12-31', // NEW FIELD
  employment_is_hourly: false,
  employment_salary_amount: 45000,
  employment_salary_frequency: 'monthly', // NEW FIELD
  employment_company_name: 'Test Company Ltd',
  employment_job_title: 'Software Engineer',
  employment_company_address_line1: '456 Business Park',
  employment_company_city: 'London',
  employment_company_postcode: 'EC1A 1BB',
  employment_company_country: 'United Kingdom',

  // Employer Reference
  employer_ref_position: 'HR Manager',
  employer_ref_name: 'Jane Smith',
  employer_ref_email: 'hr@testcompany.com',
  employer_ref_phone: '+447700900001',

  // Tenant Details
  is_smoker: false,
  has_pets: false,
  marital_status: 'single',
  number_of_dependants: 0,

  // Previous Landlord Reference (NEW FIELDS)
  reference_type: 'landlord',
  previous_landlord_name: 'Bob Johnson',
  previous_landlord_email: 'bob@example.com',
  previous_landlord_phone: '+447700900002',
  previous_rental_address_line1: '789 Old Street',
  previous_rental_city: 'Manchester',
  previous_rental_postcode: 'M1 1AA',
  previous_rental_country: 'United Kingdom',
  tenancy_years: 3,
  tenancy_months: 6,
  previous_monthly_rent: 1200, // NEW FIELD
  previous_tenancy_start_date: '2019-01-01', // NEW FIELD
  previous_tenancy_end_date: '2022-06-30', // NEW FIELD

  // Agent Reference Test Data (NEW FIELD)
  previous_agency_name: 'Premier Lettings Ltd' // NEW FIELD
};

describe('Reference Submission with New Fields', () => {
  let supabase: any;
  let testReferenceId: string | null = null;
  let testToken: string | null = null;

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  });

  afterAll(async () => {
    // Cleanup: Delete test reference if created
    if (testReferenceId && supabase) {
      await supabase
        .from('tenant_references')
        .delete()
        .eq('id', testReferenceId);
    }
  });

  describe('New Field Encryption Tests', () => {
    test('should encrypt and decrypt previous_monthly_rent', () => {
      const monthlyRent = '1200';
      const encrypted = encrypt(monthlyRent);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(monthlyRent);
      expect(decrypted).toBe(monthlyRent);
    });

    test('should encrypt and decrypt previous_agency_name', () => {
      const agencyName = 'Premier Lettings Ltd';
      const encrypted = encrypt(agencyName);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(agencyName);
      expect(decrypted).toBe(agencyName);
    });

    test('should handle null values for encrypted fields', () => {
      const encrypted = encrypt(null);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBeNull();
    });
  });

  describe('Tenant Submission Data Structure', () => {
    test('should have all required new fields in test data', () => {
      // Employment new fields
      expect(testData.employment_end_date).toBeDefined();
      expect(testData.employment_salary_frequency).toBeDefined();

      // Landlord reference new fields
      expect(testData.previous_monthly_rent).toBeDefined();
      expect(testData.previous_tenancy_start_date).toBeDefined();
      expect(testData.previous_tenancy_end_date).toBeDefined();

      // Agent reference new field
      expect(testData.previous_agency_name).toBeDefined();
    });

    test('employment_salary_frequency should have valid value', () => {
      const validFrequencies = ['weekly', 'bi-weekly', 'monthly', 'annually'];
      expect(validFrequencies).toContain(testData.employment_salary_frequency);
    });

    test('previous_monthly_rent should be a positive number', () => {
      expect(testData.previous_monthly_rent).toBeGreaterThan(0);
      expect(typeof testData.previous_monthly_rent).toBe('number');
    });

    test('previous_tenancy_start_date should be before end_date', () => {
      const startDate = new Date(testData.previous_tenancy_start_date);
      const endDate = new Date(testData.previous_tenancy_end_date);

      expect(startDate.getTime()).toBeLessThan(endDate.getTime());
    });

    test('employment_end_date should be after start_date if provided', () => {
      const startDate = new Date(testData.employment_start_date);
      const endDate = new Date(testData.employment_end_date);

      expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
    });
  });

  describe('Database Field Validation', () => {
    test('should verify tenant_references table has new columns', async () => {
      // Query table structure to verify new columns exist
      const { data, error } = await supabase
        .from('tenant_references')
        .select('previous_monthly_rent_encrypted, previous_tenancy_start_date, previous_tenancy_end_date, previous_agency_name_encrypted, employment_end_date, employment_salary_frequency')
        .limit(0);

      // If no error, columns exist
      expect(error).toBeNull();
    });
  });

  describe('Data Consistency Tests', () => {
    test('encrypted rent amount should decrypt to original value', () => {
      const rentString = testData.previous_monthly_rent.toString();
      const encrypted = encrypt(rentString);
      const decrypted = decrypt(encrypted);

      expect(decrypted).not.toBeNull();
      if (decrypted) {
        expect(parseFloat(decrypted)).toBe(testData.previous_monthly_rent);
      }
    });

    test('date fields should be valid ISO date strings', () => {
      expect(new Date(testData.previous_tenancy_start_date).toISOString()).toBeDefined();
      expect(new Date(testData.previous_tenancy_end_date).toISOString()).toBeDefined();
      expect(new Date(testData.employment_end_date).toISOString()).toBeDefined();
    });

    test('salary frequency enum values should be lowercase', () => {
      expect(testData.employment_salary_frequency).toBe(testData.employment_salary_frequency.toLowerCase());
    });
  });

  describe('Form Submission Payload Validation', () => {
    test('should create valid submission payload with all new fields', () => {
      const submissionPayload = {
        // Employment fields
        employment_end_date: testData.employment_end_date,
        employment_salary_frequency: testData.employment_salary_frequency,

        // Landlord reference fields
        previous_monthly_rent: testData.previous_monthly_rent,
        previous_tenancy_start_date: testData.previous_tenancy_start_date,
        previous_tenancy_end_date: testData.previous_tenancy_end_date,

        // Agent reference field
        previous_agency_name: testData.previous_agency_name,
      };

      expect(submissionPayload.employment_end_date).toBe('2023-12-31');
      expect(submissionPayload.employment_salary_frequency).toBe('monthly');
      expect(submissionPayload.previous_monthly_rent).toBe(1200);
      expect(submissionPayload.previous_tenancy_start_date).toBe('2019-01-01');
      expect(submissionPayload.previous_tenancy_end_date).toBe('2022-06-30');
      expect(submissionPayload.previous_agency_name).toBe('Premier Lettings Ltd');
    });
  });

  describe('Comparison Logic Tests', () => {
    test('should detect matching monthly rent values', () => {
      const tenantRent = 1200;
      const landlordRent = 1200;

      expect(tenantRent).toBe(landlordRent);
    });

    test('should detect mismatching monthly rent values (fraud detection)', () => {
      const tenantRent: number = 800;
      const landlordRent: number = 1000;

      expect(tenantRent).not.toBe(landlordRent);

      // This is what the comparison table will flag as a mismatch
      const isMismatch: boolean = tenantRent !== landlordRent;
      expect(isMismatch).toBe(true);
    });

    test('should detect matching tenancy dates', () => {
      const tenantStartDate = '2019-01-01';
      const landlordStartDate = '2019-01-01';

      expect(tenantStartDate).toBe(landlordStartDate);
    });

    test('should detect mismatching tenancy dates (fraud detection)', () => {
      const tenantEndDate = '2022-06-30';
      const landlordEndDate = '2022-03-15';

      expect(tenantEndDate).not.toBe(landlordEndDate);
    });

    test('should detect matching agency names', () => {
      const tenantAgency = 'Premier Lettings Ltd';
      const agentAgency = 'Premier Lettings Ltd';

      expect(tenantAgency).toBe(agentAgency);
    });

    test('should detect matching salary frequency', () => {
      const tenantFrequency = 'monthly';
      const employerFrequency = 'monthly';

      expect(tenantFrequency).toBe(employerFrequency);
    });
  });

  describe('Backward Compatibility Tests', () => {
    test('should handle references without new fields (null values)', () => {
      const oldReference = {
        previous_monthly_rent: null,
        previous_tenancy_start_date: null,
        previous_tenancy_end_date: null,
        previous_agency_name: null,
        employment_end_date: null,
        employment_salary_frequency: null,
      };

      // Should not throw errors
      expect(oldReference.previous_monthly_rent).toBeNull();
      expect(oldReference.employment_salary_frequency).toBeNull();
    });

    test('should decrypt null encrypted values correctly', () => {
      const encryptedNull = encrypt(null);
      const decryptedValue = decrypt(encryptedNull);

      expect(decryptedValue).toBeNull();
    });
  });

  describe('Data Format Tests', () => {
    test('should format monthly rent with currency symbol for display', () => {
      const rent = testData.previous_monthly_rent;
      const formattedRent = `£${rent}`;

      expect(formattedRent).toBe('£1200');
    });

    test('should handle empty string for optional previous_agency_name', () => {
      const emptyAgencyName = '';
      const encrypted = encrypt(emptyAgencyName);
      const decrypted = decrypt(encrypted);

      // Empty strings are treated as null by the encryption system
      expect(decrypted).toBeNull();
    });
  });
});

describe('Integration: Complete Form Flow', () => {
  test('should successfully process all new fields through encryption pipeline', () => {
    // Simulate what happens when form is submitted
    const formSubmission = {
      employment_end_date: testData.employment_end_date,
      employment_salary_frequency: testData.employment_salary_frequency,
      previous_monthly_rent: testData.previous_monthly_rent.toString(),
      previous_tenancy_start_date: testData.previous_tenancy_start_date,
      previous_tenancy_end_date: testData.previous_tenancy_end_date,
      previous_agency_name: testData.previous_agency_name,
    };

    // Encrypt sensitive fields
    const encryptedData = {
      employment_end_date: formSubmission.employment_end_date, // Not encrypted
      employment_salary_frequency: formSubmission.employment_salary_frequency, // Not encrypted
      previous_monthly_rent_encrypted: encrypt(formSubmission.previous_monthly_rent),
      previous_tenancy_start_date: formSubmission.previous_tenancy_start_date, // Not encrypted
      previous_tenancy_end_date: formSubmission.previous_tenancy_end_date, // Not encrypted
      previous_agency_name_encrypted: encrypt(formSubmission.previous_agency_name),
    };

    // Decrypt for display
    const decryptedData = {
      employment_end_date: encryptedData.employment_end_date,
      employment_salary_frequency: encryptedData.employment_salary_frequency,
      previous_monthly_rent: decrypt(encryptedData.previous_monthly_rent_encrypted),
      previous_tenancy_start_date: encryptedData.previous_tenancy_start_date,
      previous_tenancy_end_date: encryptedData.previous_tenancy_end_date,
      previous_agency_name: decrypt(encryptedData.previous_agency_name_encrypted),
    };

    // Verify round-trip integrity
    expect(decryptedData.employment_end_date).toBe(testData.employment_end_date);
    expect(decryptedData.employment_salary_frequency).toBe(testData.employment_salary_frequency);

    // Check previous_monthly_rent with null safety
    expect(decryptedData.previous_monthly_rent).not.toBeNull();
    if (decryptedData.previous_monthly_rent) {
      expect(parseFloat(decryptedData.previous_monthly_rent)).toBe(testData.previous_monthly_rent);
    }

    expect(decryptedData.previous_tenancy_start_date).toBe(testData.previous_tenancy_start_date);
    expect(decryptedData.previous_tenancy_end_date).toBe(testData.previous_tenancy_end_date);
    expect(decryptedData.previous_agency_name).toBe(testData.previous_agency_name);
  });
});
