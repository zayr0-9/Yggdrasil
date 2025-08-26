// server/src/routes/chat.ts
import crypto from 'crypto'
import express from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'
import { AttachmentService, ConversationService, MessageService, UserService } from '../database/models'
import { asyncHandler } from '../utils/asyncHandler'
import { convertMessagesToHeimdall } from '../utils/heimdallConverter'
import { modelService } from '../utils/modelService'
// import { generateResponse } from '../utils/ollama'
import { saveBase64ImageAttachmentsForMessage } from '../utils/attachments'
import { abortGeneration, clearGeneration, createGeneration } from '../utils/generationManager'
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

//Fetch openai models on the server to keep API key private
router.get(
  '/models/openai',
  asyncHandler(async (req, res) => {
    try {
      const abortController = new AbortController()
      req.on('close', () => abortController.abort())
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        return res.status(400).json({ error: 'Missing OPENAI_API_KEY' })
      }

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        const text = await response.text()
        return res.status(response.status).json({ error: text || response.statusText })
      }

      // OpenRouter returns { data: Model[] }
      const data = (await response.json()) as { data?: any[]; models?: any[] }
      const rawModels: any[] = Array.isArray(data?.data) ? data.data! : Array.isArray(data?.models) ? data.models! : []

      // Prefer the canonical model id; fallback to name if necessary
      const names: string[] = rawModels.map(m => String(m?.id || m?.name || '')).filter(n => n.length > 0)

      const preferredDefault = 'gpt-4o'
      const defaultModel = names.includes(preferredDefault) ? preferredDefault : names[0] || ''

      res.json({ models: names, default: defaultModel })
    } catch (error) {
      console.error('Error fetching OpenAI models:', error)
      res.status(500).json({ error: 'Failed to fetch OpenAI models' })
    }
  })
)

//Fetch openRouter models on the server to keep API key private
router.get(
  '/models/openrouter',
  asyncHandler(async (req, res) => {
    try {
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        return res.status(400).json({ error: 'Missing OPENROUTER_API_KEY' })
      }

      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        const text = await response.text()
        return res.status(response.status).json({ error: text || response.statusText })
      }

      const data = (await response.json()) as { data?: any[]; models?: any[] }
      const rawModels: any[] = Array.isArray(data?.data) ? data.data! : Array.isArray(data?.models) ? data.models! : []

      // Map OpenRouter response to client Model shape (same as Gemini endpoint)
      const models = rawModels
        .map(m => {
          const rawId = String(m?.id || m?.name || '')
          const name = rawId.replace(/^models\//, '')
          if (!name) return null
          const displayName = String(m?.display_name || m?.displayName || name)
          const description = String(m?.description || '')
          const inputTokenLimit = Number(m?.context_length ?? m?.context_length_tokens ?? 0)
          const outputTokenLimit = Number(m?.output_token_limit ?? m?.max_output_tokens ?? 0)
          const supportedParams: string[] = Array.isArray(m?.supported_parameters) ? m.supported_parameters : []
          const capabilities = (m as any)?.capabilities || {}
          const thinking =
            supportedParams.includes('reasoning') ||
            supportedParams.includes('include_reasoning') ||
            !!capabilities?.reasoning ||
            /thinking/i.test(name) ||
            /thinking/i.test(displayName)
          return {
            name,
            version: String(m?.version || ''),
            displayName,
            description,
            inputTokenLimit,
            outputTokenLimit,
            thinking,
            supportedGenerationMethods: supportedParams,
          }
        })
        .filter(Boolean) as any[]

      const preferredDefault = 'gpt-4o'
      const defaultModel = models.find((m: any) => m.name === preferredDefault) || models[0] || null

      res.json({ models, default: defaultModel })
    } catch (error) {
      console.error('Error fetching OpenRouter models:', error)
      res.status(500).json({ error: 'Failed to fetch OpenRouter models' })
    }
  })
)

