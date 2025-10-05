import { createAsyncThunk } from '@reduxjs/toolkit'
import { ConversationId, MessageId } from '../../../../../shared/types'
import type { RootState } from '../../store/store'
import { API_BASE, apiCall, createStreamingRequest } from '../../utils/api'
import type { Conversation } from '../conversations/conversationTypes'
import { selectSelectedProject } from '../projects/projectSelectors'
import { chatSliceActions } from './chatSlice'
import {
  Attachment,
  BranchMessagePayload,
  EditMessagePayload,
  Message,
  Model,
  ModelsResponse,
  SendMessagePayload,
  tools,
} from './chatTypes'
// TODO: Import when conversations feature is available
// import { conversationActions } from '../conversations'

/*
The Complete Toolkit: ThunkAPI Object
When you create an async thunk, the second parameter receives what's called the ThunkAPI object.
This is like a toolbox that Redux Toolkit hands you, containing everything you need to interact with the Redux ecosystem 
during async operations.
typescriptconst myAsyncThunk = createAsyncThunk(
  'feature/actionName',
  async (arg, thunkAPI) => {
    // thunkAPI contains all the utilities
    const { dispatch, getState, rejectWithValue, fulfillWithValue, signal, extra } = thunkAPI
  }
)
*/

// API base URL - configure based on environment
// const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Utility function for API calls
// const apiCall = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
//   const response = await fetch(`${API_BASE}${endpoint}`, {
//     headers: {
//       'Content-Type': 'application/json',
//       ...options?.headers,
//     },
//     ...options,
//   })

//   if (!response.ok) {
//     const errorText = await response.text()
//     throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`)
//   }

//   return response.json()
// }
// Helper: convert Blob to data URL
const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise(resolve => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })

// Resolve an attachment's accessible URL from url or file_path
const resolveAttachmentUrl = (urlOrPath?: string | null, filePath?: string | null): string | null => {
  const origin = API_BASE.replace(/\/?api\/?$/, '')
  if (urlOrPath) {
    if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath
    if (urlOrPath.startsWith('/')) return `${origin}${urlOrPath}`
  }
  if (filePath) {
    const fp = filePath.replace(/\\/g, '/')
    if (fp.startsWith('data/uploads/')) {
      const filename = fp.split('/').pop() || ''
      if (filename) return `${origin}/uploads/${filename}`
    }
    // Fallbacks
    if (fp.startsWith('/')) return `${origin}${fp}`
    return `${origin}/${fp}`
  }
  return null
}
// Helper function to convert model name string to Model object
const stringToModel = (modelName: string): Model => ({
  name: modelName,
  version: '1.0.0',
  displayName: modelName,
  description: `${modelName} model`,
  inputTokenLimit: 4096,
  outputTokenLimit: 2048,
  thinking: false,
  supportedGenerationMethods: ['chat', 'completion'],
})

// Model operations - cached and optimized
export const fetchModels = createAsyncThunk(
  'chat/fetchModels',
  async (force: boolean = false, { getState, dispatch, rejectWithValue }) => {
    const state = getState() as RootState //ensure state is same type as store for the whole website
    const lastRefresh = state.chat.models.lastRefresh

    // Skip if recently refreshed (30 seconds cache)
    if (!force && lastRefresh && Date.now() - lastRefresh < 30000) {
      return {
        models: state.chat.models.available,
        default: state.chat.models.default || state.chat.models.available[0],
      }
    }

    dispatch(chatSliceActions.modelsLoadingStarted())

    try {
      const response = await apiCall<{ models: string[]; default: string }>('/models')
      // Convert string arrays to Model objects
      const convertedResponse: ModelsResponse = {
        models: response.models.map(stringToModel),
        default: stringToModel(response.default),
      }
      dispatch(chatSliceActions.modelsLoaded(convertedResponse))
      return convertedResponse
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch models'
      dispatch(chatSliceActions.modelsError(message))
      return rejectWithValue(message)
    }
  }
)

// Fetch Gemini models from Google's Generative Language API and load into ModelState.available
export const fetchGeminiModels = createAsyncThunk(
  'chat/fetchGeminiModels',
  async (_: void, { dispatch, rejectWithValue }) => {
    dispatch(chatSliceActions.modelsLoadingStarted())

    try {
      const payload = await apiCall<ModelsResponse>('/models/gemini')
      dispatch(chatSliceActions.modelsLoaded(payload))
      return payload
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch Gemini models'
      dispatch(chatSliceActions.modelsError(message))
      return rejectWithValue(message)
    }
  }
)

// Fetch Anthropic models from Anthropic API and load into ModelState.available
export const fetchAnthropicModels = createAsyncThunk(
  'chat/fetchAnthropicModels',
  async (_: void, { dispatch, rejectWithValue }) => {
    dispatch(chatSliceActions.modelsLoadingStarted())

    try {
      const payload = await apiCall<ModelsResponse>('/models/anthropic')
      dispatch(chatSliceActions.modelsLoaded(payload))
      return payload
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch Anthropic models'
      dispatch(chatSliceActions.modelsError(message))
      return rejectWithValue(message)
    }
  }
)

