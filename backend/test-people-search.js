/**
 * Test Creditsafe People/Director Search
 * See if we can use this for identity verification
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

async function testPeopleSearch(token) {
  console.log('=== Testing People/Director Search ===\n')

  // Test search for a person
  const searchParams = {
    countries: 'GB',
    firstName: 'John',
    lastName: 'Smith',
    dateOfBirth: '1980-01-01'
  }

  console.log('Searching for:', JSON.stringify(searchParams, null, 2))

  try {
    const response = await axios.get(`${API_URL}/people`, {
      params: searchParams,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    console.log('\n✅ Search successful!')
    console.log(`Total results: ${response.data.totalSize}`)
    console.log('\nFirst 2 results:')
    console.log(JSON.stringify(response.data.directors?.slice(0, 2) || [], null, 2))

    // Check what fields are available
    if (response.data.directors && response.data.directors.length > 0) {
      console.log('\n=== Available Fields ===')
      const firstPerson = response.data.directors[0]
      Object.keys(firstPerson).forEach(key => {
        console.log(`  - ${key}: ${typeof firstPerson[key]}`)
      })
    }

    return response.data

  } catch (error) {
    console.error('❌ Search failed:', error.response?.status, error.response?.data)
  }
}

async function testPeopleSearchVariations(token) {
  console.log('\n\n=== Testing Different Search Parameters ===\n')

  const tests = [
    { name: 'Just name', params: { countries: 'GB', firstName: 'David', lastName: 'Jones' } },
    { name: 'With DOB', params: { countries: 'GB', firstName: 'David', lastName: 'Jones', dateOfBirth: '1975-06-15' } },
    { name: 'With address', params: { countries: 'GB', firstName: 'David', lastName: 'Jones', localAddress: 'London' } },
    { name: 'Just DOB and country', params: { countries: 'GB', dateOfBirth: '1980-01-01' } }
  ]

  for (const test of tests) {
    console.log(`\nTest: ${test.name}`)
    console.log('Params:', JSON.stringify(test.params))

    try {
      const response = await axios.get(`${API_URL}/people`, {
        params: test.params,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      console.log(`  ✅ Results: ${response.data.totalSize || 0}`)
    } catch (error) {
      console.log(`  ❌ Error: ${error.response?.status} - ${error.response?.data?.message || 'Unknown'}`)
    }
  }
}

async function main() {
  try {
    console.log('Authenticating...')
    const token = await authenticate()
    console.log('✓ Authenticated\n')

    await testPeopleSearch(token)
    await testPeopleSearchVariations(token)

    console.log('\n\n=== Analysis ===')
    console.log('The /people endpoint searches for company directors.')
    console.log('This is NOT the same as identity verification for individuals.')
    console.log('\nFor tenant identity verification, you need:')
    console.log('  - /protect/idv (Protect KYC product) - NOT AVAILABLE')
    console.log('  - /consumers (Consumer credit reports) - May be available')
    console.log('\nRecommendation: Contact Creditsafe to enable KYC Protect')

  } catch (error) {
    console.error('Error:', error.message)
  }
}

main()