// Fetch Anthropic models on the server to keep API key private
router.get(
  '/models/anthropic',
  asyncHandler(async (req, res) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        return res.status(400).json({ error: 'Missing ANTHROPIC_API_KEY' })
      }

      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        const text = await response.text()
        return res.status(response.status).json({ error: text || response.statusText })
      }

      const data = (await response.json()) as { data?: any[]; models?: any[] }

      const list: any[] = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : []

      // Map Anthropic response to the same shape as the Gemini endpoint
      const anthropicThinkingIds = new Set([
        'claude-opus-4-1-20250805',
        'claude-opus-4-20250514',
        'claude-sonnet-4-20250514',
        'claude-3-7-sonnet-20250219',
      ])
      const models = list
        .map(m => {
          const id = String(m?.id || m?.name || '')
          if (!id) return null
          const displayName = String(m?.display_name || m?.displayName || id)
          return {
            name: id,
            version: '',
            displayName,
            description: '',
            inputTokenLimit: 0,
            outputTokenLimit: 0,
            thinking: anthropicThinkingIds.has(id) || /thinking/i.test(id) || /thinking/i.test(displayName),
            supportedGenerationMethods: [] as string[],
          }
        })
        .filter(Boolean) as any[]

      const preferredDefault = 'claude-3-5-sonnet-latest'
      const defaultModel = models.find((m: any) => m.name === preferredDefault) || models[0] || null

      res.json({ models, default: defaultModel })
    } catch (error) {
      console.error('Failed to fetch Anthropic models:', error)
      res.status(500).json({ error: 'Failed to fetch Anthropic models' })
    }
  })
)

//fetch models ollama
router.get(
  '/models',
  asyncHandler(async (req, res) => {
    const data = await modelService.getAvailableModels()
    res.json(data)
  })
)

// Fetch Google Gemini models on the server to keep API key private
router.get(
  '/models/gemini',
  asyncHandler(async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
      if (!apiKey) {
        return res.status(400).json({ error: 'Missing GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY' })
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) })

      if (!response.ok) {
        const text = await response.text()
        return res.status(response.status).json({ error: text || response.statusText })
      }

      const data = (await response.json()) as { models?: any[] }
      const rawModels: any[] = Array.isArray(data.models) ? data.models : []

      // Only include chat-capable models (support generateContent)
      const chatCapable = rawModels.filter(m => {
        const methods = m?.supportedGenerationMethods || m?.supportedActions || []
        return Array.isArray(methods) && methods.includes('generateContent')
      })
      // console.log('chatCapable', chatCapable)
      // Map Google response to client Model shape
      const models = chatCapable
        .map(m => {
          const rawName = String(m?.name || '')
          const name = rawName.replace(/^models\//, '')
          const methods = Array.isArray(m?.supportedGenerationMethods)
            ? m.supportedGenerationMethods
            : Array.isArray(m?.supportedActions)
              ? m.supportedActions
              : []
          const displayName = String(m?.displayName || name)
          const description = String(m?.description || '')
          const inputTokenLimit = Number(m?.inputTokenLimit ?? m?.inputTokenLimitTokens ?? 0)
          const outputTokenLimit = Number(m?.outputTokenLimit ?? m?.outputTokenLimitTokens ?? 0)
          const version = String(m?.version ?? '')
          const thinking = /thinking/i.test(name) || /thinking/i.test(displayName)
          return {
            name,
            version,
            displayName,
            description,
            inputTokenLimit,
            outputTokenLimit,
            thinking,
            supportedGenerationMethods: methods,
          }
        })
        .filter(m => m.name.length > 0)

      const preferredDefault = 'gemini-2.5-flash'
      const defaultModel = models.find(m => m.name === preferredDefault) || models[0] || null
      res.json({ models, default: defaultModel })
    } catch (error) {
      console.error('Failed to fetch Gemini models:', error)
      res.status(500).json({ error: 'Failed to fetch Gemini models' })
    }
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

    const existing = ConversationService.getById(conversationId)
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    const updated = ConversationService.updateTitle(conversationId, title)
    res.json(updated)
  })
)