// Fetch OpenAI models from OpenAI API and load into ModelState.available
export const fetchOpenAIModels = createAsyncThunk(
  'chat/fetchOpenAIModels',
  async (_: void, { dispatch, rejectWithValue }) => {
    dispatch(chatSliceActions.modelsLoadingStarted())

    try {
      const response = await apiCall<{ models: string[]; default: string }>('/models/openai')
      // Convert string arrays to Model objects (same as in fetchModels)
      const convertedResponse: ModelsResponse = {
        models: response.models.map(stringToModel),
        default: stringToModel(response.default),
      }
      dispatch(chatSliceActions.modelsLoaded(convertedResponse))
      return convertedResponse
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch OpenAI models'
      dispatch(chatSliceActions.modelsError(message))
      return rejectWithValue(message)
    }
  }
)
// Fetch openRouter models from openRouter API and load into ModelState.available
export const fetchOpenRouterModels = createAsyncThunk(
  'chat/fetchOpenRouterModels',
  async (_: void, { dispatch, rejectWithValue }) => {
    dispatch(chatSliceActions.modelsLoadingStarted())

    try {
      const payload = await apiCall<ModelsResponse>('/models/openrouter')
      dispatch(chatSliceActions.modelsLoaded(payload))
      return payload
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch OpenRouter models'
      dispatch(chatSliceActions.modelsError(message))
      return rejectWithValue(message)
    }
  }
)

// Fetch LM Studio models from LM Studio API and load into ModelState.available
export const fetchLMStudioModels = createAsyncThunk(
  'chat/fetchLMStudioModels',
  async (_: void, { dispatch, rejectWithValue }) => {
    dispatch(chatSliceActions.modelsLoadingStarted())

    try {
      const payload = await apiCall<ModelsResponse>('/models/lmstudio')
      dispatch(chatSliceActions.modelsLoaded(payload))
      return payload
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch LM Studio models'
      dispatch(chatSliceActions.modelsError(message))
      return rejectWithValue(message)
    }
  }
)

// Provider-aware models fetch orchestrator
export const fetchModelsForCurrentProvider = createAsyncThunk(
  'chat/fetchModelsForCurrentProvider',
  async (force: boolean = false, { getState, dispatch, rejectWithValue }) => {
    const state = getState() as RootState
    const provider = (state.chat.providerState.currentProvider || 'ollama').toLowerCase()

    try {
      if (provider === 'google') {
        const res = await (dispatch as any)(fetchGeminiModels()).unwrap()
        return res
      }
      if (provider === 'anthropic') {
        const res = await (dispatch as any)(fetchAnthropicModels()).unwrap()
        return res
      }
      if (provider === 'openai') {
        const res = await (dispatch as any)(fetchOpenAIModels()).unwrap()
        return res
      }
      if (provider === 'openrouter') {
        const res = await (dispatch as any)(fetchOpenRouterModels()).unwrap()
        return res
      }
      if (provider === 'lmstudio') {
        const res = await (dispatch as any)(fetchLMStudioModels()).unwrap()
        return res
      }
      const res = await (dispatch as any)(fetchModels(force)).unwrap()
      console.log('fetchModelsForCurrentProvider', res)
      return res
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch models for provider'
      dispatch(chatSliceActions.modelsError(message))
      return rejectWithValue(message)
    }
  }
)

// Model selection with persistence
export const selectModel = createAsyncThunk('chat/selectModel', async (model: Model, { dispatch, getState }) => {
  const state = getState() as RootState

  // Verify model exists
  if (!state.chat.models.available.includes(model)) {
    throw new Error(`Model ${model.name} not available`)
  }

  dispatch(chatSliceActions.modelSelected({ model, persist: true }))
  return model
})

