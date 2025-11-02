const agreementService = require('./dist/services/agreementService');

async function testDPSAgreement() {
  console.log('Testing DPS Agreement Generation...\n');

  const testData = {
    templateType: 'dps',
    propertyAddress: {
      line1: '26 Anson Place',
      line2: '',
      city: 'Plymouth',
      county: '',
      postcode: 'PL4 9DD'
    },
    landlords: [
      {
        name: 'Test Landlord',
        address: {
          line1: '123 Test Street',
          line2: '',
          city: 'Plymouth',
          county: '',
          postcode: 'PL1 1AA'
        }
      }
    ],
    tenants: [
      {
        name: 'Test Tenant',
        address: {
          line1: '26 Anson Place',
          line2: '',
          city: 'Plymouth',
          county: '',
          postcode: 'PL4 9DD'
        }
      }
    ],
    guarantors: [],
    depositAmount: 2000,
    rentAmount: 1000,
    tenancyStartDate: '2025-11-15',
    tenancyEndDate: '2026-11-14',
    rentDueDay: '1st',
    depositSchemeType: 'Custodial',
    permittedOccupiers: '',
    bankAccountName: 'Test Bank',
    bankAccountNumber: '12345678',
    bankSortCode: '123456',
    tenantEmail: 'tenant@test.com',
    landlordEmail: 'landlord@test.com',
    agentEmail: '',
    managementType: 'let_only',
    breakClause: '',
    specialClauses: ''
  };

  try {
    console.log('Generating DPS agreement with test data...');
    const service = new agreementService.AgreementService();
    const buffer = await service.generateAgreementDocx(testData);

    console.log('\n✅ SUCCESS! Agreement generated successfully');
    console.log(`Generated file size: ${buffer.length} bytes`);

    // Save the file for inspection
    const fs = require('fs');
    const outputPath = './test-output-dps.docx';
    fs.writeFileSync(outputPath, buffer);
    console.log(`\nOutput saved to: ${outputPath}`);

  } catch (error) {
    console.error('\n❌ FAILED! Error generating agreement:');
    console.error('Error:', error.message);

    if (error.properties) {
      console.error('\nError properties:', JSON.stringify(error.properties, null, 2));

      if (error.properties.errors) {
        console.error('\nDetailed errors:');
        error.properties.errors.forEach((err, index) => {
          console.error(`\nError ${index + 1}:`, JSON.stringify(err, null, 2));
        });
      }
    }

    process.exit(1);
  }
}

testDPSAgreement();