// Get conversation system prompt
router.get(
  '/conversations/:id/system-prompt',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const conversation = ConversationService.getById(conversationId)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    const systemPrompt = ConversationService.getSystemPrompt(conversationId)
    res.json({ systemPrompt })
  })
)

//Get conversation context
router.get(
  '/conversations/:id/context',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const conversation = ConversationService.getById(conversationId)

    if (!conversation) {
      console.log('Conversation not found')
      return res.status(404).json({ error: 'Conversation not found' })
    }
    const context = ConversationService.getConversationContext(conversationId)

    res.json({ context })
  })
)

// Update conversation system prompt
router.patch(
  '/conversations/:id/system-prompt',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const { systemPrompt } = req.body as { systemPrompt?: string | null }

    // Validate existence
    const existing = ConversationService.getById(conversationId)
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    // Validate payload: allow string or null to clear; undefined is invalid
    if (typeof systemPrompt === 'undefined') {
      return res.status(400).json({ error: 'systemPrompt is required (string or null)' })
    }

    const updated = ConversationService.updateSystemPrompt(conversationId, systemPrompt ?? null)
    res.json(updated)
  })
)

//update conversation context
router.patch(
  '/conversations/:id/context',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const { context } = req.body as { context?: string | null }

    const existing = ConversationService.getById(conversationId)
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' })
    }

    if (typeof context === 'undefined') {
      return res.status(400).json({ error: 'context is required (string or null)' })
    }
    if (context) {
      const updated = ConversationService.updateContext(conversationId, context)
      res.json(updated)
    } else {
      // return error if no context sent
      return res.status(400).json({ error: 'context is required (string or null)' })
    }
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

// get conversation children
router.get(
  '/conversations/:conversationId/messages/:messageId/children',
  asyncHandler(async (req, res) => {
    const { conversationId, messageId } = req.params
    const childrenIds = MessageService.getChildrenIds(parseInt(messageId))
    res.json(childrenIds)
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
    // console.log(`messages ${JSON.stringify(messages)} \n`)
    const treeData = convertMessagesToHeimdall(messages)
    // console.log(`treeserver data ${JSON.stringify(treeData)} \n`)
    res.json(treeData)
  })
)