// Streaming message sending with proper error handling
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (
    { conversationId, input, parent, repeatNum, think, retrigger = false }: SendMessagePayload,
    { dispatch, getState, rejectWithValue, signal }
  ) => {
    dispatch(chatSliceActions.sendingStarted())

    let controller: AbortController | undefined

    try {
      controller = new AbortController()
      signal.addEventListener('abort', () => controller?.abort())

      const state = getState() as RootState
      const { messages: currentMessages } = state.chat.conversation
      const currentPathIds = state.chat.conversation.currentPath
      const currentPathMessages = currentPathIds.map(id => currentMessages.find(m => m.id === id))
      const isFirstMessage = (currentMessages?.length || 0) === 0
      const selectedName = state.chat.models.selected?.name || state.chat.models.default?.name
      const modelName = input.modelOverride || selectedName
      // Map UI provider to server provider id
      const appProvider = (state.chat.providerState.currentProvider || 'ollama').toLowerCase()
      const serverProvider = appProvider === 'google' ? 'gemini' : appProvider
      // Gather any image drafts (base64) to send along with the message. Nullable when empty.
      const drafts = state.chat.composition.imageDrafts || []
      const attachmentsBase64 = drafts.length
        ? drafts.map(d => ({ dataUrl: d.dataUrl, name: d.name, type: d.type, size: d.size }))
        : null

      // Use project system prompt as fallback if conversation system prompt is empty
      const selectedProject = selectSelectedProject(state)
      const systemPrompt = state.conversations.systemPrompt || selectedProject?.system_prompt || ''

      // Get selected files for chat from IDE context
      const selectedFilesForChat = state.ideContext.selectedFilesForChat || []
      let response = null

      if (!modelName) {
        throw new Error('No model selected')
      }

      if (repeatNum > 1) {
        response = await createStreamingRequest(`/conversations/${conversationId}/messages/repeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: currentPathMessages.map(m => ({
              role: m.role,
              content: m.content,
            })),
            content: input.content.trim(),
            modelName: modelName,
            // parentId: (currentPath && currentPath.length ? currentPath[currentPath.length - 1] : currentMessages?.at(-1)?.id) || undefined,
            parentId: parent,
            systemPrompt: systemPrompt,
            provider: serverProvider,
            repeatNum: repeatNum,
            attachmentsBase64,
            selectedFiles: selectedFilesForChat,
            think,
            retrigger,
          }),
          signal: controller.signal,
        })
      } else {
        response = await createStreamingRequest(`/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: currentPathMessages.map(m => ({
              id: m.id,
              conversation_id: m.conversation_id,
              parent_id: m.parent_id,
              children_ids: m.children_ids,
              role: m.role,
              thinking_block: m.thinking_block,
              content: m.content,
              created_at: m.created_at,
            })),
            content: input.content.trim(),
            modelName: modelName,
            // parentId: (currentPath && currentPath.length ? currentPath[currentPath.length - 1] : currentMessages?.at(-1)?.id) || undefined,
            parentId: parent,
            systemPrompt: systemPrompt,
            provider: serverProvider,
            attachmentsBase64,
            selectedFiles: selectedFilesForChat,
            think,
            retrigger,
          }),
          signal: controller.signal,
        })
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to send message'}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No stream reader available')

      const decoder = new TextDecoder()
      let messageId: number | null = null
      let userMessage: any = null
      // Guard to ensure we only try to update the title once per send
      let titleUpdated = false
      // Buffer for incomplete lines across chunks
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Append new data to buffer and split by newlines
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')

          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            try {
              const chunk = JSON.parse(line.slice(6))

              if (chunk.type === 'user_message' && chunk.message) {
                userMessage = chunk.message
                if (!chunk.message.timestamp) {
                  chunk.message.timestamp = new Date().toISOString()
                }
                // Add to messages list
                dispatch(chatSliceActions.messageAdded(chunk.message))
                // And update currentPath to navigate to this new node
                dispatch(chatSliceActions.messageBranchCreated({ newMessage: chunk.message }))
                // Clear optimistic message immediately when real user message confirmed (web mode only)
                const isWebMode = import.meta.env.VITE_ENVIRONMENT === 'web'
                if (isWebMode) {
                  dispatch(chatSliceActions.optimisticMessageCleared())
                }
                // Live-update: append current image drafts to this new user message's artifacts
                if (drafts.length > 0) {
                  dispatch(
                    chatSliceActions.messageArtifactsAppended({
                      messageId: chunk.message.id,
                      artifacts: drafts.map(d => d.dataUrl),
                    })
                  )
                }
                // Auto-update conversation title with first 50 characters of the first user message
                if (isFirstMessage && !titleUpdated) {
                  const contentForTitle = (chunk.message?.content || '').trim().replace(/\s+/g, ' ')
                  const baseTitle = contentForTitle.slice(0, 50)
                  const title = baseTitle ? `${baseTitle}...` : ''
                  if (title) {
                    ;(dispatch as any)(updateConversationTitle({ id: conversationId, title }))
                    titleUpdated = true
                  }
                }
              }

              // For streaming, accumulate or finalize per event
              if (chunk.type === 'generation_started') {
                dispatch(chatSliceActions.streamChunkReceived(chunk))
              } else if (chunk.type === 'chunk') {
                dispatch(chatSliceActions.streamChunkReceived(chunk))
              } else if (chunk.type === 'complete' && chunk.message) {
                // Push each assistant reply as its own message
                dispatch(chatSliceActions.messageAdded(chunk.message))
                // Update branch/path to point to the completed assistant message
                dispatch(chatSliceActions.messageBranchCreated({ newMessage: chunk.message }))
                // Reset streaming buffer for next iteration
                dispatch(chatSliceActions.streamChunkReceived({ type: 'reset' } as any))
                messageId = chunk.message.id
              } else if (chunk.type === 'aborted') {
                // Server deleted the empty assistant message, no need to keep it in client state
                dispatch(chatSliceActions.streamChunkReceived({ type: 'error', error: 'Generation aborted' }))
              } else if (chunk.type === 'error') {
                dispatch(chatSliceActions.streamChunkReceived(chunk))
                throw new Error(chunk.error || 'Stream error')
              }
            } catch (parseError) {
              console.warn('Failed to parse chunk:', line, parseError)
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      if (messageId) {
        dispatch(chatSliceActions.streamCompleted({ messageId }))
      }

      dispatch(chatSliceActions.sendingCompleted())
      dispatch(chatSliceActions.inputCleared())

      return { messageId, userMessage }
    } catch (error) {
      dispatch(chatSliceActions.sendingCompleted())

      if (error instanceof Error && error.name === 'AbortError') {
        return rejectWithValue('Message cancelled')
      }

      const message = error instanceof Error ? error.message : 'Failed to send message'
      dispatch(chatSliceActions.streamChunkReceived({ type: 'error', error: message }))
      return rejectWithValue(message)
    }
  }
)

