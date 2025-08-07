// server/src/routes/chat.ts
import express from 'express'
import { ConversationService, MessageService, UserService } from '../database/models'
import { asyncHandler } from '../utils/asyncHandler'
import { convertMessagesToHeimdall } from '../utils/heimdallConverter'
import { modelService } from '../utils/modelService'
// import { generateResponse } from '../utils/ollama'
import { generateResponse } from '../utils/provider'

const router = express.Router()

// Global search endpoint (temporary: userId query param optional, default 1)
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = (req.query.q as string) || ''
    if (!q.trim()) {
      return res.status(400).json({ error: 'Missing q parameter' })
    }
    const userId = req.query.userId ? parseInt(req.query.userId as string) : 1
    const results = MessageService.searchAllUserMessages(q, userId, 50)
    res.json(results)
  })
)

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

//update conversation title
router.patch(
  '/conversations/:id/',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const { title } = req.body

    if (!title) {
      return res.status(400).json({ error: 'Title required' })
    }

    const conversation = ConversationService.updateTitle(conversationId, title)
    res.json(conversation)
  })
)

//delete conversation
router.delete(
  '/conversations/:id/',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const conversation = ConversationService.getById(conversationId)
    if (conversation) {
      ConversationService.delete(conversationId)
      res.json({ message: 'Conversation deleted' })
    } else {
      res.status(404).json({ error: 'Conversation not found' })
    }
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

//get message tree
router.get(
  '/conversations/:id/messages/tree',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const messages = MessageService.getByConversation(conversationId)

    // Optional: Debug the tree structure in development
    // if (process.env.NODE_ENV === 'development') {
    //   debugMessageTree(messages)
    // }
    console.log(`messages ${JSON.stringify(messages)} \n`)
    const treeData = convertMessagesToHeimdall(messages)
    console.log(`treeserver data ${JSON.stringify(treeData)} \n`)
    res.json(treeData)
  })
)

// Send message with streaming response

// Send message with streaming response (with repeat capability)
// Send message with streaming response (with repeat capability)
router.post(
  '/conversations/:id/messages/repeat',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const { content, modelName, parentId: requestedParentId, repeatNum = 1, provider = 'ollama' } = req.body

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

    // Determine parent ID: use requested parentId if provided, otherwise get last message
    let parentId: number | null = null
    if (requestedParentId !== undefined) {
      const parentMessage = MessageService.getById(requestedParentId)
      parentId = parentMessage ? requestedParentId : null
    } else {
      const lastMessage = MessageService.getLastMessage(conversationId)
      if (lastMessage) {
        const validParent = MessageService.getById(lastMessage.id)
        parentId = validParent ? lastMessage.id : null
      }
    }

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
    const baseHistory = MessageService.getByConversation(conversationId)

    try {
      const repeats = Math.max(1, parseInt(repeatNum as string, 10) || 1)

      for (let i = 0; i < repeats; i++) {
        let assistantContent = ''

        await generateResponse(
          baseHistory,
          chunk => {
            assistantContent += chunk
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk, iteration: i })}\n\n`)
          },
          provider,
          selectedModel
        )

        if (assistantContent.trim()) {
          const assistantMessage = MessageService.create(conversationId, 'assistant', assistantContent, userMessage.id)

          res.write(`data: ${JSON.stringify({ type: 'complete', message: assistantMessage, iteration: i })}\n\n`)
        } else {
          res.write(`data: ${JSON.stringify({ type: 'no_output', iteration: i })}\n\n`)
        }
      }

      const messages = MessageService.getByConversation(conversationId)
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

router.post(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const { content, modelName, parentId: requestedParentId, provider = 'ollama' } = req.body

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

    // Determine parent ID: use requested parentId if provided, otherwise get last message
    let parentId: number | null = null
    if (requestedParentId !== undefined) {
      const parentMessage = MessageService.getById(requestedParentId)
      parentId = parentMessage ? requestedParentId : null
      console.log(`server | parent id - ${parentId}`)
    } else {
      const lastMessage = MessageService.getLastMessage(conversationId)
      if (lastMessage) {
        const validParent = MessageService.getById(lastMessage.id)
        parentId = validParent ? lastMessage.id : null
      }
    }

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
        provider,
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

// Send message with streaming response (with repeat capability)
router.post(
  '/conversations/:id/messages/repeat',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const { content, modelName, parentId: requestedParentId, repeatNum = 1, provider = 'ollama' } = req.body

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

    // Determine parent ID: use requested parentId if provided, otherwise get last message
    let parentId: number | null = null
    if (requestedParentId !== undefined) {
      const parentMessage = MessageService.getById(requestedParentId)
      parentId = parentMessage ? requestedParentId : null
    } else {
      const lastMessage = MessageService.getLastMessage(conversationId)
      if (lastMessage) {
        const validParent = MessageService.getById(lastMessage.id)
        parentId = validParent ? lastMessage.id : null
      }
    }

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
    const baseHistory = MessageService.getByConversation(conversationId)

    try {
      const repeats = Math.max(1, parseInt(repeatNum as string, 10) || 1)

      for (let i = 0; i < repeats; i++) {
        let assistantContent = ''

        await generateResponse(
          baseHistory,
          chunk => {
            assistantContent += chunk
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk, iteration: i })}\n\n`)
          },
          provider,
          selectedModel
        )

        if (assistantContent.trim()) {
          const assistantMessage = MessageService.create(conversationId, 'assistant', assistantContent, userMessage.id)

          res.write(`data: ${JSON.stringify({ type: 'complete', message: assistantMessage, iteration: i })}\n\n`)
        } else {
          res.write(`data: ${JSON.stringify({ type: 'no_output', iteration: i })}\n\n`)
        }
      }

      const messages = MessageService.getByConversation(conversationId)
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

router.post(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const { content, modelName, parentId: requestedParentId, provider = 'ollama' } = req.body

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

    // Determine parent ID: use requested parentId if provided, otherwise get last message
    let parentId: number | null = null
    if (requestedParentId !== undefined) {
      const parentMessage = MessageService.getById(requestedParentId)
      parentId = parentMessage ? requestedParentId : null
      console.log(`server | parent id - ${parentId}`)
    } else {
      const lastMessage = MessageService.getLastMessage(conversationId)
      if (lastMessage) {
        const validParent = MessageService.getById(lastMessage.id)
        parentId = validParent ? lastMessage.id : null
      }
    }

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
        provider,
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

router.put(
  '/messages/:id',
  asyncHandler(async (req, res) => {
    const messageId = parseInt(req.params.id)
    const { content } = req.body

    if (!content) return res.status(400).json({ error: 'Content required' })

    const updated = MessageService.update(messageId, content)
    if (!updated) return res.status(404).json({ error: 'Message not found' })

    res.json(updated)
  })
)

router.delete(
  '/messages/:id',
  asyncHandler(async (req, res) => {
    const messageId = parseInt(req.params.id)

    const deleted = MessageService.delete(messageId)
    if (!deleted) return res.status(404).json({ error: 'Message not found' })

    res.json({ success: true })
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
