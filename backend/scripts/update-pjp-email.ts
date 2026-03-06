/**
 * Script to update Patrick James Property owner email
 * Run with: npx ts-node scripts/update-pjp-email.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function updatePJPEmail() {
  const oldEmail = 'matthewryder1095@gmail.com'
  const newEmail = 'kayleigh@patrickjamesproperty.co.uk'

  console.log(`Updating PJP owner email from ${oldEmail} to ${newEmail}...\n`)

  // Step 1: Find the user
  const { data: users, error: listError } = await supabase.auth.admin.listUsers()

  if (listError) {
    console.error('Error listing users:', listError)
    return
  }

  const user = users?.users.find(u => u.email === oldEmail)

  if (!user) {
    console.error(`User with email ${oldEmail} not found`)
    return
  }

  console.log(`Found user with ID: ${user.id}`)

  // Step 2: Check their company associations (just for confirmation)
  const { data: companyUsers, error: cuError } = await supabase
    .from('company_users')
    .select('company_id, role')
    .eq('user_id', user.id)

  if (cuError) {
    console.error('Error fetching company associations:', cuError)
    return
  }

  console.log(`User has ${companyUsers?.length || 0} company associations (these will be preserved)`)

  // Step 3: Update the email
  const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      email: newEmail,
      email_confirm: true // Confirm the new email immediately
    }
  )

  if (updateError) {
    console.error('Error updating email:', updateError)
    return
  }

  console.log('\n✅ Email updated successfully!')
  console.log('\nNew account details:')
  console.log(`  Email: ${newEmail}`)
  console.log(`  User ID: ${user.id} (unchanged)`)
  console.log(`  Company associations: ${companyUsers?.length || 0} branches (unchanged)`)
  console.log('\nKayleigh can now log in with the new email.')
  console.log('Note: She may need to reset her password via "Forgot Password" if she doesn\'t know it.')
}

updatePJPEmail().catch(console.error)
