/**
 * Script to create Patrick James Property Management account with two branches
 * Run with: npx ts-node scripts/create-patrick-james-account.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { encrypt } from '../src/services/encryption'

dotenv.config()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function createPatrickJamesAccount() {
  const email = 'matthewryder1095@gmail.com'
  const password = 'TempPassword123!' // They should change this

  console.log('Creating Patrick James Property Management account...\n')

  // Step 1: Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  let user = existingUsers?.users.find(u => u.email === email)

  if (user) {
    console.log(`User ${email} already exists with ID: ${user.id}`)
  } else {
    // Create user
    const { data: newUser, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        is_invited: true // Skip onboarding
      }
    })

    if (userError) {
      console.error('Error creating user:', userError)
      return
    }

    user = newUser.user
    console.log(`Created user ${email} with ID: ${user.id}`)
  }

  // Step 2: Remove any existing company_users for this user (clean slate)
  const { error: deleteError } = await supabase
    .from('company_users')
    .delete()
    .eq('user_id', user.id)

  if (deleteError) {
    console.error('Error cleaning up existing company_users:', deleteError)
  } else {
    console.log('Cleaned up any existing company associations')
  }

  // Step 3: Create Bristol Student branch
  const bristolStudentName = encrypt('Patrick James - Bristol Student')
  const { data: bristolStudent, error: bsError } = await supabase
    .from('companies')
    .insert({
      name_encrypted: bristolStudentName,
      onboarding_completed: true,
      onboarding_step: 5,
      reference_credits: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (bsError) {
    console.error('Error creating Bristol Student company:', bsError)
    return
  }
  console.log(`Created "Patrick James - Bristol Student" with ID: ${bristolStudent.id}`)

  // Step 4: Create Bristol Residential branch
  const bristolResidentialName = encrypt('Patrick James - Bristol Residential')
  const { data: bristolResidential, error: brError } = await supabase
    .from('companies')
    .insert({
      name_encrypted: bristolResidentialName,
      onboarding_completed: true,
      onboarding_step: 5,
      reference_credits: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (brError) {
    console.error('Error creating Bristol Residential company:', brError)
    return
  }
  console.log(`Created "Patrick James - Bristol Residential" with ID: ${bristolResidential.id}`)

  // Step 5: Link user to both companies as owner
  const { error: link1Error } = await supabase
    .from('company_users')
    .insert({
      user_id: user.id,
      company_id: bristolStudent.id,
      role: 'owner',
      created_at: new Date().toISOString()
    })

  if (link1Error) {
    console.error('Error linking user to Bristol Student:', link1Error)
    return
  }
  console.log(`Linked user to Bristol Student as owner`)

  const { error: link2Error } = await supabase
    .from('company_users')
    .insert({
      user_id: user.id,
      company_id: bristolResidential.id,
      role: 'owner',
      created_at: new Date().toISOString()
    })

  if (link2Error) {
    console.error('Error linking user to Bristol Residential:', link2Error)
    return
  }
  console.log(`Linked user to Bristol Residential as owner`)

  console.log('\n✅ Setup complete!')
  console.log('\nAccount details:')
  console.log(`  Email: ${email}`)
  console.log(`  Password: ${password}`)
  console.log('\nBranches:')
  console.log(`  1. Patrick James - Bristol Student (ID: ${bristolStudent.id})`)
  console.log(`  2. Patrick James - Bristol Residential (ID: ${bristolResidential.id})`)
  console.log('\nThe user should see the branch selector on login.')
}

createPatrickJamesAccount().catch(console.error)
