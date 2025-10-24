import jwt from 'jsonwebtoken'
import axios from 'axios'

const JWT_SECRET = 'B7a2Bbkkw1x+pra+uPafqNHK5jwQJXatBnCYSrgvvvM='
const REFERENCE_ID = 'ccdf7c77-9917-498e-a6fb-bc581d3e5916'
const BASE_URL = 'http://localhost:3001'

// Generate a test JWT token
const token = jwt.sign(
  { userId: 'test-user-id', email: 'test@example.com' },
  JWT_SECRET,
  { expiresIn: '1h' }
)

console.log('Generated JWT Token:', token)
console.log('\n')

async function testCredasIntegration() {
  try {
    // 1. Request IDV verification
    console.log('1. Requesting IDV verification...')
    const requestResponse = await axios.post(
      `${BASE_URL}/api/references/${REFERENCE_ID}/request-idv`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    )
    console.log('✓ Request IDV Response:', JSON.stringify(requestResponse.data, null, 2))
    console.log('\n')

    // 2. Check IDV status
    console.log('2. Checking IDV status...')
    const statusResponse = await axios.get(
      `${BASE_URL}/api/references/${REFERENCE_ID}/idv-status`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    console.log('✓ IDV Status:', JSON.stringify(statusResponse.data, null, 2))
    console.log('\n')

    // 3. Get IDV results (will be null until completed)
    console.log('3. Getting IDV results...')
    const resultsResponse = await axios.get(
      `${BASE_URL}/api/references/${REFERENCE_ID}/idv-results`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    console.log('✓ IDV Results:', JSON.stringify(resultsResponse.data, null, 2))

  } catch (error: any) {
    console.error('✗ Error:', error.response?.data || error.message)
    console.error('Status:', error.response?.status)
  }
}

testCredasIntegration()
