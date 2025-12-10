/**
 * Test script to generate sample PDFs for all contract types
 * Run with: npx ts-node src/scripts/testPdfGeneration.ts
 */

import fs from 'fs'
import path from 'path'
import { pdfGenerationService, AgreementPDFData, TemplateType, Language } from '../services/pdfGenerationService'

const outputDir = path.join(__dirname, '../../test-pdfs')

// Sample test data with multiple parties
const createTestData = (templateType: TemplateType, language: Language, hasGuarantor: boolean): AgreementPDFData => ({
  templateType,
  language,
  propertyAddress: {
    line1: '123 Test Street',
    line2: 'Apartment 4B',
    city: 'Manchester',
    county: 'Greater Manchester',
    postcode: 'M1 1AA'
  },
  landlords: [
    {
      name: 'John Smith',
      address: {
        line1: '456 Landlord Lane',
        city: 'London',
        postcode: 'SW1A 1AA'
      }
    },
    {
      name: 'Jane Smith',
      address: {
        line1: '456 Landlord Lane',
        city: 'London',
        postcode: 'SW1A 1AA'
      }
    }
  ],
  tenants: [
    {
      name: 'Alice Johnson',
      address: {
        line1: '789 Previous Road',
        city: 'Birmingham',
        postcode: 'B1 1BB'
      }
    },
    {
      name: 'Bob Williams',
      address: {
        line1: '321 Old Street',
        city: 'Leeds',
        postcode: 'LS1 1CC'
      }
    }
  ],
  guarantors: hasGuarantor ? [
    {
      name: 'Charles Guarantor',
      address: {
        line1: '555 Safety Street',
        city: 'Bristol',
        postcode: 'BS1 1DD'
      }
    },
    {
      name: 'Diana Backer',
      address: {
        line1: '666 Support Avenue',
        city: 'Sheffield',
        postcode: 'S1 1EE'
      }
    }
  ] : [],
  depositAmount: 1200,
  rentAmount: 1200,
  tenancyStartDate: '2025-01-15',
  tenancyEndDate: '2026-01-14',
  rentDueDay: '1st',
  depositSchemeType: 'Custodial',
  permittedOccupiers: 'None',
  bankAccountName: 'Smith Properties Ltd',
  bankAccountNumber: '12345678',
  bankSortCode: '00-11-22',
  tenantEmail: 'alice.johnson@email.com',
  landlordEmail: 'john.smith@landlord.com',
  managementType: 'let_only',
  breakClause: 'Either party may terminate this agreement after the first 6 months by giving 2 months written notice.',
  specialClauses: 'No pets allowed without prior written consent from the Landlord.'
})

const templateTypes: TemplateType[] = ['dps', 'mydeposits', 'tds', 'no_deposit', 'reposit']
const languages: Language[] = ['english', 'welsh']

async function generateAllTestPdfs() {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  console.log('Starting PDF generation tests...\n')
  console.log(`Output directory: ${outputDir}\n`)

  const results: { name: string; success: boolean; error?: string }[] = []

  for (const language of languages) {
    for (const templateType of templateTypes) {
      // Skip Welsh no_deposit as it doesn't exist
      if (language === 'welsh' && templateType === 'no_deposit') {
        console.log(`Skipping ${language}/${templateType} - Welsh no_deposit template not available`)
        continue
      }

      for (const hasGuarantor of [false, true]) {
        const testName = `${language}_${templateType}${hasGuarantor ? '_guarantor' : ''}`
        const fileName = `${testName}.pdf`
        const filePath = path.join(outputDir, fileName)

        console.log(`Generating: ${testName}...`)

        try {
          const testData = createTestData(templateType, language, hasGuarantor)
          const pdfBuffer = await pdfGenerationService.generatePreviewPDF(testData)

          fs.writeFileSync(filePath, pdfBuffer)
          console.log(`  ✓ Created: ${fileName} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`)
          results.push({ name: testName, success: true })
        } catch (error: any) {
          console.error(`  ✗ Failed: ${fileName}`)
          console.error(`    Error: ${error.message}`)
          results.push({ name: testName, success: false, error: error.message })
        }
      }
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))

  const successful = results.filter(r => r.success)
  const failed = results.filter(r => !r.success)

  console.log(`\nSuccessful: ${successful.length}`)
  console.log(`Failed: ${failed.length}`)

  if (failed.length > 0) {
    console.log('\nFailed PDFs:')
    failed.forEach(f => {
      console.log(`  - ${f.name}: ${f.error}`)
    })
  }

  console.log(`\nPDFs saved to: ${outputDir}`)
}

// Run the tests
generateAllTestPdfs()
  .then(() => {
    console.log('\nTest complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Test failed with error:', error)
    process.exit(1)
  })
