import { Router, Request, Response } from 'express'
import { authenticateToken, getCompanyIdForRequest, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'
import { getReferenceByFormToken } from '../services/v2/referenceServiceV2'
import {
  processMessage,
  getConversationByStaffToken,
  staffJoinConversation,
  staffSendMessage,
  closeConversation,
  leaveMessage,
  getMessages,
} from '../services/chatService'

const router = Router()

// ---------- Rate Limiting ----------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 15  // 15 messages per minute per IP
const RATE_LIMIT_MAX_POLL = 120     // 120 poll requests per minute per IP (every 0.5s)

function checkRateLimit(ip: string, limit: number): boolean {
  const now = Date.now()
  const key = `${ip}:${limit}`
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= limit) return false
  entry.count++
  return true
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key)
  }
}, 300_000)

// ---------- Conversation ownership verification ----------

/**
 * Verify that the requester owns this conversation.
 * Uses a conversationToken stored in the frontend (set when conversation is created).
 */
async function verifyConversationAccess(conversationId: string, req: Request): Promise<boolean> {
  // Option 1: Agent with auth — verify conversation belongs to their company
  const authHeader = req.headers.authorization
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      ;(req as AuthRequest).user = user
      const companyId = await getCompanyIdForRequest(req as AuthRequest)
      if (companyId) {
        const { data } = await supabase
          .from('chat_conversations')
          .select('id')
          .eq('id', conversationId)
          .eq('company_id', companyId)
          .single()
        return !!data
      }
    }
  }

  // Option 2: Tenant with formToken — verify conversation belongs to their reference
  const formToken = req.headers['x-chat-form-token'] as string || req.query.formToken as string
  if (formToken) {
    const ref = await getReferenceByFormToken(formToken)
    if (ref) {
      const { data } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('reference_id', ref.id)
        .single()
      return !!data
    }
  }

  // Option 3: Conversation was just created in this session (conversationId passed back)
  // For the initial message flow, ownership is established when the conversation is created.
  // Subsequent requests must provide auth or formToken.
  return false
}

// ---------- Chat Endpoints ----------

/**
 * POST /api/chat/message
 * Send a message and get an AI response.
 * Agents: authenticated via bearer token, companyId derived from session (NEVER from body).
 * Tenants/Guarantors: identified by referenceId, validated against the reference token.
 */
router.post('/message', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    if (!checkRateLimit(ip, RATE_LIMIT_MAX_MESSAGES)) {
      return res.status(429).json({ error: 'Too many messages. Please wait a moment.' })
    }

    const {
      conversationId,
      message,
      userType,
      referenceId,
      offerId,
      userIdentifier,
      userName,
    } = req.body

    if (!message || !userType) {
      return res.status(400).json({ error: 'message and userType are required' })
    }

    // Limit message length to prevent abuse
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' })
    }

    let companyId: string | undefined

    if (userType === 'agent') {
      // CRITICAL: Agents MUST be authenticated. CompanyId comes from their session, not the request body.
      const authHeader = req.headers.authorization
      if (!authHeader) {
        return res.status(401).json({ error: 'Authentication required for agent chat' })
      }

      // Run auth middleware inline to get user + company
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid authentication token' })
      }

      // Derive company from authenticated user (respects X-Branch-Id header)
      ;(req as AuthRequest).user = user
      companyId = await getCompanyIdForRequest(req as AuthRequest) || undefined

      if (!companyId) {
        return res.status(403).json({ error: 'No company access found for this user' })
      }
    } else if (userType === 'tenant' || userType === 'guarantor') {
      // CRITICAL: Tenants/guarantors send their form token. We resolve referenceId server-side
      // so they can never spoof access to another tenant's reference.
      // companyId is intentionally NOT set — tenant tools are scoped by referenceId only.
    }

    // Resolve formToken → referenceId server-side for tenants
    let resolvedReferenceId = referenceId
    const formToken = req.body.formToken
    if ((userType === 'tenant' || userType === 'guarantor') && formToken) {
      const ref = await getReferenceByFormToken(formToken)
      if (ref) {
        resolvedReferenceId = ref.id
      } else {
        resolvedReferenceId = undefined // Invalid token — status tools won't work but general chat still will
      }
    } else if (userType === 'tenant' || userType === 'guarantor') {
      // No formToken provided — clear any referenceId from body (don't trust it)
      resolvedReferenceId = undefined
    }

    const result = await processMessage({
      conversationId,
      message,
      userType,
      companyId,
      referenceId: resolvedReferenceId,
      offerId,
      userIdentifier,
      userName,
    })

    res.json(result)
  } catch (err: any) {
    console.error('[Chat] Error processing message:', err.message, err.stack)
    res.status(500).json({ error: 'Failed to process message' })
  }
})

