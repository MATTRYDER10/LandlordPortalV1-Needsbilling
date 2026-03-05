/**
 * Clause Enhancement Service
 * Uses Claude AI to convert rough clause text into formal UK tenancy agreement language
 */

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const SYSTEM_PROMPT = `You are a UK property law expert specializing in residential tenancy agreements. Your task is to convert rough, informal clause descriptions into formal, legally appropriate tenancy agreement language.

Guidelines:
1. Use formal UK English legal style
2. Be precise and unambiguous
3. Use "The Tenant" or "The Contract-Holder" (for Welsh contracts) as appropriate
4. Use "The Landlord" or "The Property" where appropriate
5. Keep clauses concise but comprehensive
6. Ensure clauses are enforceable and reasonable under UK law
7. Do not add excessive legalese - keep it readable
8. Return ONLY the enhanced clause text, no explanations or preamble

Examples of style:
- Input: "no smoking inside"
  Output: "The Tenant shall not smoke tobacco, e-cigarettes, or any other substance within the Property or any communal areas."

- Input: "pets allowed with extra deposit"
  Output: "The Tenant may keep domestic pets at the Property subject to the Landlord's prior written consent and payment of an additional pet deposit as specified in this Agreement."

- Input: "professional clean at end"
  Output: "The Tenant shall ensure that the Property is professionally cleaned to a standard consistent with the inventory report at the commencement of the tenancy, prior to the termination of this Agreement. Receipts for such cleaning must be provided to the Landlord or Agent."

- Input: "white goods no repair"
  Output: "The white goods and appliances provided at the Property are supplied on an 'as seen' basis. The Landlord shall not be responsible for the repair or replacement of these items during the tenancy. The Tenant accepts the condition of these items at the commencement of the tenancy."

Important: Return ONLY the enhanced clause text. Do not include any introduction, explanation, or commentary.`

export interface EnhanceClauseResult {
  success: boolean
  enhancedText?: string
  error?: string
}

export interface EnhanceClausesResult {
  success: boolean
  enhancedClauses?: string[]
  error?: string
}

/**
 * Enhance a single rough clause into formal UK tenancy agreement language
 */
export async function enhanceClause(roughText: string): Promise<EnhanceClauseResult> {
  if (!roughText?.trim()) {
    return { success: false, error: 'No clause text provided' }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: 'AI service not configured' }
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Convert this rough clause into formal UK tenancy agreement language:\n\n"${roughText.trim()}"`
        }
      ]
    })

    // Extract text from response
    const textContent = message.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return { success: false, error: 'No response from AI service' }
    }

    const enhancedText = textContent.text.trim()

    // Basic validation - ensure we got something back
    if (!enhancedText || enhancedText.length < 10) {
      return { success: false, error: 'AI returned invalid response' }
    }

    return { success: true, enhancedText }
  } catch (error: any) {
    console.error('Clause enhancement error:', error)
    return {
      success: false,
      error: error.message || 'Failed to enhance clause'
    }
  }
}

/**
 * Enhance multiple clauses at once, keeping them separate
 */
export async function enhanceClauses(roughClauses: string[]): Promise<EnhanceClausesResult> {
  if (!roughClauses || roughClauses.length === 0) {
    return { success: false, error: 'No clauses provided' }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: 'AI service not configured' }
  }

  // Filter out empty clauses
  const validClauses = roughClauses.filter(c => c?.trim())
  if (validClauses.length === 0) {
    return { success: false, error: 'No valid clauses provided' }
  }

  try {
    // Build numbered list for the prompt
    const numberedList = validClauses
      .map((clause, i) => `${i + 1}. "${clause.trim()}"`)
      .join('\n')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPT + `

IMPORTANT: When given multiple clauses, you must return them as a JSON array of strings.
Each clause should be enhanced separately and returned in the same order.
Return ONLY the JSON array, no other text.

Example input:
1. "no smoking"
2. "pets allowed"

Example output:
["The Tenant shall not smoke tobacco, e-cigarettes, or any other substance within the Property or any communal areas.", "The Tenant may keep domestic pets at the Property subject to the Landlord's prior written consent."]`,
      messages: [
        {
          role: 'user',
          content: `Convert these rough clauses into formal UK tenancy agreement language. Return as a JSON array of strings:\n\n${numberedList}`
        }
      ]
    })

    // Extract text from response
    const textContent = message.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return { success: false, error: 'No response from AI service' }
    }

    const responseText = textContent.text.trim()

    // Parse JSON array
    try {
      const enhancedClauses = JSON.parse(responseText)
      if (!Array.isArray(enhancedClauses)) {
        throw new Error('Response is not an array')
      }

      // Validate we got the right number of clauses
      if (enhancedClauses.length !== validClauses.length) {
        console.warn(`Expected ${validClauses.length} clauses, got ${enhancedClauses.length}`)
      }

      return { success: true, enhancedClauses }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', responseText)
      return { success: false, error: 'Failed to parse AI response' }
    }
  } catch (error: any) {
    console.error('Clauses enhancement error:', error)
    return {
      success: false,
      error: error.message || 'Failed to enhance clauses'
    }
  }
}
