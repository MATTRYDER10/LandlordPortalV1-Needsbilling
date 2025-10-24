/**
 * Comprehensive Creditsafe API Endpoint Discovery
 * Tests all known Creditsafe Connect API endpoints to find what's available
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

async function testAllEndpoints(token) {
  console.log('\n=== Testing ALL Known Creditsafe Endpoints ===\n')

  const endpoints = [
    // Access & Authentication
    { method: 'GET', path: '/access/countries', category: 'Access' },
    { method: 'GET', path: '/access/userinformation', category: 'Access' },

    // Company Search & Reports
    { method: 'GET', path: '/companies', category: 'Company Search', params: { countries: 'GB', name: 'test' } },
    { method: 'GET', path: '/companies/search', category: 'Company Search', params: { countries: 'GB', name: 'test' } },

    // People/Directors
    { method: 'GET', path: '/people', category: 'People', params: { countries: 'GB', firstName: 'John', lastName: 'Smith' } },
    { method: 'GET', path: '/people/search', category: 'People', params: { countries: 'GB', firstName: 'John', lastName: 'Smith' } },

    // Monitoring
    { method: 'GET', path: '/monitoring/portfolios', category: 'Monitoring' },
    { method: 'GET', path: '/monitoring/companies', category: 'Monitoring' },
    { method: 'GET', path: '/monitoring/events', category: 'Monitoring' },

    // Protect/KYC/Compliance
    { method: 'GET', path: '/protect/investigations', category: 'Protect/KYC' },
    { method: 'GET', path: '/protect/profile', category: 'Protect/KYC' },
    { method: 'GET', path: '/protect/idv', category: 'Protect/KYC' },
    { method: 'GET', path: '/compliance/searches', category: 'Protect/KYC' },
    { method: 'GET', path: '/kyc/searches', category: 'Protect/KYC' },
    { method: 'GET', path: '/kyc/protect/searches', category: 'Protect/KYC' },

    // Consumer Reports
    { method: 'GET', path: '/consumers', category: 'Consumer' },
    { method: 'GET', path: '/gb/consumers', category: 'Consumer' },
    { method: 'GET', path: '/consumerreports', category: 'Consumer' },

    // Bank Validation
    { method: 'GET', path: '/localSolutions/GB/bankValidation', category: 'Bank Validation' },
    { method: 'GET', path: '/bankvalidation', category: 'Bank Validation' },

    // Decision Engine
    { method: 'GET', path: '/decisionengine', category: 'Decision Engine' },

    // Fresh Investigations
    { method: 'GET', path: '/freshinvestigations', category: 'Fresh Investigations' },

    // Data Cleaning
    { method: 'GET', path: '/datacleaning', category: 'Data Cleaning' },
  ]

  const results = {
    working: [],
    notFound: [],
    badRequest: [],
    forbidden: [],
    other: []
  }

  for (const endpoint of endpoints) {
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
      }

      const response = await axios(config)

      results.working.push({
        ...endpoint,
        status: response.status,
        preview: JSON.stringify(response.data).substring(0, 100)
      })

      console.log(`✅ ${endpoint.category.padEnd(20)} | ${endpoint.method.padEnd(4)} ${endpoint.path}`)

    } catch (error) {
      if (error.response) {
        const status = error.response.status
        const info = { ...endpoint, status }

        if (status === 404) {
          results.notFound.push(info)
          console.log(`❌ ${endpoint.category.padEnd(20)} | ${endpoint.method.padEnd(4)} ${endpoint.path} - 404 Not Found`)
        } else if (status === 400) {
          results.badRequest.push(info)
          console.log(`⚠️  ${endpoint.category.padEnd(20)} | ${endpoint.method.padEnd(4)} ${endpoint.path} - 400 Bad Request (may need params)`)
        } else if (status === 403) {
          results.forbidden.push(info)
          console.log(`🔒 ${endpoint.category.padEnd(20)} | ${endpoint.method.padEnd(4)} ${endpoint.path} - 403 Forbidden (no access)`)
        } else {
          results.other.push({ ...info, error: error.response.data })
          console.log(`❓ ${endpoint.category.padEnd(20)} | ${endpoint.method.padEnd(4)} ${endpoint.path} - ${status} ${error.response.statusText}`)
        }
      }
    }
  }

  console.log('\n=== Summary ===\n')
  console.log(`✅ Working Endpoints: ${results.working.length}`)
  console.log(`⚠️  Bad Request (may work with proper params): ${results.badRequest.length}`)
  console.log(`🔒 Forbidden (no product access): ${results.forbidden.length}`)
  console.log(`❌ Not Found: ${results.notFound.length}`)

  if (results.working.length > 0) {
    console.log('\n=== ✅ Working Endpoints (These are available!) ===\n')
    results.working.forEach(e => {
      console.log(`${e.method} ${e.path}`)
      console.log(`  Category: ${e.category}`)
      console.log(`  Response preview: ${e.preview}...\n`)
    })
  }

  if (results.badRequest.length > 0) {
    console.log('\n=== ⚠️ Endpoints That May Work With Proper Parameters ===\n')
    results.badRequest.forEach(e => {
      console.log(`${e.method} ${e.path} (${e.category})`)
    })
  }

  return results
}

async function main() {
  try {
    console.log('=== Creditsafe Full Endpoint Discovery ===')
    console.log('API URL:', API_URL)
    console.log('Username:', USERNAME)
    console.log()

    if (!USERNAME || !PASSWORD) {
      console.error('ERROR: Set CREDITSAFE_USERNAME and CREDITSAFE_PASSWORD in backend/.env')
      process.exit(1)
    }

    console.log('Authenticating...')
    const token = await authenticate()
    console.log('✓ Authenticated successfully\n')

    const results = await testAllEndpoints(token)

    console.log('\n=== Next Steps ===')
    if (results.working.length === 0 && results.badRequest.length === 0) {
      console.log('⚠️  No endpoints are accessible - contact Creditsafe to enable products')
    } else if (results.working.length > 0) {
      console.log('✅ You have access to some endpoints!')
      console.log('   Check the working endpoints above to see what you can use')
    }

  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

main()