export const updateMessage = createAsyncThunk(
  'chat/updateMessage',
  async ({ id, content, note }: { id: MessageId; content: string; note?: string }, { dispatch, rejectWithValue }) => {
    try {
      const updated = await apiCall<Message>(`/messages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ content, note }),
      })
      dispatch(chatSliceActions.messageUpdated({ id, content, note }))
      return updated
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Update failed')
    }
  }
)

// Fetch conversation messages from server
export const fetchConversationMessages = createAsyncThunk(
  'chat/fetchConversationMessages',
  async (conversationId: ConversationId, { dispatch, rejectWithValue, getState }) => {
    try {
      const raw = await apiCall<Message[]>(`/conversations/${conversationId}/messages`)
      // Ensure client-only fields exist
      const messages: Message[] = (raw || []).map(m => ({
        ...m,
        pastedContext: Array.isArray((m as any).pastedContext) ? (m as any).pastedContext : [],
        artifacts: Array.isArray((m as any).artifacts) ? (m as any).artifacts : [],
      }))

      dispatch(chatSliceActions.messagesLoaded(messages))

      // Conditional attachments fetch: only when metadata indicates or when metadata absent (back-compat)
      const state = getState() as RootState
      const attachmentsByMessage = state.chat.attachments.byMessage || {}

      for (const msg of messages) {
        const alreadyFetched = Array.isArray(attachmentsByMessage[msg.id]) && attachmentsByMessage[msg.id].length > 0
        const hasMeta = typeof msg.has_attachments !== 'undefined' || typeof msg.attachments_count !== 'undefined'
        const indicatesAttachments =
          msg.has_attachments === true || (typeof msg.attachments_count === 'number' && msg.attachments_count > 0)

        if (!alreadyFetched) {
          if ((hasMeta && indicatesAttachments) || !hasMeta /* fallback to previous behavior */) {
            // Fire-and-forget; errors handled inside thunk
            dispatch(fetchAttachmentsByMessage({ messageId: msg.id }))
          }
        }
      }

      return messages
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch messages')
    }
  }
)

export const deleteMessage = createAsyncThunk(
  'chat/deleteMessage',
  async ({ id, conversationId }: { id: MessageId; conversationId: ConversationId }, { dispatch, rejectWithValue }) => {
    try {
      await apiCall(`/messages/${id}`, { method: 'DELETE' })
      // Refetch conversation messages to ensure sync with server
      await dispatch(fetchConversationMessages(conversationId))
      return id
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Delete failed')
    }
  }
)

// Branch message when editing - creates new branch while preserving original
export const editMessageWithBranching = createAsyncThunk(
  'chat/editMessageWithBranching',
  async (
    { conversationId, originalMessageId, newContent, modelOverride, think }: EditMessagePayload,
    { dispatch, getState, rejectWithValue, signal }
  ) => {
    dispatch(chatSliceActions.sendingStarted())

    let controller: AbortController | undefined

    try {
      controller = new AbortController()
      signal.addEventListener('abort', () => controller?.abort())

      const state = getState() as RootState
      const originalMessage = state.chat.conversation.messages.find(m => m.id === originalMessageId)
      const { messages: currentMessages } = state.chat.conversation
      const currentPathIds = state.chat.conversation.currentPath
      // Truncate path to only include messages strictly before the originalMessageId
      const idxOriginal = currentPathIds.indexOf(originalMessageId)
      const truncatedPathIds = idxOriginal >= 0 ? currentPathIds.slice(0, idxOriginal) : currentPathIds
      console.log('currentPathIds branch (truncated) ---', truncatedPathIds)
      const currentPathMessages = truncatedPathIds
        .map(id => currentMessages.find(m => m.id === id))
        .filter(Boolean) as Message[]
      const selectedName = state.chat.models.selected?.name || state.chat.models.default?.name
      const modelName = modelOverride || selectedName
      const parentId = originalMessage.parent_id

      // Map UI provider to server provider id
      const appProvider = (state.chat.providerState.currentProvider || 'ollama').toLowerCase()
      const serverProvider = appProvider === 'google' ? 'gemini' : appProvider

      // Use project system prompt as fallback if conversation system prompt is empty
      const selectedProject = selectSelectedProject(state)
      const systemPrompt = state.conversations.systemPrompt || selectedProject?.system_prompt || ''
      const drafts = state.chat.composition.imageDrafts || []
      // Build attachments: existing artifacts minus deleted (backup) + current drafts
      const artifactsExisting: string[] = Array.isArray(originalMessage.artifacts)
        ? (originalMessage.artifacts as string[])
        : []
      const deletedBackup: string[] = state.chat.attachments.backup?.[originalMessageId] || []
      const existingMinusDeleted = artifactsExisting.filter(a => !deletedBackup.includes(a))
      const draftDataUrls = drafts.map(d => d.dataUrl)
      const combinedArtifacts = [...existingMinusDeleted, ...draftDataUrls]
      const attachmentsBase64 = combinedArtifacts.length ? combinedArtifacts.map(dataUrl => ({ dataUrl })) : null

      // Before sending, reflect current image drafts in the UI by appending them
      // to the artifacts of the message being branched from.
      if (drafts.length > 0) {
        dispatch(
          chatSliceActions.messageArtifactsAppended({
            messageId: originalMessageId,
            artifacts: drafts.map(d => d.dataUrl),
          })
        )
      }

      if (!modelName) {
        throw new Error('No model selected')
      }
      const selectedFilesForChat = state.ideContext.selectedFilesForChat || []

      // Create new user message as a branch
      const response = await createStreamingRequest(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentPathMessages.map(m => ({
            id: m.id,
            conversation_id: m.conversation_id,
            parent_id: m.parent_id,
            children_ids: m.children_ids,
            role: m.role,
            thinking_block: m.thinking_block,
            content: m.content,
            created_at: m.created_at,
          })),
          content: newContent,
          modelName,
          parentId: parentId, // Branch from the same parent as original
          systemPrompt: systemPrompt,
          provider: serverProvider,
          attachmentsBase64,
          selectedFiles: selectedFilesForChat,
          think,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No stream reader available')

      const decoder = new TextDecoder()
      let messageId: number | null = null
      let userMessage: any = null
      // Buffer for incomplete lines across chunks
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Append new data to buffer and split by newlines
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')

          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            try {
              const chunk = JSON.parse(line.slice(6))

              if (chunk.type === 'user_message' && chunk.message) {
                userMessage = chunk.message
                // Ensure message is in store
                if (!chunk.message.timestamp) {
                  chunk.message.timestamp = new Date().toISOString()
                }
                dispatch(chatSliceActions.messageAdded(chunk.message))
                // And update currentPath to this new user branch node
                dispatch(chatSliceActions.messageBranchCreated({ newMessage: chunk.message }))
                // Live-update: ensure the new branched user message shows all intended artifacts immediately
                // Use the combined list (existing - deleted + drafts) we computed prior to the request
                if (combinedArtifacts.length > 0) {
                  dispatch(
                    chatSliceActions.messageArtifactsSet({
                      messageId: chunk.message.id,
                      artifacts: combinedArtifacts,
                    })
                  )
                }

                // Clear optimistic branch message immediately when real branch message confirmed (web mode only)
                const isWebMode = import.meta.env.VITE_ENVIRONMENT === 'web'
                if (isWebMode) {
                  dispatch(chatSliceActions.optimisticBranchMessageCleared())
                }
              }

              if (chunk.type === 'generation_started') {
                dispatch(chatSliceActions.streamChunkReceived(chunk))
              } else {
                dispatch(chatSliceActions.streamChunkReceived(chunk))
              }

              if (chunk.type === 'complete' && chunk.message) {
                messageId = chunk.message.id
                // Store assistant message
                dispatch(chatSliceActions.messageAdded(chunk.message))
                // Navigate path to completed assistant reply
                dispatch(chatSliceActions.messageBranchCreated({ newMessage: chunk.message }))
              } else if (chunk.type === 'aborted') {
                // Server deleted the empty assistant message, no need to keep it in client state
                dispatch(chatSliceActions.streamChunkReceived({ type: 'error', error: 'Generation aborted' }))
              } else if (chunk.type === 'error') {
                throw new Error(chunk.error || 'Stream error')
              }
            } catch (parseError) {
              console.warn('Failed to parse chunk:', line, parseError)
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      if (messageId) {
        dispatch(chatSliceActions.streamCompleted({ messageId }))
        // Clear backup after successfully creating the branch
        dispatch(chatSliceActions.messageArtifactsBackupCleared({ messageId: originalMessageId }))
      }

      dispatch(chatSliceActions.sendingCompleted())
      return { messageId, userMessage, originalMessageId }
    } catch (error) {
      dispatch(chatSliceActions.sendingCompleted())

      if (error instanceof Error && error.name === 'AbortError') {
        return rejectWithValue('Message cancelled')
      }

      const message = error instanceof Error ? error.message : 'Failed to edit message'
      dispatch(chatSliceActions.streamChunkReceived({ type: 'error', error: message }))
      return rejectWithValue(message)
    }
  }
)

// Send message to specific branch
export const sendMessageToBranch = createAsyncThunk(
  'chat/sendMessageToBranch',
  async (
    { conversationId, parentId, content, modelOverride, systemPrompt, think }: BranchMessagePayload,
    { dispatch, getState, rejectWithValue, signal }
  ) => {
    dispatch(chatSliceActions.sendingStarted())

    let controller: AbortController | undefined

    try {
      controller = new AbortController()
      signal.addEventListener('abort', () => controller?.abort())

      const state = getState() as RootState
      const selectedName = state.chat.models.selected?.name || state.chat.models.default?.name
      const modelName = modelOverride || selectedName
      // Map UI provider to server provider id
      const appProvider = (state.chat.providerState.currentProvider || 'ollama').toLowerCase()
      const serverProvider = appProvider === 'google' ? 'gemini' : appProvider
      const drafts = state.chat.composition.imageDrafts || []
      const attachmentsBase64 = drafts.length
        ? drafts.map(d => ({ dataUrl: d.dataUrl, name: d.name, type: d.type, size: d.size }))
        : null

      if (!modelName) {
        throw new Error('No model selected')
      }

      const response = await createStreamingRequest(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          modelName,
          parentId,
          systemPrompt,
          provider: serverProvider,
          attachmentsBase64,
          think,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No stream reader available')

      const decoder = new TextDecoder()
      let messageId: number | null = null
      let userMessage: any = null
      // Buffer for incomplete lines across chunks
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Append new data to buffer and split by newlines
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')

          // Keep the last incomplete line in the buffer
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            try {
              const chunk = JSON.parse(line.slice(6))

              if (chunk.type === 'user_message' && chunk.message) {
                userMessage = chunk.message
                dispatch(chatSliceActions.messageBranchCreated({ newMessage: chunk.message }))
              }

              if (chunk.type === 'generation_started') {
                dispatch(chatSliceActions.streamChunkReceived(chunk))
              } else {
                dispatch(chatSliceActions.streamChunkReceived(chunk))
              }

              if (chunk.type === 'complete' && chunk.message) {
                messageId = chunk.message.id
                dispatch(chatSliceActions.messageBranchCreated({ newMessage: chunk.message }))
              } else if (chunk.type === 'aborted') {
                // Server deleted the empty assistant message, no need to keep it in client state
                dispatch(chatSliceActions.streamChunkReceived({ type: 'error', error: 'Generation aborted' }))
              } else if (chunk.type === 'error') {
                throw new Error(chunk.error || 'Stream error')
              }
            } catch (parseError) {
              console.warn('Failed to parse chunk:', line, parseError)
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      if (messageId) {
        dispatch(chatSliceActions.streamCompleted({ messageId }))
      }

      dispatch(chatSliceActions.sendingCompleted())
      dispatch(chatSliceActions.inputCleared())
      return { messageId, userMessage }
    } catch (error) {
      dispatch(chatSliceActions.sendingCompleted())

      if (error instanceof Error && error.name === 'AbortError') {
        return rejectWithValue('Message cancelled')
      }

      const message = error instanceof Error ? error.message : 'Failed to send message'
      dispatch(chatSliceActions.streamChunkReceived({ type: 'error', error: message }))
      return rejectWithValue(message)
    }
  }
)

// Fetch Heimdall message tree
export const fetchMessageTree = createAsyncThunk(
  'chat/fetchMessageTree',
  async (conversationId: ConversationId, { dispatch, rejectWithValue, getState }) => {
    // Gating: avoid duplicate in-flight fetches and throttle rapid refetches
    const state = getState() as RootState
    const { heimdall } = state.chat
    const now = Date.now()
    if (heimdall.loading && heimdall.lastConversationId === conversationId) {
      // Skip: already fetching for this conversation
      return null as any
    }
    if (
      heimdall.lastConversationId === conversationId &&
      typeof heimdall.lastFetchedAt === 'number' &&
      now - heimdall.lastFetchedAt < 250
    ) {
      // Skip: fetched very recently for same conversation
      return null as any
    }

    dispatch(chatSliceActions.heimdallLoadingStarted())
    try {
      const treeData = await apiCall<any>(`/conversations/${conversationId}/messages/tree`)
      dispatch(chatSliceActions.heimdallDataLoaded({ treeData }))
      return treeData
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch message tree'
      dispatch(chatSliceActions.heimdallError(message))
      return rejectWithValue(message)
    }
  }
)

// Refresh currentPath after a cascade delete (server deletes a message and its subtree)
export const refreshCurrentPathAfterDelete = createAsyncThunk(
  'chat/refreshCurrentPathAfterDelete',
  async (
    { conversationId, messageId }: { conversationId: ConversationId; messageId: MessageId },
    { getState, dispatch, rejectWithValue }
  ) => {
    try {
      // Fetch direct children of the deleted message from the server
      const children = await apiCall<MessageId[]>(`/conversations/${conversationId}/messages/${messageId}/children`)

      const state = getState() as RootState
      const currentPath = state.chat.conversation.currentPath || []

      let newPath = currentPath

      // If the deleted message itself is on the path, truncate before it
      const idxDeleted = currentPath.indexOf(messageId)
      if (idxDeleted !== -1) {
        newPath = currentPath.slice(0, idxDeleted)
      } else if (children && children.length > 0) {
        // Otherwise, if any of its direct children are on the path, truncate before the first occurrence
        const childSet = new Set(children)
        const firstChildIdx = currentPath.findIndex(id => childSet.has(id))
        if (firstChildIdx !== -1) {
          newPath = currentPath.slice(0, firstChildIdx)
        }
      }

      // Only dispatch if the path actually changes
      if (newPath !== currentPath) {
        dispatch(chatSliceActions.conversationPathSet(newPath))
      }

      return { children, newPath }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh path after delete'
      return rejectWithValue(message)
    }
  }
)

// Initialize user and conversation
export const initializeUserAndConversation = createAsyncThunk(
  'chat/initializeUserAndConversation',
  async (_arg, { dispatch, rejectWithValue }) => {
    dispatch(chatSliceActions.initializationStarted())
    try {
      // Create test user
      const user = await apiCall<{ id: number }>('/users', {
        method: 'POST',
        body: JSON.stringify({ username: 'test-user' }),
      })

      // Create new conversation
      const conversation = await apiCall<{ id: number }>(`/conversations`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.id }),
      })

      dispatch(chatSliceActions.initializationCompleted({ userId: String(user.id), conversationId: conversation.id }))
      return { userId: user.id, conversationId: conversation.id }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize'
      dispatch(chatSliceActions.initializationError(message))
      return rejectWithValue(message)
    }
  }
)

// Delete multiple messages by their IDs
export const deleteSelectedNodes = createAsyncThunk(
  'chat/deleteSelectedNodes',
  async (ids: MessageId[], { rejectWithValue }) => {
    try {
      const response = await apiCall<{ deleted: number }>('/messages/deleteMany', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      })
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete messages'
      return rejectWithValue(message)
    }
  }
)

// Update a conversation title (Chat feature convenience)
export const updateConversationTitle = createAsyncThunk<Conversation, { id: ConversationId; title: string }>(
  'chat/updateConversationTitle',
  async ({ id, title }, { rejectWithValue }) => {
    try {
      return await apiCall<Conversation>(`/conversations/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update conversation'
      return rejectWithValue(message)
    }
  }
)

/* Attachments: upload, link, fetch, delete */

// Upload an image file as multipart/form-data to /api/attachments
export const uploadAttachment = createAsyncThunk<Attachment, { file: File; messageId?: number | null }>(
  'chat/uploadAttachment',
  async ({ file, messageId }, { dispatch, rejectWithValue }) => {
    try {
      const form = new FormData()
      form.append('file', file)
      if (messageId != null) form.append('messageId', String(messageId))

      const attachment = await apiCall<Attachment>('/attachments', {
        method: 'POST',
        body: form,
      })

      if (attachment.message_id != null) {
        dispatch(
          chatSliceActions.attachmentUpsertedForMessage({
            messageId: attachment.message_id,
            attachment,
          })
        )
      }

      return attachment
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload attachment'
      return rejectWithValue(message)
    }
  }
)

// Link existing attachments to a message
export const linkAttachmentsToMessage = createAsyncThunk<Attachment[], { messageId: number; attachmentIds: number[] }>(
  'chat/linkAttachmentsToMessage',
  async ({ messageId, attachmentIds }, { dispatch, rejectWithValue }) => {
    try {
      const attachments = await apiCall<Attachment[]>(`/messages/${messageId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({ attachmentIds }),
      })

      dispatch(chatSliceActions.attachmentsSetForMessage({ messageId, attachments }))
      return attachments
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to link attachments'
      return rejectWithValue(message)
    }
  }
)

// Fetch attachments for a message
export const fetchAttachmentsByMessage = createAsyncThunk<Attachment[], { messageId: MessageId }>(
  'chat/fetchAttachmentsByMessage',
  async ({ messageId }, { dispatch, rejectWithValue }) => {
    try {
      const attachments = await apiCall<Attachment[]>(`/messages/${messageId}/attachments`)
      dispatch(chatSliceActions.attachmentsSetForMessage({ messageId, attachments }))
      // Fetch binaries and convert to base64 data URLs
      const dataUrls: string[] = (
        await Promise.all(
          (attachments || []).map(async a => {
            const url = resolveAttachmentUrl(a.url, a.file_path)
            if (!url) return null
            try {
              const res = await fetch(url)
              if (!res.ok) return null
              const blob = await res.blob()
              const dataUrl = await blobToDataURL(blob)
              return dataUrl
            } catch {
              return null
            }
          })
        )
      ).filter((x): x is string => Boolean(x))

      dispatch(chatSliceActions.messageArtifactsSet({ messageId, artifacts: dataUrls }))
      return attachments
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch attachments'
      return rejectWithValue(message)
    }
  }
)

// Delete all attachments for a message
export const deleteAttachmentsByMessage = createAsyncThunk<{ deleted: number }, { messageId: number }>(
  'chat/deleteAttachmentsByMessage',
  async ({ messageId }, { dispatch, rejectWithValue }) => {
    try {
      const result = await apiCall<{ deleted: number }>(`/messages/${messageId}/attachments`, {
        method: 'DELETE',
      })
      dispatch(chatSliceActions.attachmentsClearedForMessage(messageId))
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete attachments'
      return rejectWithValue(message)
    }
  }
)

// Fetch a single attachment by ID
export const fetchAttachmentById = createAsyncThunk<Attachment, { id: MessageId }>(
  'chat/fetchAttachmentById',
  async ({ id }, { dispatch, rejectWithValue }) => {
    try {
      const attachment = await apiCall<Attachment>(`/attachments/${id}`)
      if (attachment.message_id != null) {
        dispatch(
          chatSliceActions.attachmentUpsertedForMessage({
            messageId: attachment.message_id,
            attachment,
          })
        )
      }
      return attachment
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch attachment'
      return rejectWithValue(message)
    }
  }
)

// Abort a running generation
export const abortStreaming = createAsyncThunk<
  { success: boolean; messageDeleted?: boolean },
  { messageId: MessageId },
  { state: RootState }
>('chat/abortStreaming', async ({ messageId }, { dispatch, getState, rejectWithValue }) => {
  try {
    const response = await apiCall<{ success: boolean; messageDeleted?: boolean }>(`/messages/${messageId}/abort`, {
      method: 'POST',
    })

    if (response.success) {
      dispatch(chatSliceActions.streamingAborted())

      // If the assistant message was deleted, refetch messages to update the UI
      if (response.messageDeleted) {
        const state = getState()
        const conversationId = state.chat.conversation.currentConversationId
        if (conversationId) {
          // Stabilize the currentPath first by truncating past the deleted leaf
          // Pass the user messageId (the generation root); the thunk will truncate before any direct child on path
          // dispatch(
          //   refreshCurrentPathAfterDelete({ conversationId, messageId })
          // )
          dispatch(fetchConversationMessages(conversationId))
        }
      }
    }

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to abort generation'
    return rejectWithValue(message)
  }
})

// Fetch available tools
export const fetchTools = createAsyncThunk('chat/fetchTools', async (_, { dispatch, rejectWithValue }) => {
  try {
    const response = await apiCall<{ tools: tools[] }>('/tools')
    dispatch(chatSliceActions.toolsLoaded(response.tools))
    return response.tools
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch tools'
    dispatch(chatSliceActions.toolsError(message))
    return rejectWithValue(message)
  }
})

// Update tool enabled status
export const updateToolEnabled = createAsyncThunk(
  'chat/updateToolEnabled',
  async ({ toolName, enabled }: { toolName: string; enabled: boolean }, { dispatch, rejectWithValue }) => {
    try {
      const response = await apiCall<{ success: boolean; tool: tools; message: string }>(`/tools/${toolName}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      })

      // Refresh tools list to get updated state
      dispatch(fetchTools())

      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update tool'
      return rejectWithValue(message)
    }
  }
)