// Send message with streaming response (with repeat capability)
router.post(
  '/conversations/:id/messages/repeat',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const {
      content,
      modelName,
      parentId: requestedParentId,
      repeatNum = 1,
      provider = 'ollama',
      systemPrompt,
      think,
    } = req.body

    if (!content) {
      return res.status(400).json({ error: 'Message content required' })
    }

    // Verify conversation exists
    const conversation = ConversationService.getById(conversationId)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    const conversationContext = ConversationService.getConversationContext(conversationId)
    // const conversationSystemPrompt = ConversationService.getSystemPrompt(conversationId)
    //we should ideally call this but rn we are just passing from front end, cleanup later

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
    const userMessage = MessageService.create(conversationId, parentId, 'user', content, '', selectedModel)

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

    // Decode and persist any base64 attachments (images) for the user message
    const attachmentsBase64 = Array.isArray(req.body?.attachmentsBase64) ? req.body.attachmentsBase64 : null
    const createdAttachments: ReturnType<typeof AttachmentService.getById>[] = attachmentsBase64
      ? saveBase64ImageAttachmentsForMessage(userMessage.id, attachmentsBase64)
      : []

    try {
      const repeats = Math.max(1, parseInt(repeatNum as string, 10) || 1)
      const { id: messageId, controller } = createGeneration(userMessage.id)
      // Inform client of message id so it can cancel later
      res.write(`data: ${JSON.stringify({ type: 'generation_started', messageId: userMessage.id })}\n\n`)
      // Only clear on close; do NOT abort automatically
      // Don't clear on close - let it complete naturally or be aborted manually
      // req.on('close', () => clearGeneration(messageId))
      for (let i = 0; i < repeats; i++) {
        let assistantContent = ''
        let assistantThinking = ''

        await generateResponse(
          baseHistory,
          chunk => {
            try {
              const obj = JSON.parse(chunk)
              const part = obj?.part as 'text' | 'reasoning' | undefined
              const delta = String(obj?.delta ?? '')
              if (part === 'reasoning') {
                assistantThinking += delta
                res.write(
                  `data: ${JSON.stringify({ type: 'chunk', part: 'reasoning', delta, content: '', iteration: i })}\n\n`
                )
              } else {
                assistantContent += delta
                res.write(
                  `data: ${JSON.stringify({ type: 'chunk', part: 'text', delta, content: delta, iteration: i })}\n\n`
                )
              }
            } catch {
              // Fallback: treat as plain text
              assistantContent += chunk
              res.write(
                `data: ${JSON.stringify({ type: 'chunk', part: 'text', delta: chunk, content: chunk, iteration: i })}\n\n`
              )
            }
          },
          provider,
          selectedModel,
          createdAttachments.map(a => ({
            url: a?.url || undefined,
            mimeType: (a as any)?.mime_type,
            filePath: (a as any)?.file_path,
          })),
          systemPrompt,
          controller.signal,
          conversationContext ? conversationContext : null,
          think
        )

        if (assistantContent.trim() || assistantThinking.trim()) {
          const assistantMessage = MessageService.create(
            conversationId,
            userMessage.id,
            'assistant',
            assistantContent,
            assistantThinking,
            selectedModel
          )

          res.write(`data: ${JSON.stringify({ type: 'complete', message: assistantMessage, iteration: i })}\n\n`)
        } else {
          res.write(`data: ${JSON.stringify({ type: 'no_output', iteration: i })}\n\n`)
        }
      }

      // Clear generation on successful completion
      clearGeneration(messageId)

      const messages = MessageService.getByConversation(conversationId)
      if (!conversation.title && messages.length === 1) {
        const title = content.slice(0, 100) + (content.length > 100 ? '...' : '')
        ConversationService.updateTitle(conversationId, title)
      }
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`
      )
    } finally {
      // Best-effort cleanup
      try {
        const { id: _ } = { id: '' }
      } catch {}
    }

    res.end()
  })
)

// Send message with streaming response
router.post(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    const conversationId = parseInt(req.params.id)
    const {
      content,
      messages,
      modelName,
      parentId: requestedParentId,
      provider = 'ollama',
      systemPrompt,
      think,
    } = req.body

    if (!content) {
      return res.status(400).json({ error: 'Message content required' })
    }

    // Verify conversation exists
    const conversation = ConversationService.getById(conversationId)
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    const conversationContext = ConversationService.getConversationContext(conversationId)
    // const conversationSystemPrompt = ConversationService.getSystemPrompt(conversationId)

    // Use conversation's model or provided model or default
    const selectedModel = modelName || conversation.model_name || (await modelService.getDefaultModel())
    // Determine parent ID: use requested parentId if provided, otherwise get last message
    let parentId: number | null = null
    if (requestedParentId !== undefined) {
      const parentMessage = MessageService.getById(requestedParentId)
      parentId = parentMessage ? requestedParentId : null
      // console.log(`server | parent id - ${parentId}`)
    } else {
      const lastMessage = MessageService.getLastMessage(conversationId)
      if (lastMessage) {
        const validParent = MessageService.getById(lastMessage.id)
        parentId = validParent ? lastMessage.id : null
      }
    }

    // Save user message with proper parent ID
    const userMessage = MessageService.create(conversationId, parentId, 'user', content, '', selectedModel)
    // console.log('server | user message', userMessage)

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
      // Decode and persist any base64 attachments (images)
      const attachmentsBase64 = Array.isArray(req.body?.attachmentsBase64) ? req.body.attachmentsBase64 : null
      const createdAttachments: ReturnType<typeof AttachmentService.getById>[] = attachmentsBase64
        ? saveBase64ImageAttachmentsForMessage(userMessage.id, attachmentsBase64)
        : []

      // // Get conversation history for context
      // const messages = MessageService.getByConversation(conversationId)
      // const messages = context
      // console.log('server | messages', messages)

      // Ensure latest prompt is included with prior context before generating
      const combinedMessages = Array.isArray(messages) ? [...messages, userMessage] : [userMessage]

      let assistantContent = ''
      let assistantThinking = ''

      // Stream AI response with manual abort control
      const { id: messageId, controller } = createGeneration(userMessage.id)
      res.write(`data: ${JSON.stringify({ type: 'generation_started', messageId: userMessage.id })}\n\n`)
      // Don't clear on close - let it complete naturally or be aborted manually
      // req.on('close', () => clearGeneration(messageId))
      try {
        await generateResponse(
          combinedMessages,
          chunk => {
            try {
              const obj = JSON.parse(chunk)
              const part = obj?.part as 'text' | 'reasoning' | undefined
              const delta = String(obj?.delta ?? '')
              if (part === 'reasoning') {
                assistantThinking += delta
                res.write(`data: ${JSON.stringify({ type: 'chunk', part: 'reasoning', delta, content: '' })}\n\n`)
              } else {
                assistantContent += delta
                res.write(`data: ${JSON.stringify({ type: 'chunk', part: 'text', delta, content: delta })}\n\n`)
              }
            } catch {
              // Fallback: treat as plain text
              assistantContent += chunk
              res.write(`data: ${JSON.stringify({ type: 'chunk', part: 'text', delta: chunk, content: chunk })}\n\n`)
            }
          },
          provider,
          selectedModel,
          createdAttachments.map(a => ({
            url: a?.url || undefined,
            mimeType: (a as any)?.mime_type,
            filePath: (a as any)?.file_path,
          })),
          systemPrompt,
          controller.signal,
          conversationContext ? conversationContext : null,
          think
        )

        // Normal completion -> persist assistant message
        const assistantMessage = MessageService.create(
          conversationId,
          userMessage.id,
          'assistant',
          assistantContent,
          assistantThinking,
          selectedModel
        )

        res.write(
          `data: ${JSON.stringify({
            type: 'complete',
            message: assistantMessage,
          })}\n\n`
        )

        // Auto-generate title for new conversations (only if first message and no existing title)
        const allMessages = MessageService.getByConversation(conversationId)
        if (!conversation.title && allMessages.length >= 0) {
          console.log('Auto-generating title for new conversation', conversationId)
          const title = content.slice(0, 100) + (content.length > 100 ? '...' : '')
          ConversationService.updateTitle(conversationId, title)
        }
      } catch (error: any) {
        const isAbort =
          error?.name === 'AbortError' ||
          String(error || '')
            .toLowerCase()
            .includes('abort')
        if (isAbort) {
          // Persist whatever we have as a partial message
          if (assistantContent.trim() || assistantThinking.trim()) {
            const assistantMessage = MessageService.create(
              conversationId,
              userMessage.id,
              'assistant',
              assistantContent,
              assistantThinking,
              selectedModel
            )
            res.write(`data: ${JSON.stringify({ type: 'complete', message: assistantMessage, aborted: true })}\n\n`)
          } else {
            res.write(`data: ${JSON.stringify({ type: 'aborted' })}\n\n`)
          }
        } else {
          res.write(
            `data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            })}\n\n`
          )
        }
      } finally {
        // Ensure cleanup
        clearGeneration(messageId)
      }

      res.end()
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`
      )
      res.end()
    }
  })
)
//update message
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

