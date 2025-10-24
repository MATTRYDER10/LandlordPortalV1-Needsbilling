import { supabase } from '../src/config/supabase'

async function addStaffUser(email: string, password: string, fullName: string) {
  try {
    console.log('Creating staff user...')

    // Step 1: Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Auto-confirm email
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      return
    }

    console.log('✓ Created auth user:', authData.user.id)

    // Step 2: Create staff user record
    const { data: staffData, error: staffError } = await supabase
      .from('staff_users')
      .insert({
        user_id: authData.user.id,
        full_name: fullName,
        email: email,
        is_active: true
      })
      .select()
      .single()

    if (staffError) {
      console.error('Error creating staff user record:', staffError)
      return
    }

    console.log('✓ Created staff user record:', staffData.id)
    console.log('\n✅ Staff user created successfully!')
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)
    console.log(`Full Name: ${fullName}`)
    console.log(`\nThey can now log in at: http://localhost:5173/staff/login`)

  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// Get arguments from command line
const args = process.argv.slice(2)

if (args.length < 3) {
  console.log('Usage: npm run add-staff-user <email> <password> <full-name>')
  console.log('Example: npm run add-staff-user john@example.com SecurePass123 "John Smith"')
  process.exit(1)
}

const [email, password, fullName] = args

addStaffUser(email, password, fullName)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