// Bulk insert messages (for copying message chains to new conversation)
export const insertBulkMessages = createAsyncThunk(
  'chat/insertBulkMessages',
  async (
    {
      conversationId,
      messages,
    }: {
      conversationId: ConversationId
      messages: Array<{
        role: 'user' | 'assistant'
        content: string
        thinking_block?: string
        model_name?: string
        tool_calls?: string
        note?: string
      }>
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await apiCall<{ messages: Message[] }>(`/conversations/${conversationId}/messages/bulk`, {
        method: 'POST',
        body: JSON.stringify({ messages }),
      })
      return response.messages
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to insert bulk messages'
      return rejectWithValue(message)
    }
  }
)

// export const fetchMessageTree = createAsyncThunk(
//   'chat/fetchMessageTree',
//   async (conversationId: number, { dispatch, rejectWithValue }) => {
//     dispatch(chatActions.messageTreeLoadingStarted())

//     try {
//       const treeData = await apiCall<any>(`/conversations/${conversationId}/messages/tree`)
//       dispatch(chatActions.messageTreeLoaded({ conversationId, treeData }))
//       return treeData
//     } catch (error) {
//       const message = error instanceof Error ? error.message : 'Failed to fetch message tree'
//       dispatch(chatActions.messageTreeError(message))
//       return rejectWithValue(message)
//     }
//   }
// )
