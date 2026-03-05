import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'

async function checkIncomeIssue() {
  const referenceId = 'f3e801b3-f418-4f35-bc90-e9e537a922b3'

  console.log('=== CHECKING REFERENCE INCOME DATA ===\n')

  // Get tenant reference details
  const { data: reference } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', referenceId)
    .single()

  if (reference) {
    console.log('TENANT REFERENCE:')
    console.log(`Employment Type: ${reference.employment_type}`)
    console.log(`Compensation Type: ${reference.compensation_type}`)
    console.log(`Employment Is Hourly: ${reference.employment_is_hourly}`)
    console.log(`Employment Hours Per Month: ${reference.employment_hours_per_month}`)
    console.log(`Hourly Rate: ${reference.hourly_rate}`)

    if (reference.employment_salary_amount_encrypted) {
      const salary = decrypt(reference.employment_salary_amount_encrypted)
      console.log(`Employment Salary Amount: £${salary}`)
    }
  }

  // Get employer reference
  const { data: employerRef } = await supabase
    .from('employer_references')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  if (employerRef) {
    console.log('\n=== EMPLOYER REFERENCE ===')
    console.log(`Company: ${employerRef.company_name_encrypted ? decrypt(employerRef.company_name_encrypted) : 'N/A'}`)

    if (employerRef.annual_income_encrypted) {
      const income = decrypt(employerRef.annual_income_encrypted)
      console.log(`Annual Income (encrypted field): £${income}`)
    }

    if (employerRef.salary_amount_encrypted) {
      const salary = decrypt(employerRef.salary_amount_encrypted)
      console.log(`Salary Amount: £${salary}`)
    }

    console.log(`Compensation Type: ${employerRef.compensation_type}`)
    console.log(`Is Hourly: ${employerRef.is_hourly}`)
    console.log(`Hours Per Week: ${employerRef.hours_per_week}`)
    console.log(`Hourly Rate: ${employerRef.hourly_rate}`)
  }

  // Get accountant reference
  const { data: accountantRef } = await supabase
    .from('accountant_references')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  if (accountantRef) {
    console.log('\n=== ACCOUNTANT REFERENCE ===')
    console.log(`Firm: ${accountantRef.firm_name_encrypted ? decrypt(accountantRef.firm_name_encrypted) : 'N/A'}`)

    if (accountantRef.annual_turnover_encrypted) {
      const turnover = decrypt(accountantRef.annual_turnover_encrypted)
      console.log(`Annual Turnover: £${turnover}`)
    }

    if (accountantRef.annual_profit_encrypted) {
      const profit = decrypt(accountantRef.annual_profit_encrypted)
      console.log(`Annual Profit: £${profit}`)
    }

    if (accountantRef.estimated_monthly_income_encrypted) {
      const monthly = decrypt(accountantRef.estimated_monthly_income_encrypted)
      console.log(`Estimated Monthly Income: £${monthly}`)
      console.log(`Annual equivalent: £${Number(monthly) * 12}`)
    }

    console.log(`Years Trading: ${accountantRef.years_trading}`)
    console.log(`Submitted At: ${accountantRef.submitted_at || 'Not specified'}`)
  }

  // Calculate what hourly should be
  if (employerRef?.is_hourly && employerRef.hourly_rate && employerRef.hours_per_week) {
    const weeklyIncome = Number(employerRef.hourly_rate) * Number(employerRef.hours_per_week)
    const annualIncome = weeklyIncome * 52
    console.log('\n=== HOURLY CALCULATION ===')
    console.log(`Hourly Rate: £${employerRef.hourly_rate}/hour`)
    console.log(`Hours Per Week: ${employerRef.hours_per_week}`)
    console.log(`Weekly Income: £${weeklyIncome}`)
    console.log(`Annual Income (calculated): £${annualIncome}/year`)
  }
}

checkIncomeIssue()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Script failed:', error)
    process.exit(1)
  })
