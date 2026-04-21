/**
 * GooseBot Chat Service
 * Handles Claude Haiku conversations with tool_use for status lookups,
 * bug reporting, escalation, and document forwarding.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import { supabase } from '../config/supabase'
import { encrypt, decrypt, generateToken } from './encryption'
import { sendSMS } from './smsService'
import { sendEmail } from './emailService'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const GITHUB_REPO = 'CR88/PropertyGooseApp'

// Load knowledge base once at startup
const knowledgeBase = fs.readFileSync(
  path.join(__dirname, 'goosebot-knowledge.md'),
  'utf-8'
)

// ---------- System Prompts ----------

function buildAgentSystemPrompt(companyName: string): string {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return `You are GooseBot, PropertyGoose's friendly AI assistant. You're helping a letting agent from "${companyName}".

Today's date is ${today}. Use this to answer questions about "this month", "this week", "today", etc.

Your personality:
- Professional but approachable — like a knowledgeable colleague
- Concise and direct — agents are busy, don't waffle
- Proactive — if you look something up, present the results cleanly
- Honest — if you can't help, say so and offer to connect them with a human

You have tools to look up references, offers, and tenancies for this agent's company. Use them when the user asks about specific tenants, properties, or statuses. You can also call them with no filters to show recent data — do this when the user asks broad questions like "what offers came in today" or "show me all references".

IMPORTANT: You must NEVER discuss internal staff processes, verification queues, chase queues, or how PropertyGoose staff assess references. These are internal operations. If asked, say "PropertyGoose handles that for you behind the scenes" and redirect to what you can help with.

If the user is frustrated, confused, or asks to speak to a person, use the escalate_to_human tool immediately.

CRITICAL BUG REPORTING RULES:
- When a user mentions ANYTHING not working, broken, missing, erroring, or behaving unexpectedly, you MUST:
  1. First ask which page they're on and what they expected vs what happened (if not already clear)
  2. Then CALL the report_bug tool with full details — title, page, severity, description, and troubleshooting steps tried
  3. NEVER say "I've logged that" or "I've noted that" unless you have ACTUALLY called the report_bug tool
- Also offer troubleshooting tips alongside filing the report

CRITICAL OUTPUT RULES:
- NEVER expose your internal reasoning, thought process, or how tools work. The user should only see polished, human-sounding answers.
- NEVER say things like "the results show", "let me clarify", "from the tool response", "I can see there are X results but...". Just present the answer directly.
- NEVER mention tool names, tool calls, or how you found the data. Just present it as if you know it.
- When tool results contain more data than the user asked for, filter it yourself and only show what's relevant. Don't explain that you filtered.
- Never make up data. If a lookup returns no results, say so simply.
- Never share data from other companies.
- Keep responses short and clean — use bold for names, short bullet lists for multiple items.
- Sound like a helpful human colleague, not a robot reading out database results.

${knowledgeBase}`
}

function buildTenantSystemPrompt(tenantName: string, contextType: string): string {
  return `You are GooseBot, PropertyGoose's friendly AI assistant. You're helping ${tenantName || 'a tenant'} who is ${contextType === 'offer' ? 'submitting a rental offer' : 'completing their reference form'}.

Your personality:
- Warm, patient, and reassuring — tenants are often anxious about referencing
- Simple language — avoid jargon, explain things in plain English
- Encouraging — help them feel confident about completing their forms
- Helpful — guide them step by step if they're stuck

You have tools to check the status of their reference and see what's outstanding. Use them proactively when they ask about progress.

If they're stuck on the form, give clear step-by-step guidance based on your platform knowledge.

If you can't resolve their issue, or they ask for a human, use escalate_to_human immediately. Don't make them ask twice.

If they want to send a document or evidence, use the forward_document tool to get it to the back-office team.

CRITICAL OUTPUT RULES:
- NEVER expose your internal reasoning, thought process, or how you found information. Just present polished, friendly answers.
- NEVER mention tool names, tool calls, or database lookups. Present information as if you naturally know it.
- Never make up data. If a lookup returns no results, say so honestly.
- You can only see THIS tenant's reference/offer — never reveal other people's data.
- Keep responses short and friendly — 2-3 sentences unless they need step-by-step help.
- Sound like a warm, helpful human — not a chatbot reading out system data.
- If they mention a bug or something broken, use report_bug.

${knowledgeBase}`
}

// ---------- Tool Definitions ----------

const SHARED_TOOLS: Anthropic.Tool[] = [
  {
    name: 'report_bug',
    description: 'File a bug report to the development team. You MUST call this tool whenever the user reports something broken, not loading, not appearing, crashing, erroring, or not working as expected. NEVER say you have logged/noted/reported an issue without actually calling this tool first. Before calling, ask the user what page they are on and what they expected to happen vs what actually happened. Then call this tool with full details.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Clear, specific bug title (e.g. "Guarantor not appearing on References V2 page")' },
        page: { type: 'string', description: 'Which page/section of the app the user is on (e.g. "References V2", "Tenant Offers", "Dashboard")' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'low = cosmetic, medium = feature not working but workaround exists, high = feature broken no workaround, critical = data loss or security issue' },
        description: { type: 'string', description: 'Full description: what the user did, what they expected, what actually happened' },
        troubleshooting: { type: 'string', description: 'What has already been tried (e.g. refreshed page, tried different browser, logged out and back in)' },
      },
      required: ['title', 'page', 'severity', 'description'],
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Escalate this conversation to a human team member. Use when: (1) you cannot resolve the issue, (2) the user explicitly asks for a human, (3) the user is frustrated or upset, (4) it involves payments, refunds, or sensitive account issues.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string', description: 'Brief summary of why escalation is needed' },
        urgency: { type: 'string', enum: ['normal', 'critical'], description: 'critical for payment issues, data loss, or security concerns' },
      },
      required: ['reason', 'urgency'],
    },
  },
]

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'lookup_references',
    description: 'Look up tenant references. Call with no filters to get all recent references for this company. Optionally filter by tenant name, email, reference ID, or status. Use this for questions like "show me all references", "what references came in today", "how many references are in progress", "find Lisa Simpson\'s reference".',
    input_schema: {
      type: 'object' as const,
      properties: {
        tenant_name: { type: 'string', description: 'Filter by tenant first or last name (partial match)' },
        tenant_email: { type: 'string', description: 'Filter by tenant email address' },
        reference_id: { type: 'string', description: 'Look up a specific reference by UUID' },
        status: { type: 'string', description: 'Filter by status: SENT, COLLECTING_EVIDENCE, ACTION_REQUIRED, INDIVIDUAL_COMPLETE, GROUP_ASSESSMENT, ACCEPTED, REJECTED' },
      },
      required: [],
    },
  },
  {
    name: 'lookup_offers',
    description: 'Look up tenant offers. Call with no filters to get all recent offers for this company. Optionally filter by tenant name, property address, status, or date. Use this for questions like "what offers came in today", "show me pending offers", "any new offers", "what payments are we waiting for". Status values: pending (new, awaiting review), awaiting_payment (approved, waiting for holding deposit), marked_as_paid (tenant says paid, awaiting agent confirmation), deposit_received (confirmed paid), referencing (references in progress), sent (offer link sent), declined, withdrawn.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tenant_name: { type: 'string', description: 'Filter by tenant name (partial match)' },
        property_address: { type: 'string', description: 'Filter by property address (partial match)' },
        status: { type: 'string', description: 'Filter: pending, awaiting_payment, marked_as_paid, deposit_received, referencing, sent, declined, withdrawn' },
        created_since: { type: 'string', description: 'ISO date string — only return offers created on or after this date. Use for "today", "this week", etc. Example: 2026-04-21' },
      },
      required: [],
    },
  },
  {
    name: 'lookup_tenancies',
    description: 'Look up tenancies. Call with no filters to get recent tenancies for this company. Optionally filter by property address or tenant name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tenant_name: { type: 'string', description: 'Filter by tenant name' },
        property_address: { type: 'string', description: 'Filter by property address (partial match)' },
      },
      required: [],
    },
  },
  {
    name: 'lookup_landlords',
    description: 'Look up landlords for this company. Call with no filters to list all landlords. Optionally filter by name or AML status. AML statuses are: not_requested (never started), requested (link sent, awaiting completion), submitted (docs submitted, under review), passed/satisfactory (cleared), failed/unsatisfactory (failed checks). When user asks about "outstanding" or "incomplete" AML, that means anything NOT passed — call with no aml_status filter and report which ones are not passed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        landlord_name: { type: 'string', description: 'Filter by landlord name (partial match)' },
        aml_status: { type: 'string', description: 'Filter by exact AML status: not_requested, requested, submitted, passed, failed' },
      },
      required: [],
    },
  },
  {
    name: 'lookup_properties',
    description: 'Look up properties for this company. Returns property details, type, bedrooms, furnishing, status, linked landlords with AML status, special clauses, AND compliance records (gas safety, EPC, EICR, fire safety, etc.) with expiry dates and statuses. Use for ANY question about properties, compliance, certificates, landlords linked to properties, special clauses, or missing documents.',
    input_schema: {
      type: 'object' as const,
      properties: {
        address: { type: 'string', description: 'Filter by address or postcode (partial match)' },
        status: { type: 'string', description: 'Filter by status: vacant, in_tenancy' },
      },
      required: [],
    },
  },
  {
    name: 'lookup_agreements',
    description: 'Look up tenancy agreements for this company. Returns agreement details, signing status, clauses, and terms. Use for questions like "what agreements are pending signature", "show me the agreement for 9 Bilbie Road", "what special clauses are in this agreement".',
    input_schema: {
      type: 'object' as const,
      properties: {
        property_address: { type: 'string', description: 'Filter by property address (partial match)' },
        signing_status: { type: 'string', description: 'Filter: draft, pending_signatures, partially_signed, fully_signed, executed, cancelled' },
      },
      required: [],
    },
  },
  ...SHARED_TOOLS,
]

const TENANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'lookup_my_reference',
    description: 'Check the status of this tenant\'s reference — which sections are complete, what is outstanding, and what decisions have been made.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'lookup_my_chase_items',
    description: 'See what documents or referee responses are still outstanding for this reference.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'forward_document',
    description: 'Forward an uploaded document or message to the PropertyGoose back-office team for processing. Use when the tenant wants to send additional evidence or a document.',
    input_schema: {
      type: 'object' as const,
      properties: {
        document_description: { type: 'string', description: 'What the document is (e.g. "additional payslip", "landlord contact details")' },
      },
      required: ['document_description'],
    },
  },
  ...SHARED_TOOLS,
]

// ---------- Tool Implementations ----------

interface ToolContext {
  companyId?: string
  referenceId?: string
  conversationId: string
  userType: 'agent' | 'tenant' | 'guarantor'
  userIdentifier?: string
}

async function executeTool(
  toolName: string,
  toolInput: Record<string, any>,
  context: ToolContext
): Promise<string> {
  try {
    switch (toolName) {
      case 'lookup_references':
        return await lookupReferenceStatus(toolInput, context)
      case 'lookup_offers':
        return await lookupOfferStatus(toolInput, context)
      case 'lookup_chase_items':
        return await lookupChaseItems(toolInput.reference_id, context)
      case 'lookup_tenancies':
        return await lookupTenancy(toolInput, context)
      case 'lookup_landlords':
        return await lookupLandlords(toolInput, context)
      case 'lookup_properties':
        return await lookupProperties(toolInput, context)
      case 'lookup_agreements':
        return await lookupAgreements(toolInput, context)
      case 'lookup_my_reference':
        return await lookupMyReference(context)
      case 'lookup_my_chase_items':
        return await lookupMyChaseItems(context)
      case 'forward_document':
        return await forwardDocument(toolInput.document_description, context)
      case 'report_bug':
        return await reportBug(toolInput.title, toolInput, context)
      case 'escalate_to_human':
        return await escalateToHuman(toolInput.reason, toolInput.urgency, context)
      default:
        return `Unknown tool: ${toolName}`
    }
  } catch (err: any) {
    console.error(`[GooseBot] Tool ${toolName} error:`, err.message)
    return `Error executing ${toolName}: ${err.message}`
  }
}

async function lookupReferenceStatus(
  input: Record<string, any>,
  context: ToolContext
): Promise<string> {
  // CRITICAL: Agent queries MUST be scoped to their company
  if (context.userType === 'agent' && !context.companyId) {
    return 'Unable to look up references — no company context available.'
  }

  let query = supabase.from('tenant_references_v2').select('id, status, created_at, tenant_first_name_encrypted, tenant_last_name_encrypted, tenant_email_encrypted, property_address_encrypted')

  if (context.companyId) {
    query = query.eq('company_id', context.companyId)
  }

  if (input.reference_id) {
    query = query.eq('id', input.reference_id)
  }

  if (input.status) {
    query = query.eq('status', input.status.toUpperCase())
  }

  const { data: refs, error } = await query.order('created_at', { ascending: false }).limit(30)
  if (error || !refs?.length) return 'No references found.'

  // Filter by name/email after decryption (only if search criteria provided)
  let matches = refs
  if (input.tenant_name || input.tenant_email) {
    matches = refs.filter(r => {
      const firstName = decrypt(r.tenant_first_name_encrypted) || ''
      const lastName = decrypt(r.tenant_last_name_encrypted) || ''
      const fullName = `${firstName} ${lastName}`.trim()
      const email = decrypt(r.tenant_email_encrypted) || ''
      const searchName = (input.tenant_name || '').toLowerCase()
      const searchEmail = (input.tenant_email || '').toLowerCase()
      return (searchName && fullName.toLowerCase().includes(searchName)) ||
             (searchEmail && email.toLowerCase().includes(searchEmail))
    })
    if (!matches.length) return `No references found matching "${input.tenant_name || input.tenant_email}".`
  }

  // If looking up a specific reference (by ID or single name match), show full detail
  if (matches.length === 1 || input.reference_id) {
    const ref = matches[0]
    const firstName = decrypt(ref.tenant_first_name_encrypted) || ''
    const lastName = decrypt(ref.tenant_last_name_encrypted) || ''
    const refName = `${firstName} ${lastName}`.trim() || 'Unknown'
    const { data: sections } = await supabase
      .from('reference_sections_v2')
      .select('section_type, queue_status, decision')
      .eq('reference_id', ref.id)
      .order('section_order')

    let result = `**Reference for ${refName}**\n`
    result += `Status: ${formatStatus(ref.status)}\n`
    const propertyAddr = decrypt(ref.property_address_encrypted) || 'Not set'
    result += `Property: ${propertyAddr}\n`
    result += `Created: ${new Date(ref.created_at).toLocaleDateString('en-GB')}\n`
    result += `ID: ${ref.id}\n\n`

    if (sections?.length) {
      result += `**Sections:**\n`
      for (const s of sections) {
        const status = s.decision || s.queue_status
        result += `- ${formatSectionName(s.section_type)}: ${status}\n`
      }
    }

    if (matches.length > 1) {
      result += `\n(${matches.length - 1} more reference(s) also match — ask me to narrow down)`
    }
    return result
  }

  // Multiple results — show summary list
  const results = matches.slice(0, 10).map(r => {
    const firstName = decrypt(r.tenant_first_name_encrypted) || ''
    const lastName = decrypt(r.tenant_last_name_encrypted) || ''
    const name = `${firstName} ${lastName}`.trim() || 'Unknown'
    const date = new Date(r.created_at).toLocaleDateString('en-GB')
    const addr = decrypt(r.property_address_encrypted) || 'No address'
    return `- **${name}** — ${addr} | ${formatStatus(r.status)} | ${date}`
  })

  let summary = `**${matches.length} reference(s) found:**\n${results.join('\n')}`
  if (matches.length > 10) summary += `\n\n(Showing first 10 of ${matches.length} — ask me to filter by name, status, etc.)`
  return summary
}

async function lookupOfferStatus(
  input: Record<string, any>,
  context: ToolContext
): Promise<string> {
  // CRITICAL: Agent queries MUST be scoped to their company
  if (context.userType === 'agent' && !context.companyId) {
    return 'Unable to look up offers — no company context available.'
  }

  let query = supabase.from('tenant_offers').select('id, status, property_address, monthly_rent, move_in_date, holding_deposit_amount, tenant_first_name_encrypted, tenant_last_name_encrypted, tenant_email_encrypted, tenant_payment_confirmed_at, holding_deposit_received_at, created_at')

  if (context.companyId) {
    query = query.eq('company_id', context.companyId)
  }

  // Date filter
  if (input.created_since) {
    query = query.gte('created_at', input.created_since)
  }

  // Map user-friendly status to DB query
  if (input.status) {
    const s = input.status.toLowerCase()
    if (s === 'awaiting_payment') {
      query = query.eq('status', 'approved').is('tenant_payment_confirmed_at', null)
    } else if (s === 'marked_as_paid') {
      query = query.eq('status', 'approved').not('tenant_payment_confirmed_at', 'is', null)
    } else {
      query = query.eq('status', s)
    }
  }

  const { data: offers, error } = await query.order('created_at', { ascending: false }).limit(30)
  if (error || !offers?.length) return 'No offers found.'

  let matches = offers
  if (input.tenant_name || input.property_address) {
    matches = offers.filter(o => {
      const firstName = decrypt(o.tenant_first_name_encrypted) || ''
      const lastName = decrypt(o.tenant_last_name_encrypted) || ''
      const fullName = `${firstName} ${lastName}`.toLowerCase()
      const address = (o.property_address || '').toLowerCase()
      const searchName = (input.tenant_name || '').toLowerCase()
      const searchAddress = (input.property_address || '').toLowerCase()
      return (searchName && fullName.includes(searchName)) ||
             (searchAddress && address.includes(searchAddress))
    })
    if (!matches.length) return `No offers found matching "${input.tenant_name || input.property_address}".`
  }

  // Map DB status to display-friendly label
  function offerDisplayStatus(o: any): string {
    if (o.status === 'approved' && !o.tenant_payment_confirmed_at) return 'Awaiting Payment'
    if (o.status === 'approved' && o.tenant_payment_confirmed_at && !o.holding_deposit_received_at) return 'Marked as Paid'
    if (o.status === 'approved' && o.holding_deposit_received_at) return 'Deposit Received'
    const labels: Record<string, string> = {
      pending: 'Pending', sent: 'Sent', declined: 'Declined', withdrawn: 'Withdrawn',
      deposit_received: 'Deposit Received', referencing: 'Referencing',
    }
    return labels[o.status] || o.status
  }

  const results = matches.slice(0, 10).map(o => {
    const name = `${decrypt(o.tenant_first_name_encrypted) || ''} ${decrypt(o.tenant_last_name_encrypted) || ''}`.trim() || 'Unknown'
    const date = new Date(o.created_at).toLocaleDateString('en-GB')
    return `- **${name}** — ${o.property_address || 'No address'}\n  Status: ${offerDisplayStatus(o)} | Rent: £${o.monthly_rent || '?'}/mo | Move-in: ${o.move_in_date || 'TBC'} | ${date}`
  })

  let summary = `**${matches.length} offer(s):**\n${results.join('\n')}`
  if (matches.length > 10) summary += `\n\n(Showing first 10 of ${matches.length})`
  return summary
}

async function lookupChaseItems(
  referenceId: string | undefined,
  context: ToolContext
): Promise<string> {
  if (context.userType === 'agent' && !context.companyId) {
    return 'Unable to look up chase items — no company context available.'
  }

  if (referenceId) {
    // CRITICAL: Verify this reference belongs to the agent's company
    if (context.userType === 'agent') {
      const { data: ref } = await supabase
        .from('tenant_references_v2')
        .select('id')
        .eq('id', referenceId)
        .eq('company_id', context.companyId!)
        .single()

      if (!ref) return 'Reference not found in your company.'
    }

    const { data: items, error } = await supabase
      .from('chase_items_v2')
      .select('referee_type, status, chase_type, chase_count, initial_sent_at, last_chased_at, referee_name_encrypted, referee_email_encrypted')
      .eq('reference_id', referenceId)
      .not('status', 'eq', 'RECEIVED')

    if (error || !items?.length) return 'No outstanding chase items for this reference.'

    const results = items.map(i => formatChaseItem(i))
    return `**Outstanding chase items:**\n${results.join('\n')}`
  }

  // No reference_id — get ALL outstanding chase items for the company
  // Join through tenant_references_v2 to scope by company
  const { data: companyRefs } = await supabase
    .from('tenant_references_v2')
    .select('id, tenant_first_name_encrypted, tenant_last_name_encrypted')
    .eq('company_id', context.companyId!)
    .not('status', 'in', '("ACCEPTED","REJECTED","CANCELLED")')

  if (!companyRefs?.length) return 'No active references with outstanding chase items.'

  const refIds = companyRefs.map(r => r.id)
  const { data: items } = await supabase
    .from('chase_items_v2')
    .select('reference_id, referee_type, status, chase_type, chase_count, initial_sent_at, referee_name_encrypted')
    .in('reference_id', refIds)
    .not('status', 'eq', 'RECEIVED')
    .order('initial_sent_at', { ascending: true })
    .limit(20)

  if (!items?.length) return 'No outstanding chase items across your references.'

  // Group by reference
  const refMap = new Map(companyRefs.map(r => [r.id, r]))
  const results = items.map(i => {
    const ref = refMap.get(i.reference_id)
    const tenantName = ref
      ? `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim()
      : 'Unknown'
    const refereeName = decrypt(i.referee_name_encrypted) || 'Unknown'
    const hoursWaiting = i.initial_sent_at
      ? Math.round((Date.now() - new Date(i.initial_sent_at).getTime()) / 3600000)
      : 0
    return `- **${tenantName}** → ${i.referee_type} (${refereeName}) | ${i.status} | ${hoursWaiting}h waiting | Chased ${i.chase_count}x`
  })

  return `**${items.length} outstanding chase item(s):**\n${results.join('\n')}`
}

async function lookupTenancy(
  input: Record<string, any>,
  context: ToolContext
): Promise<string> {
  // CRITICAL: Agent queries MUST be scoped to their company
  if (context.userType === 'agent' && !context.companyId) {
    return 'Unable to look up tenancies — no company context available.'
  }

  let query = supabase.from('tenancies').select('id, monthly_rent, tenancy_start_date, holding_deposit_amount, status, property_id, created_at')

  if (context.companyId) {
    query = query.eq('company_id', context.companyId)
  }

  query = query.is('deleted_at', null)

  const { data: tenancies, error } = await query.order('created_at', { ascending: false }).limit(15)
  if (error || !tenancies?.length) return 'No tenancies found.'

  // Get property addresses for the tenancies
  const propertyIds = tenancies.map(t => t.property_id).filter(Boolean)
  let propertyMap = new Map<string, string>()
  if (propertyIds.length) {
    const { data: properties } = await supabase
      .from('properties')
      .select('id, address_line1_encrypted, city_encrypted, postcode')
      .in('id', propertyIds)
    if (properties) {
      propertyMap = new Map(properties.map(p => {
        const addr = decrypt(p.address_line1_encrypted) || ''
        const city = decrypt(p.city_encrypted) || ''
        return [p.id, `${addr}${city ? `, ${city}` : ''} ${p.postcode || ''}`.trim() || 'No address']
      }))
    }
  }

  let matches = tenancies
  if (input.property_address) {
    matches = tenancies.filter(t => {
      const addr = (t.property_id ? propertyMap.get(t.property_id) : '') || ''
      return addr.toLowerCase().includes((input.property_address || '').toLowerCase())
    })
    if (!matches.length) return `No tenancies found matching "${input.property_address}".`
  }

  const results = matches.slice(0, 10).map(t => {
    const addr = t.property_id ? propertyMap.get(t.property_id) || 'No address' : 'No address'
    const date = new Date(t.created_at).toLocaleDateString('en-GB')
    return `- **${addr}**\n  Rent: £${t.monthly_rent || '?'}/mo | Start: ${t.tenancy_start_date || 'TBC'} | Status: ${t.status || 'Draft'} | ${date}`
  })

  let summary = `**${matches.length} tenancy/ies:**\n${results.join('\n')}`
  if (matches.length > 10) summary += `\n\n(Showing first 10)`
  return summary
}

async function lookupLandlords(
  input: Record<string, any>,
  context: ToolContext
): Promise<string> {
  if (!context.companyId) return 'Unable to look up landlords — no company context available.'

  let query = supabase.from('landlords').select('id, first_name_encrypted, last_name_encrypted, email_encrypted, is_company, company_name_encrypted, aml_status, aml_completed_at, phone_encrypted, created_at')
    .eq('company_id', context.companyId)

  if (input.aml_status) {
    query = query.eq('aml_status', input.aml_status)
  }

  const { data: landlords, error } = await query.order('created_at', { ascending: false }).limit(30)
  if (error || !landlords?.length) return 'No landlords found.'

  let matches = landlords
  if (input.landlord_name) {
    matches = landlords.filter(l => {
      const firstName = decrypt(l.first_name_encrypted) || ''
      const lastName = decrypt(l.last_name_encrypted) || ''
      const companyName = decrypt(l.company_name_encrypted) || ''
      const fullName = `${firstName} ${lastName} ${companyName}`.toLowerCase()
      return fullName.includes((input.landlord_name || '').toLowerCase())
    })
    if (!matches.length) return `No landlords found matching "${input.landlord_name}".`
  }

  const results = matches.slice(0, 10).map(l => {
    const name = l.is_company
      ? decrypt(l.company_name_encrypted) || 'Unknown Company'
      : `${decrypt(l.first_name_encrypted) || ''} ${decrypt(l.last_name_encrypted) || ''}`.trim() || 'Unknown'
    const email = decrypt(l.email_encrypted) || ''
    const amlLabels: Record<string, string> = {
      'not_requested': 'Not Requested',
      'requested': 'Requested (awaiting)',
      'submitted': 'Submitted (under review)',
      'passed': 'Passed',
      'satisfactory': 'Passed',
      'failed': 'Failed',
      'unsatisfactory': 'Failed',
      'pending': 'Pending',
    }
    const aml = amlLabels[l.aml_status || ''] || l.aml_status || 'Not Requested'
    return `- **${name}** ${email ? `(${email})` : ''}\n  AML: ${aml}${l.aml_completed_at ? ` (completed ${new Date(l.aml_completed_at).toLocaleDateString('en-GB')})` : ''}`
  })

  let summary = `**${matches.length} landlord(s):**\n${results.join('\n')}`
  if (matches.length > 10) summary += `\n\n(Showing first 10)`
  return summary
}

async function lookupProperties(
  input: Record<string, any>,
  context: ToolContext
): Promise<string> {
  if (!context.companyId) return 'Unable to look up properties — no company context available.'

  let query = supabase.from('properties').select('id, postcode, address_line1_encrypted, address_line2_encrypted, city_encrypted, full_address_encrypted, property_type, number_of_bedrooms, furnishing_status, status, special_clauses, created_at')
    .eq('company_id', context.companyId)

  if (input.status) {
    query = query.eq('status', input.status)
  }

  const { data: properties, error } = await query.order('created_at', { ascending: false }).limit(50)
  if (error || !properties?.length) return 'No properties found.'

  let matches = properties
  if (input.address) {
    // Split search into individual words for flexible matching
    const searchWords = (input.address || '').toLowerCase().split(/\s+/).filter(Boolean)
    matches = properties.filter(p => {
      const addr1 = (decrypt(p.address_line1_encrypted) || '').toLowerCase()
      const addr2 = (decrypt(p.address_line2_encrypted) || '').toLowerCase()
      const city = (decrypt(p.city_encrypted) || '').toLowerCase()
      const fullAddr = (decrypt(p.full_address_encrypted) || '').toLowerCase()
      const postcode = (p.postcode || '').toLowerCase()
      const combined = `${addr1} ${addr2} ${city} ${fullAddr} ${postcode}`
      // All search words must appear somewhere in the combined address
      return searchWords.every((word: string) => combined.includes(word))
    })
    if (!matches.length) return `No properties found matching "${input.address}".`
  }

  // If single result, show full detail including clauses
  if (matches.length === 1) {
    const p = matches[0]
    const addr = decrypt(p.address_line1_encrypted) || 'Unknown'
    const city = decrypt(p.city_encrypted) || ''
    let result = `**${addr}${city ? `, ${city}` : ''} ${p.postcode || ''}**\n`
    result += `Type: ${p.property_type || 'Not set'} | Bedrooms: ${p.number_of_bedrooms || '?'} | Furnishing: ${p.furnishing_status || 'Not set'} | Status: ${p.status || 'Not set'}\n`

    if (p.special_clauses && Array.isArray(p.special_clauses) && p.special_clauses.length > 0) {
      result += `\n**Special clauses:**\n`
      for (const clause of p.special_clauses) {
        result += `- ${clause}\n`
      }
    } else {
      result += `\nNo special clauses set for this property.`
    }

    // Get linked landlords
    const { data: links } = await supabase
      .from('property_landlords')
      .select('landlord_id, is_primary')
      .eq('property_id', p.id)
    if (links?.length) {
      const llIds = links.map(l => l.landlord_id)
      const { data: lls } = await supabase
        .from('landlords')
        .select('id, first_name_encrypted, last_name_encrypted, is_company, company_name_encrypted, aml_status')
        .in('id', llIds)
      if (lls?.length) {
        result += `\n**Landlord(s):**\n`
        for (const ll of lls) {
          const llName = ll.is_company
            ? decrypt(ll.company_name_encrypted) || 'Unknown'
            : `${decrypt(ll.first_name_encrypted) || ''} ${decrypt(ll.last_name_encrypted) || ''}`.trim()
          const isPrimary = links.find(l => l.landlord_id === ll.id)?.is_primary
          result += `- ${llName}${isPrimary ? ' (primary)' : ''} — AML: ${ll.aml_status || 'not_requested'}\n`
        }
      }
    }

    // Get compliance records
    const { data: compliance } = await supabase
      .from('compliance_records')
      .select('compliance_type, custom_type_name, status, issue_date, expiry_date, certificate_number, issuer_name')
      .eq('property_id', p.id)
      .order('expiry_date', { ascending: true })

    if (compliance?.length) {
      result += `\n**Compliance:**\n`
      for (const c of compliance) {
        const typeName = c.custom_type_name || c.compliance_type || 'Unknown'
        const expiry = c.expiry_date ? new Date(c.expiry_date).toLocaleDateString('en-GB') : 'No expiry set'
        const statusLabel = c.status === 'expired' ? 'EXPIRED' : c.status === 'expiring_soon' ? 'EXPIRING SOON' : 'Valid'
        result += `- ${typeName}: ${statusLabel} (expires ${expiry})${c.certificate_number ? ` — Cert: ${c.certificate_number}` : ''}\n`
      }
    } else {
      result += `\n**Compliance:** No compliance records on file.`
    }

    return result
  }

  // Multiple results — summary list
  const results = matches.slice(0, 10).map(p => {
    const addr = decrypt(p.address_line1_encrypted) || 'Unknown'
    const city = decrypt(p.city_encrypted) || ''
    const clauseCount = Array.isArray(p.special_clauses) ? p.special_clauses.length : 0
    return `- **${addr}${city ? `, ${city}` : ''}** ${p.postcode || ''}\n  ${p.property_type || '?'} | ${p.number_of_bedrooms || '?'} bed | ${p.status || '?'}${clauseCount ? ` | ${clauseCount} special clause(s)` : ''}`
  })

  let summary = `**${matches.length} property/ies:**\n${results.join('\n')}`
  if (matches.length > 10) summary += `\n\n(Showing first 10)`
  return summary
}

async function lookupAgreements(
  input: Record<string, any>,
  context: ToolContext
): Promise<string> {
  if (!context.companyId) return 'Unable to look up agreements — no company context available.'

  let query = supabase.from('agreements').select('id, property_address, template_type, rent_amount, deposit_amount, tenancy_start_date, tenancy_end_date, signing_status, special_clauses, break_clause, tenants, landlords, created_at')
    .eq('company_id', context.companyId)

  if (input.signing_status) {
    query = query.eq('signing_status', input.signing_status)
  }

  const { data: agreements, error } = await query.order('created_at', { ascending: false }).limit(20)
  if (error || !agreements?.length) return 'No agreements found.'

  let matches = agreements
  if (input.property_address) {
    matches = agreements.filter(a => {
      const addr = typeof a.property_address === 'string' ? a.property_address : JSON.stringify(a.property_address || '')
      return addr.toLowerCase().includes((input.property_address || '').toLowerCase())
    })
    if (!matches.length) return `No agreements found matching "${input.property_address}".`
  }

  // Single result — show full detail
  if (matches.length === 1) {
    const a = matches[0]
    const agreeAddr = typeof a.property_address === 'string' ? a.property_address : JSON.stringify(a.property_address || 'Unknown')
    let result = `**Agreement — ${agreeAddr}**\n`
    result += `Type: ${a.template_type || '?'} | Status: ${a.signing_status}\n`
    result += `Rent: £${a.rent_amount || '?'}/mo | Deposit: £${a.deposit_amount || '?'}\n`
    result += `Start: ${a.tenancy_start_date || 'TBC'}${a.tenancy_end_date ? ` | End: ${a.tenancy_end_date}` : ' | Periodic'}\n`

    if (a.tenants && Array.isArray(a.tenants)) {
      result += `\n**Tenants:** ${a.tenants.map((t: any) => t.name || t.email || 'Unknown').join(', ')}\n`
    }

    if (a.special_clauses) {
      result += `\n**Special clauses:**\n${a.special_clauses}\n`
    }
    if (a.break_clause) {
      result += `\n**Break clause:**\n${a.break_clause}\n`
    }

    return result
  }

  // Multiple — summary list
  const results = matches.slice(0, 10).map(a => {
    const date = new Date(a.created_at).toLocaleDateString('en-GB')
    const listAddr = typeof a.property_address === 'string' ? a.property_address : JSON.stringify(a.property_address || 'Unknown')
    return `- **${listAddr}** | ${a.template_type || '?'} | ${a.signing_status} | ${date}`
  })

  let summary = `**${matches.length} agreement(s):**\n${results.join('\n')}`
  if (matches.length > 10) summary += `\n\n(Showing first 10)`
  return summary
}

async function lookupMyReference(context: ToolContext): Promise<string> {
  if (!context.referenceId) return 'I don\'t have your reference details in this context. Could you tell me your name or email so I can look it up?'

  const { data: ref } = await supabase
    .from('tenant_references_v2')
    .select('id, status, property_address_encrypted, created_at')
    .eq('id', context.referenceId)
    .single()

  if (!ref) return 'I couldn\'t find your reference. Please contact your letting agent for help.'

  const { data: sections } = await supabase
    .from('reference_sections_v2')
    .select('section_type, queue_status, decision')
    .eq('reference_id', ref.id)
    .order('section_order')

  const myPropertyAddr = decrypt(ref.property_address_encrypted)
  let result = `Here's where your reference stands:\n\n`
  result += `**Overall status:** ${formatStatus(ref.status)}\n`
  if (myPropertyAddr) result += `**Property:** ${myPropertyAddr}\n`
  result += `\n`

  if (sections?.length) {
    const complete = sections.filter(s => s.decision === 'PASS' || s.decision === 'PASS_WITH_CONDITION')
    const pending = sections.filter(s => !s.decision)

    result += `**${complete.length}/${sections.length} sections complete**\n\n`
    for (const s of sections) {
      const icon = s.decision === 'PASS' ? 'Done' : s.decision ? s.decision : 'In progress'
      result += `- ${formatSectionName(s.section_type)}: ${icon}\n`
    }
  }

  return result
}

async function lookupMyChaseItems(context: ToolContext): Promise<string> {
  if (!context.referenceId) return 'I don\'t have your reference details in this context.'

  const { data: items } = await supabase
    .from('chase_items_v2')
    .select('referee_type, status, chase_type')
    .eq('reference_id', context.referenceId)
    .not('status', 'eq', 'RECEIVED')

  if (!items?.length) return 'Great news — we\'ve received all the responses we need for your reference! No outstanding items.'

  const results = items.map(i => {
    const label = i.chase_type === 'TENANT'
      ? 'Your form submission'
      : `${formatSectionName(i.referee_type)} reference`
    return `- ${label}: waiting for response`
  })

  return `We're still waiting on:\n${results.join('\n')}\n\nIf you know your ${items[0].referee_type.toLowerCase()}, you could ask them to check their email (including spam folder) for a message from PropertyGoose.`
}

async function forwardDocument(
  description: string,
  context: ToolContext
): Promise<string> {
  // Get conversation context for the email
  const { data: convo } = await supabase
    .from('chat_conversations')
    .select('user_identifier, reference_id, offer_id')
    .eq('id', context.conversationId)
    .single()

  const userEmail = convo?.user_identifier ? decrypt(convo.user_identifier) : 'Unknown'

  await sendEmail({
    to: 'info@propertygoose.co.uk',
    subject: `[GooseBot] Document forwarded — ${description}`,
    html: `<p><strong>A tenant has sent additional information via GooseBot:</strong></p>
<p><strong>Description:</strong> ${description}</p>
<p><strong>Tenant:</strong> ${userEmail}</p>
<p><strong>Reference ID:</strong> ${convo?.reference_id || 'N/A'}</p>
<p><strong>Conversation ID:</strong> ${context.conversationId}</p>
<p>Please review and action as needed.</p>`,
  })

  return 'Document details forwarded to the PropertyGoose team. They\'ll review it shortly.'
}

async function reportBug(
  title: string,
  toolInput: Record<string, any>,
  context: ToolContext
): Promise<string> {
  const { page, severity, description, troubleshooting } = toolInput

  console.log('[GooseBot] report_bug called:', { title, page, severity })

  const token = process.env.GITHUB_ISSUES_TOKEN
  if (!token) {
    console.error('[GooseBot] GITHUB_ISSUES_TOKEN not set — cannot create issue')
    return 'Bug report noted. Our team will investigate.'
  }

  const severityEmoji: Record<string, string> = {
    critical: '🔴 Critical',
    high: '🟠 High',
    medium: '🟡 Medium',
    low: '🟢 Low',
  }

  const body = [
    `## User-Reported Bug`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| **Reported via** | GooseBot chat |`,
    `| **Page** | ${page || 'Not specified'} |`,
    `| **Severity** | ${severityEmoji[severity] || severity || 'Not specified'} |`,
    ``,
    `### Description`,
    ``,
    description || 'No description provided.',
    ``,
    troubleshooting ? `### Troubleshooting Already Tried\n\n${troubleshooting}\n` : '',
  ].filter(Boolean).join('\n')

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        title: `[USER] ${title}`,
        body,
        labels: ['bug', 'user-reported'],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GooseBot] GitHub API error:', response.status, errorText)
      return 'I\'ve noted the bug. Our team will investigate.'
    }

    const issue = await response.json() as { number: number }
    console.log('[GooseBot] GitHub issue created:', issue.number)
    return `Bug reported successfully (issue #${issue.number}). Our development team will investigate.`
  } catch (err: any) {
    console.error('[GooseBot] GitHub issue creation failed:', err.message)
    return 'I\'ve noted the bug. Our team will investigate.'
  }
}

async function escalateToHuman(
  reason: string,
  urgency: string,
  context: ToolContext
): Promise<string> {
  const staffToken = generateToken(32)

  // Update conversation status
  await supabase
    .from('chat_conversations')
    .update({
      status: 'waiting_for_human',
      escalation_reason: reason,
      human_staff_token: staffToken,
    })
    .eq('id', context.conversationId)

  // Get conversation context for the alert
  const { data: convo } = await supabase
    .from('chat_conversations')
    .select('user_identifier, user_type, reference_id, offer_id, company_id')
    .eq('id', context.conversationId)
    .single()

  const userDisplay = convo?.user_identifier ? decrypt(convo.user_identifier) : 'Unknown user'
  const urgencyLabel = urgency === 'critical' ? 'CRITICAL' : 'Normal'
  const chatUrl = `https://app.propertygoose.co.uk/chat/staff/${staffToken}`

  // Send SMS alerts
  const alertNumbers = (process.env.GOOSEBOT_ALERT_NUMBERS || '').split(',').filter(Boolean)
  const smsBody = `GooseBot ${urgencyLabel}: ${reason}\nUser: ${userDisplay} (${convo?.user_type || context.userType})\nJoin: ${chatUrl}`

  for (const number of alertNumbers) {
    await sendSMS({ to: number.trim(), body: smsBody })
  }

  // Send email alert
  const emailSubject = urgency === 'critical'
    ? `[CRITICAL] GooseBot escalation — ${reason}`
    : `GooseBot escalation — ${reason}`

  await sendEmail({
    to: 'info@propertygoose.co.uk',
    subject: emailSubject,
    html: `<h2>GooseBot Escalation</h2>
<p><strong>Urgency:</strong> ${urgencyLabel}</p>
<p><strong>Reason:</strong> ${reason}</p>
<p><strong>User:</strong> ${userDisplay} (${convo?.user_type || context.userType})</p>
<p><strong>Reference:</strong> ${convo?.reference_id || 'N/A'}</p>
<p><strong>Offer:</strong> ${convo?.offer_id || 'N/A'}</p>
<p><a href="${chatUrl}" style="display:inline-block;padding:12px 24px;background:#f97316;color:white;text-decoration:none;border-radius:8px;font-weight:bold;">Join Conversation</a></p>`,
  })

  return 'ESCALATED'
}

// ---------- Main Chat Function ----------

export interface ChatRequest {
  conversationId?: string
  message: string
  userType: 'agent' | 'tenant' | 'guarantor'
  companyId?: string
  referenceId?: string
  offerId?: string
  userIdentifier?: string
  userName?: string
}

export interface ChatResponse {
  conversationId: string
  reply: string
  status: string
  escalated?: boolean
}

export async function processMessage(req: ChatRequest): Promise<ChatResponse> {
  // Create or fetch conversation
  let conversationId: string = req.conversationId || ''
  let conversationStatus = 'active'

  if (!conversationId) {
    const { data: convo, error } = await supabase
      .from('chat_conversations')
      .insert({
        user_type: req.userType,
        user_identifier: req.userIdentifier ? encrypt(req.userIdentifier) : null,
        company_id: req.companyId || null,
        reference_id: req.referenceId || null,
        offer_id: req.offerId || null,
        status: 'active',
      })
      .select('id, status')
      .single()

    if (error || !convo) throw new Error('Failed to create conversation')
    conversationId = convo.id
    conversationStatus = convo.status
  } else {
    const { data: convo } = await supabase
      .from('chat_conversations')
      .select('id, status')
      .eq('id', conversationId)
      .single()

    if (!convo) throw new Error('Conversation not found')
    conversationStatus = convo.status
  }

  // If a human has joined, just save the message (human will respond)
  if (conversationStatus === 'human_joined') {
    await saveMessage(conversationId, 'user', req.message)
    return {
      conversationId,
      reply: '',
      status: 'human_joined',
    }
  }

  // Save user message
  await saveMessage(conversationId, 'user', req.message)

  // Load conversation history
  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20)

  // Build messages array for Haiku
  // Filter out tool call placeholders and system/human messages — only keep real user/assistant text
  const messages: Anthropic.MessageParam[] = (history || [])
    .filter(m =>
      (m.role === 'user' || m.role === 'assistant') &&
      m.content &&
      m.content !== '(tool call)'
    )
    .map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))
    // Ensure messages alternate user/assistant (Anthropic API requirement)
    .reduce<Anthropic.MessageParam[]>((acc, msg) => {
      if (acc.length === 0) return [msg]
      const last = acc[acc.length - 1]
      if (last.role === msg.role) {
        // Merge consecutive same-role messages
        last.content = `${last.content}\n\n${msg.content}`
        return acc
      }
      return [...acc, msg]
    }, [])

  // Choose system prompt and tools
  const isAgent = req.userType === 'agent'
  const systemPrompt = isAgent
    ? buildAgentSystemPrompt(req.userName || 'your company')
    : buildTenantSystemPrompt(req.userName || '', req.referenceId ? 'reference' : 'offer')
  const tools = isAgent ? AGENT_TOOLS : TENANT_TOOLS

  const toolContext: ToolContext = {
    companyId: req.companyId,
    referenceId: req.referenceId,
    conversationId,
    userType: req.userType,
    userIdentifier: req.userIdentifier,
  }

  // Call Haiku with tool_use loop
  let finalReply = ''
  let currentMessages = [...messages]
  let escalated = false

  for (let i = 0; i < 5; i++) { // max 5 tool rounds
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    })

    // Extract text and tool use blocks
    const textBlocks = response.content.filter(b => b.type === 'text')
    const toolBlocks = response.content.filter(b => b.type === 'tool_use')

    if (toolBlocks.length === 0) {
      // No tools — we have the final response
      finalReply = textBlocks.map(b => b.type === 'text' ? b.text : '').join('')
      break
    }

    // Execute tools and build tool results
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of toolBlocks) {
      if (block.type === 'tool_use') {
        const result = await executeTool(block.name, block.input as Record<string, any>, toolContext)

        if (block.name === 'escalate_to_human' && result === 'ESCALATED') {
          escalated = true
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        })
      }
    }

    // Log tool calls
    await saveMessage(conversationId, 'assistant', textBlocks.map(b => b.type === 'text' ? b.text : '').join('') || '(tool call)', toolBlocks)

    // Continue conversation with tool results
    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ]
  }

  // Save final reply (non-blocking — don't delay the response)
  if (finalReply) {
    saveMessage(conversationId, 'assistant', finalReply).catch(() => {})
  }

  // If escalated, set a friendlier message
  if (escalated) {
    finalReply = finalReply || "I'm connecting you with a team member now. They'll be with you shortly — usually within a minute or two."
  }

  return {
    conversationId,
    reply: finalReply,
    status: escalated ? 'waiting_for_human' : conversationStatus,
    escalated,
  }
}

// ---------- Staff Handover ----------

export async function getConversationByStaffToken(token: string) {
  const { data: convo } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('human_staff_token', token)
    .single()

  if (!convo) return null

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, role, content, attachment_url, created_at')
    .eq('conversation_id', convo.id)
    .order('created_at', { ascending: true })

  return {
    ...convo,
    user_identifier: convo.user_identifier ? decrypt(convo.user_identifier) : null,
    messages: messages || [],
  }
}

export async function staffJoinConversation(token: string, staffId?: string) {
  const { data, error } = await supabase
    .from('chat_conversations')
    .update({
      status: 'human_joined',
      human_staff_id: staffId || null,
      human_joined_at: new Date().toISOString(),
    })
    .eq('human_staff_token', token)
    .select('id')
    .single()

  if (!data) return null

  // Add system message
  await saveMessage(data.id, 'system', 'A team member has joined the conversation.')
  return data
}

export async function staffSendMessage(token: string, content: string, staffName?: string) {
  const { data: convo } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('human_staff_token', token)
    .single()

  if (!convo) return null

  const displayContent = staffName ? `**${staffName}:** ${content}` : content
  await saveMessage(convo.id, 'human', displayContent)

  return { conversationId: convo.id }
}

export async function closeConversation(conversationId: string, summary?: string) {
  await supabase
    .from('chat_conversations')
    .update({
      status: 'closed',
      conversation_summary: summary || null,
    })
    .eq('id', conversationId)
}

export async function leaveMessage(conversationId: string, message: string) {
  await saveMessage(conversationId, 'user', message)

  await supabase
    .from('chat_conversations')
    .update({ status: 'message_left' })
    .eq('id', conversationId)

  // Get full conversation for summary
  const { data: convo } = await supabase
    .from('chat_conversations')
    .select('user_identifier, user_type, reference_id, offer_id, escalation_reason')
    .eq('id', conversationId)
    .single()

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  const userDisplay = convo?.user_identifier ? decrypt(convo.user_identifier) : 'Unknown'

  // Build conversation summary for the email
  const convoSummary = (messages || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-10) // Last 10 messages
    .map(m => `**${m.role === 'user' ? 'User' : 'GooseBot'}:** ${m.content}`)
    .join('\n\n')

  // Send alert email
  await sendEmail({
    to: 'info@propertygoose.co.uk',
    subject: `[GooseBot] Message left — ${userDisplay}`,
    html: `<h2>Tenant Left a Message</h2>
<p>A user left a detailed message after GooseBot couldn't fully resolve their issue. <strong>Please respond within 1 hour.</strong></p>
<p><strong>User:</strong> ${userDisplay} (${convo?.user_type || 'unknown'})</p>
<p><strong>Reference:</strong> ${convo?.reference_id || 'N/A'}</p>
<p><strong>Original escalation:</strong> ${convo?.escalation_reason || 'N/A'}</p>
<h3>Their message:</h3>
<p>${message}</p>
<h3>Recent conversation:</h3>
<div style="background:#f5f5f5;padding:16px;border-radius:8px;font-size:14px;white-space:pre-wrap;">${convoSummary}</div>`,
  })

  // SMS alert
  const alertNumbers = (process.env.GOOSEBOT_ALERT_NUMBERS || '').split(',').filter(Boolean)
  for (const number of alertNumbers) {
    await sendSMS({
      to: number.trim(),
      body: `GooseBot: ${userDisplay} left a message (couldn't wait). Please check email and respond within 1hr.`,
    })
  }
}

// Get messages for a conversation (for polling)
export async function getMessages(conversationId: string, since?: string) {
  let query = supabase
    .from('chat_messages')
    .select('id, role, content, attachment_url, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (since) {
    query = query.gt('created_at', since)
  }

  const { data } = await query
  return data || []
}

// ---------- Helpers ----------

async function saveMessage(
  conversationId: string,
  role: string,
  content: string,
  toolCalls?: any[]
) {
  await supabase.from('chat_messages').insert({
    conversation_id: conversationId,
    role,
    content,
    tool_calls: toolCalls?.length ? toolCalls : null,
  })
}

function formatChaseItem(i: any): string {
  const name = decrypt(i.referee_name_encrypted) || 'Unknown'
  const email = decrypt(i.referee_email_encrypted) || ''
  const hoursWaiting = i.initial_sent_at
    ? Math.round((Date.now() - new Date(i.initial_sent_at).getTime()) / 3600000)
    : 0
  return `- **${i.referee_type}** (${i.chase_type}): ${name} ${email ? `<${email}>` : ''}\n  Status: ${i.status} | Chased ${i.chase_count}x | Waiting: ${hoursWaiting}h`
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    'SENT': 'Form sent — waiting for you to start',
    'COLLECTING_EVIDENCE': 'Collecting evidence and references',
    'ACTION_REQUIRED': 'Being reviewed by our team',
    'INDIVIDUAL_COMPLETE': 'Your part is complete',
    'GROUP_ASSESSMENT': 'Final group assessment in progress',
    'ACCEPTED': 'Accepted',
    'ACCEPTED_WITH_GUARANTOR': 'Accepted — guarantor required',
    'ACCEPTED_ON_CONDITION': 'Accepted with conditions',
    'REJECTED': 'Not accepted',
  }
  return map[status] || status
}

function formatSectionName(section: string): string {
  const map: Record<string, string> = {
    'IDENTITY': 'Identity',
    'RTR': 'Right to Rent',
    'INCOME': 'Income',
    'RESIDENTIAL': 'Residential History',
    'ADDRESS': 'Proof of Address',
    'CREDIT': 'Credit Check',
    'AML': 'Anti-Money Laundering',
    'EMPLOYER': 'Employer',
    'LANDLORD': 'Landlord',
    'ACCOUNTANT': 'Accountant',
    'TENANT': 'Tenant form',
    'GUARANTOR': 'Guarantor',
  }
  return map[section] || section
}
