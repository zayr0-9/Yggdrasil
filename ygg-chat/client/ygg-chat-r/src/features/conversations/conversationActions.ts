import { createAsyncThunk } from '@reduxjs/toolkit'
import { RootState } from '../../store/store'
import {
  api,
  getConversationContext,
  getConversationSystemPrompt,
  patchConversationContext,
  patchConversationSystemPrompt,
  type SystemPromptPatchResponse,
} from '../../utils/api'
import { convContextSet, systemPromptSet } from './conversationSlice'
import { Conversation } from './conversationTypes'

// Fetch conversations for current user (creates demo user if none)
export const fetchConversations = createAsyncThunk<Conversation[], void, { state: RootState }>(
  'conversations/fetchAll',
  async (_: void, { getState, rejectWithValue }) => {
    try {
      // ensure demo user
      const state = getState()
      let userId = state.users.currentUser?.id
      if (!userId) {
        const user = await api.post<{
          id: number
        }>('/users', { username: 'homepage-user' })
        userId = user.id
      }
      return await api.get<Conversation[]>(`/users/${userId}/conversations`)
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to fetch conversations')
    }
  }
)

// Create new conversation for current user
export const createConversation = createAsyncThunk<Conversation, { title?: string }, { state: RootState }>(
  'conversations/create',
  async ({ title }, { getState, rejectWithValue }) => {
    try {
      const state = getState()
      let userId = state.users.currentUser?.id
      if (!userId) {
        const user = await api.post<{ id: number }>('/users', { username: 'homepage-user' })
        userId = user.id
      }
      return await api.post<Conversation>('/conversations', {
        userId,
        title: title || null,
      })
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to create conversation')
    }
  }
)

// Update conversation title by id
export const updateConversation = createAsyncThunk<Conversation, { id: number; title: string }, { state: RootState }>(
  'conversations/update',
  async ({ id, title }, { rejectWithValue }) => {
    try {
      return await api.patch<Conversation>(`/conversations/${id}/`, { title })
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to update conversation')
    }
  }
)

// Delete conversation by id
export const deleteConversation = createAsyncThunk<number, { id: number }, { state: RootState }>(
  'conversations/delete',
  async ({ id }, { rejectWithValue }) => {
    try {
      await api.delete(`/conversations/${id}/`)
      return id
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to delete conversation')
    }
  }
)

// Fetch the conversation system prompt and store in state.chat.systemPrompt
export const fetchSystemPrompt = createAsyncThunk<string | null, number>(
  'chat/fetchSystemPrompt',
  async (conversationId, { dispatch, rejectWithValue }) => {
    try {
      const res = await getConversationSystemPrompt(conversationId)
      const value = typeof res.systemPrompt === 'string' ? res.systemPrompt : null
      dispatch(systemPromptSet(value))
      return value
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch system prompt'
      return rejectWithValue(message) as any
    }
  }
)

// Fetch conversation context
export const fetchContext = createAsyncThunk<string | null, number>(
  'chat/fetchContext',
  async (conversationId, { dispatch, rejectWithValue }) => {
    try {
      const res = await getConversationContext(conversationId)
      const value = res.context
      console.log('dispatching convContext ', res)
      dispatch(convContextSet(value))
      return value
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch context'
      return rejectWithValue(message) as any
    }
  }
)
// Update the conversation system prompt on the server and reflect in state
export const updateSystemPrompt = createAsyncThunk<
  SystemPromptPatchResponse,
  { id: number; systemPrompt: string | null }
>('chat/updateSystemPrompt', async ({ id, systemPrompt }, { dispatch, rejectWithValue }) => {
  try {
    const updated = await patchConversationSystemPrompt(id, systemPrompt)
    // Server returns updated Conversation with snake_case system_prompt
    // Mirror to client state
    dispatch(systemPromptSet((updated as any).system_prompt ?? null))
    return updated
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update system prompt'
    return rejectWithValue(message) as any
  }
})

export const updateContext = createAsyncThunk<
  { id: number; context: string | null }, // return type
  { id: number; context: string | null } // argument type
>('chat/updateContext', async ({ id, context }, { dispatch, rejectWithValue }) => {
  try {
    const updated = await patchConversationContext(id, context) // ConversationPatchResponse
    const next = { id: updated.id, context: updated.conversation_context ?? null }
    dispatch(convContextSet(next.context))
    return next
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update context'
    return rejectWithValue(message) as any
  }
})
