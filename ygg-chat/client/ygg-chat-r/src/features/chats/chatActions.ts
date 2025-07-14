import { createAsyncThunk } from '@reduxjs/toolkit'
import type { RootState } from '../../store/store'
import { apiCall, createStreamingRequest } from '../../utils/api'
import { chatActions } from './chatSlice'
import { ModelsResponse, SendMessagePayload } from './chatTypes'
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
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

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
    which means state changes must flow through a specific pathway. 
    You cannot directly modify the Redux store state like you would 
    with regular JavaScript objects. Instead, you must send actions 
    through the dispatch function, which then forwards them to the 
    appropriate reducers.
    */

    dispatch(chatActions.modelsLoadingStarted())

    try {
      const response = await apiCall<ModelsResponse>('/models')
      dispatch(chatActions.modelsLoaded(response))
      return response
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch models'
      dispatch(chatActions.modelsError(message))
      return rejectWithValue(message)
    }
  }
)

// Streaming message sending with proper error handling
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ conversationId, input }: SendMessagePayload, { dispatch, getState, rejectWithValue, signal }) => {
    //async ({ conversationId, input, parentId, childrenId }: SendMessagePayload, { dispatch, getState, rejectWithValue, signal }) => {

    dispatch(chatActions.sendingStarted())

    let controller: AbortController | undefined

    try {
      controller = new AbortController()

      // Combine signals for cancellation
      signal.addEventListener('abort', () => controller?.abort())

      // Get the current selected model or use the override
      const state = getState() as RootState
      // const parentId //store current parentID in root state
      // const childrenId //store and get childrenID from root state
      const modelName = input.modelOverride || state.chat.models.selected || state.chat.models.default

      if (!modelName) {
        throw new Error('No model selected')
      }

      const response = await createStreamingRequest(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: input.content.trim(),
          modelName: modelName,
          systemPrompt: input.systemPrompt,
          // parentId: parentId,
          // childrenId: childrenId
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to send message'}`)
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

              // Handle user message
              if (chunk.type === 'user_message' && chunk.message) {
                userMessage = chunk.message
                // TODO: Uncomment when conversations feature is available
                // dispatch(conversationActions.messageAdded(chunk.message))
              }

              // Handle streaming chunks
              dispatch(chatActions.streamChunkReceived(chunk))

              if (chunk.type === 'complete' && chunk.message) {
                messageId = chunk.message.id
                // Add the assistant message to conversations
                // TODO: Uncomment when conversations feature is available
                // dispatch(conversationActions.messageAdded(chunk.message))
              } else if (chunk.type === 'error') {
                throw new Error(chunk.error || 'Stream error')
              }
            } catch (parseError) {
              console.warn('Failed to parse chunk:', line, parseError)
              // Skip malformed chunks
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      if (messageId) {
        dispatch(chatActions.streamCompleted({ messageId }))
      }

      dispatch(chatActions.sendingCompleted())
      dispatch(chatActions.inputCleared())

      return { messageId, userMessage }
    } catch (error) {
      dispatch(chatActions.sendingCompleted())

      if (error instanceof Error && error.name === 'AbortError') {
        return rejectWithValue('Message cancelled')
      }

      const message = error instanceof Error ? error.message : 'Failed to send message'
      dispatch(chatActions.streamChunkReceived({ type: 'error', error: message }))
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

  dispatch(chatActions.modelSelected({ modelName, persist: true }))
  return modelName
})

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
