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

/**
 * POST /api/chat/message
 * Send a message and get an AI response.
 * Agents: authenticated via bearer token, companyId derived from session (NEVER from body).
 * Tenants/Guarantors: identified by referenceId, validated against the reference token.
 */
router.post('/message', async (req: Request, res: Response) => {
  try {
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
 * Query: ?since=ISO_DATE to get only new messages.
 */
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
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
 */
router.post('/:id/leave-message', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { message } = req.body

    if (!message) {
      return res.status(400).json({ error: 'message is required' })
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
 * Close a conversation.
 */
router.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { summary } = req.body
    await closeConversation(id, summary)
    res.json({ success: true })
  } catch (err: any) {
    console.error('[Chat] Error closing conversation:', err.message)
    res.status(500).json({ error: 'Failed to close conversation' })
  }
})

// ---------- Staff Handover Routes (token-based, no auth) ----------

/**
 * GET /api/chat/staff/:token
 * Staff opens a conversation from SMS link. Returns full history.
 */
router.get('/staff/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params
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
    const { token } = req.params
    const { content, staffName } = req.body

    if (!content) {
      return res.status(400).json({ error: 'content is required' })
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