// Attachments API

// Create an attachment metadata record (local file path or CDN URL). No binary upload here.
// Configure uploads directory and multer storage
const uploadsDir = path.join(path.resolve(__dirname, '..'), 'data', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}
const storage = multer.diskStorage({
  destination: (_req: express.Request, _file: any, cb: (error: Error | null, destination: string) => void) =>
    cb(null, uploadsDir),
  filename: (_req: express.Request, file: any, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_')
    cb(null, `${Date.now()}_${base}${ext}`)
  },
})
const upload = multer({ storage })

router.post(
  '/attachments',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    // If a file is uploaded, save metadata and create attachment
    const uploaded = (req as any).file as any | undefined
    if (uploaded) {
      const file = uploaded
      const messageIdRaw = req.body?.messageId
      const messageId = messageIdRaw ? parseInt(messageIdRaw) : null
      const absolutePath = file.path
      const filename = path.basename(absolutePath)
      const filePathRel = path.relative(__dirname, absolutePath) // e.g. data/uploads/...
      const sizeBytes = file.size
      const mimeType = file.mimetype

      // Compute sha256
      const fileBuffer = fs.readFileSync(absolutePath)
      const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex')

      const created = AttachmentService.create({
        messageId,
        kind: 'image',
        mimeType,
        storage: 'file',
        url: `/uploads/${filename}`,
        filePath: filePathRel,
        width: null,
        height: null,
        sizeBytes,
        sha256,
      })

      return res.status(201).json(created)
    }

    // Fallback: metadata-only mode (no binary). Maintain backward compatibility.
    const {
      messageId,
      kind = 'image',
      mimeType,
      storage,
      url,
      filePath,
      width,
      height,
      sizeBytes,
      sha256,
    } = req.body as {
      messageId?: number | null
      kind?: 'image'
      mimeType?: string
      storage?: 'file' | 'url'
      url?: string | null
      filePath?: string | null
      width?: number | null
      height?: number | null
      sizeBytes?: number | null
      sha256?: string | null
    }

    if (!mimeType) return res.status(400).json({ error: 'mimeType is required' })
    if (!url && !filePath) return res.status(400).json({ error: 'Either url or filePath is required' })
    if (kind !== 'image') return res.status(400).json({ error: 'Only kind="image" is supported' })

    const created = AttachmentService.create({
      messageId: messageId ?? null,
      kind: 'image',
      mimeType,
      storage,
      url: url ?? null,
      filePath: filePath ?? null,
      width: width ?? null,
      height: height ?? null,
      sizeBytes: sizeBytes ?? null,
      sha256: sha256 ?? null,
    })

    res.status(201).json(created)
  })
)

