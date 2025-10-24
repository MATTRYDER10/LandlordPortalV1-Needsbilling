/**
 * Test Creditsafe Verify API endpoints
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const axios = require('axios')

const API_URL = process.env.CREDITSAFE_API_URL || 'https://connect.sandbox.creditsafe.com/v1'
const USERNAME = process.env.CREDITSAFE_USERNAME
const PASSWORD = process.env.CREDITSAFE_PASSWORD

async function authenticate() {
  const response = await axios.post(`${API_URL}/authenticate`, {
    username: USERNAME,
    password: PASSWORD
  })
  return response.data.token
}

async function testVerifyEndpoints(token) {
  console.log('=== Testing Creditsafe Verify API Endpoints ===\n')
  console.log('Allowed reasonForSearch codes: AM, AV, BS, CA, DC, DS, EC, GI, QS, TV, GC, SA, IA')
  console.log('Trying TV (likely = Tenant Vetting)\n')

  const endpoints = [
    {
      name: 'Verify Company',
      method: 'GET',
      path: '/localSolutions/GB/verify/company/GB-0-12345678',
      description: 'Check if company verification is available',
      params: {
        reasonForSearch: 'TV'  // TV = Tenant Vetting (educated guess)
      }
    },
    {
      name: 'Direct Individual Report',
      method: 'GET',
      path: '/localSolutions/GB/verify/individual/directReport',
      description: 'Get individual report directly with full params',
      params: {
        firstName: 'John',
        lastName: 'Smith',
        dateOfBirth: '1980-01-01',
        address: '10 Downing Street',
        postCode: 'SW1A 2AA',
        reasonForSearch: 'TV'  // TV = Tenant Vetting
      }
    },
    {
      name: 'Individual Summary by ID',
      method: 'GET',
      path: '/localSolutions/GB/verify/individual/GB-927741590/summary',
      description: 'Get summary for a known director ID',
      params: {
        reasonForSearch: 'TV'  // TV = Tenant Vetting
      }
    },
    {
      name: 'Individual Full Report by ID',
      method: 'GET',
      path: '/localSolutions/GB/verify/individual/GB-927741590/full',
      description: 'Get full report for a known director ID',
      params: {
        reasonForSearch: 'TV'  // TV = Tenant Vetting
      }
    }
  ]

  for (const endpoint of endpoints) {
    console.log(`\n--- ${endpoint.name} ---`)
    console.log(`Description: ${endpoint.description}`)
    console.log(`Endpoint: ${endpoint.method} ${endpoint.path}`)

    try {
      const config = {
        method: endpoint.method,
        url: `${API_URL}${endpoint.path}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }

      if (endpoint.params) {
        config.params = endpoint.params
        console.log('Params:', JSON.stringify(endpoint.params))
      }

      const response = await axios(config)

      console.log(`✅ Status: ${response.status}`)
      console.log('Response:', JSON.stringify(response.data, null, 2).substring(0, 500))

    } catch (error) {
      if (error.response) {
        console.log(`❌ Status: ${error.response.status}`)

        if (error.response.status === 404) {
          console.log('   Reason: Endpoint not found (product not enabled)')
        } else if (error.response.status === 403) {
          console.log('   Reason: No access to this product')
        } else if (error.response.status === 400) {
          console.log('   Reason: Bad request (may need different parameters)')
          console.log('   Error:', JSON.stringify(error.response.data, null, 2))
        } else {
          console.log('   Error:', JSON.stringify(error.response.data, null, 2).substring(0, 300))
        }
      } else {
        console.log(`❌ Error: ${error.message}`)
      }
    }
  }

  console.log('\n\n=== Analysis ===')
  console.log('The Verify API is designed for:')
  console.log('  ✅ Checking company directors associated with businesses')
  console.log('  ✅ Electoral roll, CCJ, insolvency checks for directors')
  console.log('  ✅ Assessing individuals in a business context')
  console.log('\nIt is NOT designed for:')
  console.log('  ❌ General tenant identity verification')
  console.log('  ❌ Document verification (passport, driving license)')
  console.log('  ❌ PEP/sanctions screening for general public')
  console.log('\nFor tenant verification, you may need a different Creditsafe product')
  console.log('or a specialized identity verification provider (e.g., GBG, Onfido, Jumio)')
}

async function main() {
  try {
    console.log('Authenticating...')
    const token = await authenticate()
    console.log('✓ Authenticated\n')

    await testVerifyEndpoints(token)

  } catch (error) {
    console.error('Error:', error.message)
  }
}

main()
