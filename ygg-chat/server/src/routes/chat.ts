// server/src/routes/chat.ts
import express from 'express'
import { ConversationService, MessageService, UserService } from '../database/models'
import { asyncHandler } from '../utils/asyncHandler'
import { generateResponse } from '../utils/ollama'

const router = express.Router()

router.get(
  '/models',
  asyncHandler(async (req, res) => {
    const response = await fetch('http://localhost:11434/api/tags')
    const data = (await response.json()) as { models: { name: string }[] }
    const models = data.models.map((m: any) => m.name)
    res.json({ models, default: models[0] || null })
  })
)

// Create or get user
router.post(
  '/users',
  asyncHandler(async (req, res) => {
    const { username } = req.body

    if (!username) {
      return res.status(400).json({ error: 'Username required' })
    }

    let user = UserService.getByUsername(username)
    if (!user) {
      user = UserService.create(username)
    }

    res.json(user)
  })
)

// Get user conversations
router.get(
  '/users/:userId/conversations',
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId)
    const conversations = ConversationService.getByUser(userId)
    res.json(conversations)
  })
)

// Create conversation
router.post(
  '/conversations',
  asyncHandler(async (req, res) => {
    const { userId, title, modelName } = req.body

    if (!userId) {
      return res.status(400).json({ error: 'userId required' })
    }

    const conversation = ConversationService.create(userId, title, modelName)
    res.json(conversation)
  })
)

// Get conversation messages
router.get(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const messages = MessageService.getByConversation(conversationId)
    res.json(messages)
  })
)

// Send message with streaming response
router.post(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const { content, modelName = 'gemma3:4b' } = req.body

    if (!content) {
      return res.status(400).json({ error: 'Message content required' })
    }

    // Verify conversation exists
    const conversation = ConversationService.getById(conversationId)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    // Save user message
    const userMessage = MessageService.create(conversationId, 'user', content)

    // Setup SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    })

    // Send user message immediately
    res.write(`data: ${JSON.stringify({ type: 'user_message', message: userMessage })}\n\n`)

    try {
      // Get conversation history for context
      const messages = MessageService.getByConversation(conversationId)

      let assistantContent = ''

      // Stream AI response
      await generateResponse(messages, modelName, chunk => {
        assistantContent += chunk
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
      })

      // Save complete assistant message
      const assistantMessage = MessageService.create(conversationId, 'assistant', assistantContent)

      // Send completion event
      res.write(
        `data: ${JSON.stringify({
          type: 'complete',
          message: assistantMessage,
        })}\n\n`
      )

      // Auto-generate title for new conversations
      if (!conversation.title && messages.length === 1) {
        const title = content.slice(0, 50) + (content.length > 50 ? '...' : '')
        ConversationService.updateTitle(conversationId, title)
      }
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`
      )
    }

    res.end()
  })
)

// Delete conversation
router.delete(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)

    const conversation = ConversationService.getById(conversationId)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    ConversationService.delete(conversationId)
    res.json({ message: 'Conversation deleted' })
  })
)

export default router
