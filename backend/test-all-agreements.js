// Load environment variables
require('dotenv').config();

const agreementService = require('./dist/services/agreementService');
const fs = require('fs');
const path = require('path');

// Test configuration for all template types
const TEST_CONFIGS = [
  {
    name: 'DPS Custodial (No Guarantor)',
    templateType: 'dps',
    depositSchemeType: 'Custodial',
    hasGuarantor: false
  },
  {
    name: 'DPS Insured (No Guarantor)',
    templateType: 'dps',
    depositSchemeType: 'Insured',
    hasGuarantor: false
  },
  {
    name: 'DPS Custodial (With Guarantor)',
    templateType: 'dps',
    depositSchemeType: 'Custodial',
    hasGuarantor: true
  },
  {
    name: 'MyDeposits Custodial (No Guarantor)',
    templateType: 'mydeposits',
    depositSchemeType: 'Custodial',
    hasGuarantor: false
  },
  {
    name: 'MyDeposits Insured (No Guarantor)',
    templateType: 'mydeposits',
    depositSchemeType: 'Insured',
    hasGuarantor: false
  },
  {
    name: 'MyDeposits Custodial (With Guarantor)',
    templateType: 'mydeposits',
    depositSchemeType: 'Custodial',
    hasGuarantor: true
  },
  {
    name: 'TDS Custodial (No Guarantor)',
    templateType: 'tds',
    depositSchemeType: 'Custodial',
    hasGuarantor: false
  },
  {
    name: 'TDS Insured (No Guarantor)',
    templateType: 'tds',
    depositSchemeType: 'Insured',
    hasGuarantor: false
  },
  {
    name: 'TDS Custodial (With Guarantor)',
    templateType: 'tds',
    depositSchemeType: 'Custodial',
    hasGuarantor: true
  },
  {
    name: 'NoDeposit (No Guarantor)',
    templateType: 'no_deposit',
    depositSchemeType: 'Custodial',
    hasGuarantor: false
  },
  {
    name: 'NoDeposit (With Guarantor)',
    templateType: 'no_deposit',
    depositSchemeType: 'Custodial',
    hasGuarantor: true
  },
  {
    name: 'REPOSIT (No Guarantor)',
    templateType: 'reposit',
    depositSchemeType: 'Custodial',
    hasGuarantor: false
  },
  {
    name: 'REPOSIT (With Guarantor)',
    templateType: 'reposit',
    depositSchemeType: 'Custodial',
    hasGuarantor: true
  }
];

function generateTestData(config) {
  const baseData = {
    templateType: config.templateType,
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
    guarantors: config.hasGuarantor ? [
      {
        name: 'Test Guarantor',
        address: {
          line1: '456 Guarantor Road',
          line2: '',
          city: 'Plymouth',
          county: '',
          postcode: 'PL2 2BB'
        }
      }
    ] : [],
    depositAmount: 2000,
    rentAmount: 1000,
    tenancyStartDate: '2025-11-15',
    tenancyEndDate: '2026-11-14',
    rentDueDay: '1st',
    depositSchemeType: config.depositSchemeType,
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

  return baseData;
}

async function testAgreement(config) {
  const testData = generateTestData(config);

  try {
    console.log(`\n📝 Testing: ${config.name}`);
    console.log(`   Template: ${config.templateType}`);
    console.log(`   Scheme: ${config.depositSchemeType}`);
    console.log(`   Guarantor: ${config.hasGuarantor ? 'Yes' : 'No'}`);

    const service = new agreementService.AgreementService();
    const buffer = await service.generateAgreementDocx(testData);

    // Save the file
    const outputDir = './test-outputs';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const filename = `${config.templateType}-${config.depositSchemeType}-${config.hasGuarantor ? 'guarantor' : 'no-guarantor'}.docx`;
    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, buffer);

    console.log(`   ✅ SUCCESS! (${buffer.length} bytes)`);
    console.log(`   Output: ${outputPath}`);

    return { success: true, config: config.name };

  } catch (error) {
    console.error(`   ❌ FAILED!`);
    console.error(`   Error: ${error.message}`);

    if (error.properties) {
      console.error('   Error details:', JSON.stringify(error.properties, null, 2));

      if (error.properties.errors) {
        console.error('   Detailed errors:');
        error.properties.errors.forEach((err, index) => {
          console.error(`   Error ${index + 1}:`, JSON.stringify(err, null, 2));
        });
      }
    }

    return { success: false, config: config.name, error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 Testing All Agreement Templates');
  console.log('===================================\n');

  const results = [];

  for (const config of TEST_CONFIGS) {
    const result = await testAgreement(config);
    results.push(result);
  }

  // Print summary
  console.log('\n\n📊 Test Summary');
  console.log('===============');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nTotal: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.config}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    console.log(`\nGenerated files saved in: ./test-outputs/`);
  }
}

runAllTests();
