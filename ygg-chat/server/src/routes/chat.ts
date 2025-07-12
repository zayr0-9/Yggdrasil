// server/src/routes/chat.ts
import express from 'express'
import { ConversationService, MessageService, UserService } from '../database/models'
import { asyncHandler } from '../utils/asyncHandler'
import { modelService } from '../utils/modelService'
import { generateResponse } from '../utils/ollama'

const router = express.Router()

router.get(
  '/models',
  asyncHandler(async (req, res) => {
    const data = await modelService.getAvailableModels()
    res.json(data)
  })
)

// Force refresh models cache
router.post(
  '/models/refresh',
  asyncHandler(async (req, res) => {
    const data = await modelService.refreshModels()
    res.json(data)
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

//get all users
router.get(
  '/users/',
  asyncHandler(async (req, res) => {
    const users = UserService.getAll()
    res.json(users)
  })
)

// Get specific user
router.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.id)
    const user = UserService.getById(userId)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(user)
  })
)

// Update user
router.put(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.id)
    const { username } = req.body

    if (!username) {
      return res.status(400).json({ error: 'Username required' })
    }

    const user = UserService.update(userId, username)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json(user)
  })
)

// Delete user (cascade delete conversations and messages)
router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.id)

    const user = UserService.getById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get user conversations for cascade delete
    const conversations = ConversationService.getByUser(userId)

    // Delete all messages in all conversations
    conversations.forEach(conv => {
      MessageService.deleteByConversation(conv.id)
    })

    // Delete all user conversations
    ConversationService.deleteByUser(userId)

    // Delete user
    UserService.delete(userId)

    res.json({ message: 'User and all associated data deleted' })
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

    const conversation = await ConversationService.create(userId, title, modelName)
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
    const { content, modelName } = req.body

    if (!content) {
      return res.status(400).json({ error: 'Message content required' })
    }

    // Verify conversation exists
    const conversation = ConversationService.getById(conversationId)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    // Use conversation's model or provided model or default
    const selectedModel = modelName || conversation.model_name || (await modelService.getDefaultModel())

    // Get the last message to determine parent ID
    const lastMessage = MessageService.getLastMessage(conversationId)
    const parentId = lastMessage ? lastMessage.id : null

    // Save user message with proper parent ID
    const userMessage = MessageService.create(conversationId, 'user', content, parentId)

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
      await generateResponse(
        messages,
        chunk => {
          assistantContent += chunk
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
        },
        selectedModel
      )

      // Save complete assistant message with user message as parent
      const assistantMessage = MessageService.create(conversationId, 'assistant', assistantContent, userMessage.id)

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