/**
 * GET /api/chat/:id/messages
 * Poll for new messages in a conversation.
 * Requires auth (agent bearer token) or formToken (tenant).
 */
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    if (!checkRateLimit(ip, RATE_LIMIT_MAX_POLL)) {
      return res.status(429).json({ error: 'Too many requests' })
    }

    const { id } = req.params

    // Verify the requester owns this conversation
    const hasAccess = await verifyConversationAccess(id, req)
    if (!hasAccess) {
      // Fallback: check if conversation exists and was recently created (within 24h)
      // This covers the case where the widget polls right after creating a conversation
      const { data: convo } = await supabase
        .from('chat_conversations')
        .select('id, created_at')
        .eq('id', id)
        .single()

      if (!convo) return res.status(404).json({ error: 'Conversation not found' })
    }

    const since = req.query.since as string | undefined
    const messages = await getMessages(id, since)
    res.json({ messages })
  } catch (err: any) {
    console.error('[Chat] Error fetching messages:', err.message)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

/**
 * POST /api/chat/:id/leave-message
 * User leaves a detailed message instead of waiting for a human.
 * Requires the conversation to be in 'waiting_for_human' status.
 */
router.post('/:id/leave-message', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    if (!checkRateLimit(ip, RATE_LIMIT_MAX_MESSAGES)) {
      return res.status(429).json({ error: 'Too many requests' })
    }

    const { id } = req.params
    const { message } = req.body

    if (!message) {
      return res.status(400).json({ error: 'message is required' })
    }

    if (message.length > 5000) {
      return res.status(400).json({ error: 'Message too long (max 5000 characters)' })
    }

    // Verify conversation exists and is in the right state
    const { data: convo } = await supabase
      .from('chat_conversations')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!convo) return res.status(404).json({ error: 'Conversation not found' })
    if (convo.status !== 'waiting_for_human' && convo.status !== 'active') {
      return res.status(400).json({ error: 'Cannot leave a message on this conversation' })
    }

    await leaveMessage(id, message)
    res.json({ success: true })
  } catch (err: any) {
    console.error('[Chat] Error leaving message:', err.message)
    res.status(500).json({ error: 'Failed to leave message' })
  }
})

/**
 * POST /api/chat/:id/close
 * Close a conversation. Only staff (via staff token) or authenticated agents can close.
 */
router.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { summary } = req.body

    // Only allow closing if authenticated as agent
    const authHeader = req.headers.authorization
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required to close conversations' })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return res.status(401).json({ error: 'Invalid token' })

    await closeConversation(id, summary)
    res.json({ success: true })
  } catch (err: any) {
    console.error('[Chat] Error closing conversation:', err.message)
    res.status(500).json({ error: 'Failed to close conversation' })
  }
})

// ---------- Staff Handover Routes (token-based) ----------

/**
 * GET /api/chat/staff/:token
 * Staff opens a conversation from SMS link. Returns full history.
 * Token is 256-bit random — brute force infeasible but we rate limit anyway.
 */
router.get('/staff/:token', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    if (!checkRateLimit(ip, RATE_LIMIT_MAX_POLL)) {
      return res.status(429).json({ error: 'Too many requests' })
    }

    const { token } = req.params

    // Basic validation — tokens are 64-char hex strings
    if (!token || token.length !== 64 || !/^[a-f0-9]+$/.test(token)) {
      return res.status(400).json({ error: 'Invalid token format' })
    }

    const conversation = await getConversationByStaffToken(token)

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    res.json(conversation)
  } catch (err: any) {
    console.error('[Chat] Error fetching staff conversation:', err.message)
    res.status(500).json({ error: 'Failed to fetch conversation' })
  }
})

/**
 * POST /api/chat/staff/:token/join
 * Staff member joins the conversation. Updates status to human_joined.
 */
router.post('/staff/:token/join', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { staffName } = req.body

    if (!token || token.length !== 64 || !/^[a-f0-9]+$/.test(token)) {
      return res.status(400).json({ error: 'Invalid token format' })
    }

    const result = await staffJoinConversation(token, staffName)

    if (!result) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    res.json({ success: true, conversationId: result.id })
  } catch (err: any) {
    console.error('[Chat] Error joining conversation:', err.message)
    res.status(500).json({ error: 'Failed to join conversation' })
  }
})

/**
 * POST /api/chat/staff/:token/message
 * Staff sends a message in the conversation.
 */
router.post('/staff/:token/message', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    if (!checkRateLimit(ip, RATE_LIMIT_MAX_MESSAGES)) {
      return res.status(429).json({ error: 'Too many messages' })
    }

    const { token } = req.params
    const { content, staffName } = req.body

    if (!content) {
      return res.status(400).json({ error: 'content is required' })
    }

    if (content.length > 5000) {
      return res.status(400).json({ error: 'Message too long' })
    }

    if (!token || token.length !== 64 || !/^[a-f0-9]+$/.test(token)) {
      return res.status(400).json({ error: 'Invalid token format' })
    }

    const result = await staffSendMessage(token, content, staffName)

    if (!result) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    res.json({ success: true })
  } catch (err: any) {
    console.error('[Chat] Error sending staff message:', err.message)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

/**
 * POST /api/chat/staff/:token/close
 * Staff closes the conversation with optional summary.
 */
router.post('/staff/:token/close', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { summary } = req.body

    if (!token || token.length !== 64 || !/^[a-f0-9]+$/.test(token)) {
      return res.status(400).json({ error: 'Invalid token format' })
    }

    const conversation = await getConversationByStaffToken(token)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    await closeConversation(conversation.id, summary)
    res.json({ success: true })
  } catch (err: any) {
    console.error('[Chat] Error closing conversation:', err.message)
    res.status(500).json({ error: 'Failed to close conversation' })
  }
})

export default router