// Get a single attachment by id
router.get(
  '/attachments/:id',
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id)
    const found = AttachmentService.getById(id)
    if (!found) return res.status(404).json({ error: 'Attachment not found' })
    res.json(found)
  })
)

// List attachments for a message
router.get(
  '/messages/:id/attachments',
  asyncHandler(async (req, res) => {
    const messageId = parseInt(req.params.id)
    const attachments = MessageService.getAttachments(messageId)
    res.json(attachments)
  })
)

// Link existing attachments to a message
router.post(
  '/messages/:id/attachments',
  asyncHandler(async (req, res) => {
    const messageId = parseInt(req.params.id)
    const { attachmentIds } = req.body as { attachmentIds?: number[] }
    if (!Array.isArray(attachmentIds) || attachmentIds.length === 0) {
      return res.status(400).json({ error: 'attachmentIds must be a non-empty array' })
    }
    const attachments = MessageService.linkAttachments(messageId, attachmentIds)
    res.json(attachments)
  })
)

// Delete all attachments for a message
router.delete(
  '/messages/:id/attachments',
  asyncHandler(async (req, res) => {
    const messageId = parseInt(req.params.id)
    const deleted = AttachmentService.deleteByMessage(messageId)
    res.json({ deleted })
  })
)

// Unlink a single attachment from a message (preserve shared attachments)
router.delete(
  '/messages/:id/attachments/:attachmentId',
  asyncHandler(async (req, res) => {
    const messageId = parseInt(req.params.id)
    const attachmentId = parseInt(req.params.attachmentId)
    if (!Number.isFinite(messageId) || !Number.isFinite(attachmentId)) {
      return res.status(400).json({ error: 'Invalid ids' })
    }
    const updated = MessageService.unlinkAttachment(messageId, attachmentId)
    res.json(updated)
  })
)

// Abort an in-flight generation by message id
router.post(
  '/messages/:id/abort',
  asyncHandler(async (req, res) => {
    const messageId = parseInt(req.params.id)
    const success = abortGeneration(messageId)
    res.json({ success })
  })
)

export default router
