/**
 * Creditsafe API Test Script
 *
 * This script helps test the Creditsafe Connect API authentication and explore available endpoints.
 *
 * Usage:
 * 1. Set your credentials in backend/.env file
 * 2. Run: node backend/test-creditsafe.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const axios = require('axios')

const API_URL = process.env.CREDITSAFE_API_URL || 'https://connect.sandbox.creditsafe.com/v1'
const USERNAME = process.env.CREDITSAFE_USERNAME
const PASSWORD = process.env.CREDITSAFE_PASSWORD

async function testAuthentication() {
  console.log('=== Testing Creditsafe Authentication ===')
  console.log('API URL:', API_URL)
  console.log('Username:', USERNAME ? `${USERNAME.substring(0, 10)}...` : 'NOT SET')
  console.log('Password:', PASSWORD ? '***' : 'NOT SET')
  console.log()

  if (!USERNAME || !PASSWORD) {
    console.error('ERROR: CREDITSAFE_USERNAME and CREDITSAFE_PASSWORD must be set in .env file')
    process.exit(1)
  }

  try {
    console.log('Attempting to authenticate...')
    const response = await axios.post(`${API_URL}/authenticate`, {
      username: USERNAME,
      password: PASSWORD
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    })

    console.log('✓ Authentication successful!')
    console.log('Token received:', response.data.token ? `${response.data.token.substring(0, 50)}...` : 'No token')
    console.log('Full response:', JSON.stringify(response.data, null, 2))

    return response.data.token
  } catch (error) {
    console.error('✗ Authentication failed!')
    if (error.response) {
      console.error('Status:', error.response.status)
      console.error('Response:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('Error:', error.message)
    }
    throw error
  }
}

async function exploreEndpoints(token) {
  console.log('\n=== Exploring Available Endpoints ===')

  const endpointsToTest = [
    '/access/countries',
    '/protect/idv',
    '/protect/investigations',
    '/protect/profile',
    '/people',
    '/people/search',
    '/gb/consumers',
    '/consumers'
  ]

  for (const endpoint of endpointsToTest) {
    try {
      console.log(`\nTesting: ${endpoint}`)
      const response = await axios.get(`${API_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      console.log(`✓ ${endpoint} - Status: ${response.status}`)

      // For /access/countries, show full response to see available products
      if (endpoint === '/access/countries') {
        console.log('Full response:', JSON.stringify(response.data, null, 2))
      } else {
        console.log(`  Response preview:`, JSON.stringify(response.data).substring(0, 200))
      }
    } catch (error) {
      if (error.response) {
        console.log(`✗ ${endpoint} - Status: ${error.response.status}`)
        if (error.response.status === 404) {
          console.log(`  (Endpoint not found - this is expected for some endpoints)`)
        } else if (error.response.status === 400) {
          console.log(`  Error:`, error.response.data?.message || 'Bad request')
        } else {
          console.log(`  Error:`, JSON.stringify(error.response.data).substring(0, 100))
        }
      } else {
        console.log(`✗ ${endpoint} - Error: ${error.message}`)
      }
    }
  }
}

async function testKYCSearch(token) {
  console.log('\n=== Testing KYC/Identity Verification Search ===')

  // Example person search request
  const searchPayload = {
    name: {
      firstName: 'John',
      lastName: 'Smith'
    },
    address: {
      street: '123 Test Street',
      city: 'London',
      postcode: 'SW1A 1AA',
      country: 'GB'
    },
    dateOfBirth: '1990-01-01'
  }

  const endpointsToTry = [
    { method: 'POST', path: '/protect/idv', payload: searchPayload },
    { method: 'POST', path: '/protect/investigations', payload: searchPayload },
    { method: 'POST', path: '/people/search', payload: searchPayload },
    { method: 'GET', path: '/protect/idv', payload: null }
  ]

  for (const { method, path, payload } of endpointsToTry) {
    try {
      console.log(`\nTrying ${method} ${path}`)

      const config = {
        method,
        url: `${API_URL}${path}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }

      if (payload) {
        config.data = payload
      }

      const response = await axios(config)
      console.log(`✓ Success! Status: ${response.status}`)
      console.log('Response:', JSON.stringify(response.data, null, 2).substring(0, 500))

      // If successful, this is likely the correct endpoint
      console.log('\n⭐ THIS ENDPOINT WORKS! Use this for identity verification.')
      break
    } catch (error) {
      if (error.response) {
        console.log(`Status: ${error.response.status}`)
        if (error.response.status !== 404) {
          console.log('Error details:', JSON.stringify(error.response.data, null, 2).substring(0, 300))
        }
      }
    }
  }
}

// Main execution
async function main() {
  try {
    const token = await testAuthentication()

    if (token) {
      await exploreEndpoints(token)
      await testKYCSearch(token)

      console.log('\n=== Test Complete ===')
      console.log('Review the results above to identify the correct endpoint for identity verification.')
      console.log('Update creditsafeService.ts with the correct endpoint path.')
    }
  } catch (error) {
    console.error('\nTest failed:', error.message)
    process.exit(1)
  }
}

main()
