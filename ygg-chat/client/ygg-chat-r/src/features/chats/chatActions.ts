import { createAsyncThunk } from '@reduxjs/toolkit'
import type { RootState } from '../../store/store'
import { apiCall, createStreamingRequest } from '../../utils/api'
import { chatSliceActions } from './chatSlice'
import { BranchMessagePayload, EditMessagePayload, Message, ModelsResponse, SendMessagePayload } from './chatTypes'
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
    /* 
    Redux operates on a principle called "unidirectional data flow,"  
    You cannot directly modify the Redux store state instead, you must send actions 
    through the dispatch function, which then forwards them to the 
    appropriate reducers.
    */

    dispatch(chatSliceActions.modelsLoadingStarted())

    try {
      const response = await apiCall<ModelsResponse>('/models')
      dispatch(chatSliceActions.modelsLoaded(response))
      return response
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

// Provider-aware models fetch orchestrator
export const fetchModelsForCurrentProvider = createAsyncThunk(
  'chat/fetchModelsForCurrentProvider',
  async (force: boolean = false, { getState, dispatch, rejectWithValue }) => {
    const state = getState() as RootState
    const provider = (state.chat.providerState.currentProvider || 'ollama').toLowerCase()

    try {
      if (provider === 'google') {
        const res = await (dispatch as any)(fetchGeminiModels()).unwrap()
        console.log('4---------', res)
        return res
      }

      const res = await (dispatch as any)(fetchModels(force)).unwrap()
      return res
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch models for provider'
      dispatch(chatSliceActions.modelsError(message))
      return rejectWithValue(message)
    }
  }
)

// Streaming message sending with proper error handling
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async (
    { conversationId, input, parent, repeatNum }: SendMessagePayload,
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
      console.log('currentPathMessages', currentPathMessages)
      const modelName = input.modelOverride || state.chat.models.selected || state.chat.models.default
      // Map UI provider to server provider id
      const appProvider = (state.chat.providerState.currentProvider || 'ollama').toLowerCase()
      const serverProvider = appProvider === 'google' ? 'gemini' : appProvider
      let response = null

      if (!modelName) {
        throw new Error('No model selected')
      }
      console.log('last currentMessage - ', currentMessages?.at(-1)?.id)

      console.log(
        'finalMessage sent to the server ---------------------- ',
        currentPathMessages.map(m => ({
          id: m.id,
          conversation_id: m.conversation_id,
          parent_id: m.parent_id,
          children_ids: m.children_ids,
          role: m.role,
          content: m.content,
          created_at: m.created_at,
        }))
      )
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
            systemPrompt: input.systemPrompt,
            provider: serverProvider,
            repeatNum: repeatNum,
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
              content: m.content,
              created_at: m.created_at,
            })),
            content: input.content.trim(),
            modelName: modelName,
            // parentId: (currentPath && currentPath.length ? currentPath[currentPath.length - 1] : currentMessages?.at(-1)?.id) || undefined,
            parentId: parent,
            systemPrompt: input.systemPrompt,
            provider: serverProvider,
          }),
          signal: controller.signal,
        })
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to send message'}`)
      }

      console.log(response)

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No stream reader available')

      const decoder = new TextDecoder()
      let messageId: number | null = null
      let userMessage: any = null

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const lines = decoder.decode(value).split('\n')

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            try {
              const chunk = JSON.parse(line.slice(6))

              if (chunk.type === 'user_message' && chunk.message) {
                userMessage = chunk.message
                if (!chunk.message.timestamp) {
                  chunk.message.timestamp = new Date().toISOString()
                }
                dispatch(chatSliceActions.messageAdded(chunk.message))
              }

              // For streaming, accumulate or finalize per event
              if (chunk.type === 'chunk') {
                dispatch(chatSliceActions.streamChunkReceived(chunk))
              } else if (chunk.type === 'complete' && chunk.message) {
                // Push each assistant reply as its own message
                dispatch(chatSliceActions.messageAdded(chunk.message))
                // Reset streaming buffer for next iteration
                dispatch(chatSliceActions.streamChunkReceived({ type: 'reset' } as any))
                messageId = chunk.message.id
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
// Model selection with persistence
export const selectModel = createAsyncThunk('chat/selectModel', async (modelName: string, { dispatch, getState }) => {
  const state = getState() as RootState

  // Verify model exists
  if (!state.chat.models.available.includes(modelName)) {
    throw new Error(`Model ${modelName} not available`)
  }

  dispatch(chatSliceActions.modelSelected({ modelName, persist: true }))
  return modelName
})

export const updateMessage = createAsyncThunk(
  'chat/updateMessage',
  async ({ id, content }: { id: number; content: string }, { dispatch, rejectWithValue }) => {
    try {
      const updated = await apiCall<Message>(`/messages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      })
      dispatch(chatSliceActions.messageUpdated({ id, content }))
      return updated
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Update failed')
    }
  }
)

// Fetch conversation messages from server
export const fetchConversationMessages = createAsyncThunk(
  'chat/fetchConversationMessages',
  async (conversationId: number, { dispatch, rejectWithValue }) => {
    try {
      const messages = await apiCall<Message[]>(`/conversations/${conversationId}/messages`)
      dispatch(chatSliceActions.messagesLoaded(messages))
      return messages
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch messages')
    }
  }
)

export const deleteMessage = createAsyncThunk(
  'chat/deleteMessage',
  async ({ id, conversationId }: { id: number; conversationId: number }, { dispatch, rejectWithValue }) => {
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
    { conversationId, originalMessageId, newContent, modelOverride, systemPrompt }: EditMessagePayload,
    { dispatch, getState, rejectWithValue, signal }
  ) => {
    dispatch(chatSliceActions.sendingStarted())

    let controller: AbortController | undefined

    try {
      controller = new AbortController()
      signal.addEventListener('abort', () => controller?.abort())

      const state = getState() as RootState
      const originalMessage = state.chat.conversation.messages.find(m => m.id === originalMessageId)

      if (!originalMessage) {
        throw new Error('Original message not found')
      }

      // Find the parent of the original message to branch from
      const parentId = originalMessage.parent_id
      const modelName = modelOverride || state.chat.models.selected || state.chat.models.default
      // Map UI provider to server provider id
      const appProvider = (state.chat.providerState.currentProvider || 'ollama').toLowerCase()
      const serverProvider = appProvider === 'google' ? 'gemini' : appProvider

      if (!modelName) {
        throw new Error('No model selected')
      }

      // Create new user message as a branch
      const response = await createStreamingRequest(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newContent,
          modelName,
          parentId: parentId, // Branch from the same parent as original
          systemPrompt,
          provider: serverProvider,
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

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const lines = decoder.decode(value).split('\n')

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            try {
              const chunk = JSON.parse(line.slice(6))

              if (chunk.type === 'user_message' && chunk.message) {
                userMessage = chunk.message
                dispatch(chatSliceActions.messageBranchCreated({ newMessage: chunk.message }))
              }

              dispatch(chatSliceActions.streamChunkReceived(chunk))

              if (chunk.type === 'complete' && chunk.message) {
                messageId = chunk.message.id
                dispatch(chatSliceActions.messageBranchCreated({ newMessage: chunk.message }))
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
    { conversationId, parentId, content, modelOverride, systemPrompt }: BranchMessagePayload,
    { dispatch, getState, rejectWithValue, signal }
  ) => {
    dispatch(chatSliceActions.sendingStarted())

    let controller: AbortController | undefined

    try {
      controller = new AbortController()
      signal.addEventListener('abort', () => controller?.abort())

      const state = getState() as RootState
      const modelName = modelOverride || state.chat.models.selected || state.chat.models.default
      // Map UI provider to server provider id
      const appProvider = (state.chat.providerState.currentProvider || 'ollama').toLowerCase()
      const serverProvider = appProvider === 'google' ? 'gemini' : appProvider

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

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const lines = decoder.decode(value).split('\n')

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue

            try {
              const chunk = JSON.parse(line.slice(6))

              if (chunk.type === 'user_message' && chunk.message) {
                userMessage = chunk.message
                dispatch(chatSliceActions.messageBranchCreated({ newMessage: chunk.message }))
              }

              dispatch(chatSliceActions.streamChunkReceived(chunk))

              if (chunk.type === 'complete' && chunk.message) {
                messageId = chunk.message.id
                dispatch(chatSliceActions.messageBranchCreated({ newMessage: chunk.message }))
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
  async (conversationId: number, { dispatch, rejectWithValue }) => {
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
    { conversationId, messageId }: { conversationId: number; messageId: number },
    { getState, dispatch, rejectWithValue }
  ) => {
    try {
      // Fetch direct children of the deleted message from the server
      const children = await apiCall<number[]>(
        `/conversations/${conversationId}/messages/${messageId}/children`
      )

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
      const message =
        error instanceof Error ? error.message : 'Failed to refresh path after delete'
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

      dispatch(chatSliceActions.initializationCompleted({ userId: user.id, conversationId: conversation.id }))
      return { userId: user.id, conversationId: conversation.id }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize'
      dispatch(chatSliceActions.initializationError(message))
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
