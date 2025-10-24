import credasService from './src/services/credasService'

async function testCredasAPI() {
  try {
    console.log('Testing Credas API Integration...\n')

    console.log('Creating Credas verification process for test tenant...')
    console.log('  First Name: John')
    console.log('  Last Name: Doe')
    console.log('  Email: john.doe@example.com')
    console.log('  Reference ID: ccdf7c77-9917-498e-a6fb-bc581d3e5916')
    console.log('\n')

    const processResponse = await credasService.createProcess(
      'John',
      'Doe',
      'john.doe@example.com',
      'ccdf7c77-9917-498e-a6fb-bc581d3e5916',
      '07123456789'
    )

    console.log('✅ Process created successfully!\n')
    console.log('Process Details:')
    console.log('  Process ID:', processResponse.id)
    console.log('  Entity ID:', processResponse.processActors[0]?.entityId)
    console.log('  First Name:', processResponse.processActors[0]?.firstName)
    console.log('  Surname:', processResponse.processActors[0]?.surname)
    console.log('  Email:', processResponse.processActors[0]?.emailAddress)
    console.log('\n')

    console.log('🎉 Credas integration is working!')
    console.log('\nNext steps to complete testing:')
    console.log('1. Use the frontend to request IDV for a real tenant reference')
    console.log('2. Tenant will receive a magic link via email')
    console.log('3. Tenant clicks the link and completes identity verification')
    console.log('4. Credas sends webhook to:', process.env.CREDAS_WEBHOOK_URL)
    console.log('5. System automatically stores results and PDF')

  } catch (error: any) {
    console.error('❌ Error testing Credas API:', error.message)
    if (error.response?.data) {
      console.error('\nAPI Error Response:', JSON.stringify(error.response.data, null, 2))
    }
    if (error.response?.status) {
      console.error('Status Code:', error.response.status)
    }
    process.exit(1)
  }
}

testCredasAPI()
