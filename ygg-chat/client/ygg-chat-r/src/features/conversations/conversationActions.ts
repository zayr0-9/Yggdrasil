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
import type { BaseModel } from '../../../../../shared/types'

// Fetch conversations for current user (creates demo user if none)

// Fetch recently used models based on recent messages (server returns names)
export const fetchRecentModels = createAsyncThunk<BaseModel[], { limit?: number } | void>(
  'conversations/fetchRecentModels',
  async (args, { rejectWithValue }) => {
    try {
      const limit = args && typeof args.limit === 'number' ? args.limit : 5
      const query = new URLSearchParams({ limit: String(limit) }).toString()
      const res = await api.get<{ models: string[] }>(`/models/recent?${query}`)
      const models = Array.isArray(res?.models) ? res.models : []
      // Map plain names to BaseModel shape with sensible defaults
      const normalized: BaseModel[] = models.map(name => ({
        name,
        version: '',
        displayName: name,
        description: '',
        inputTokenLimit: 0,
        outputTokenLimit: 0,
        thinking: false,
        supportedGenerationMethods: [],
      }))
      return normalized
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to fetch recent models') as any
    }
  }
)
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

// Fetch recent conversations for current user with limit
export const fetchRecentConversations = createAsyncThunk<Conversation[], { limit?: number }, { state: RootState }>(
  'conversations/fetchRecent',
  async ({ limit = 10 } = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState()
      let userId = state.users.currentUser?.id
      if (!userId) {
        const user = await api.post<{ id: number }>('/users', { username: 'homepage-user' })
        userId = user.id
      }
      const query = new URLSearchParams({ limit: String(limit) }).toString()
      return await api.get<Conversation[]>(`/users/${userId}/conversations/recent?${query}`)
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to fetch recent conversations')
    }
  }
)

// Fetch conversations by project ID
export const fetchConversationsByProjectId = createAsyncThunk<Conversation[], number, { state: RootState }>(
  'conversations/fetchByProjectId',
  async (projectId: number, { rejectWithValue }) => {
    try {
      return await api.get<Conversation[]>(`/conversations/project/${projectId}`)
    } catch (err) {
      return rejectWithValue(err instanceof Error ? err.message : 'Failed to fetch conversations by project')
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

      // Get selected project ID from state
      const selectedProject = state.projects.selectedProject
      const projectId = selectedProject?.id || null

      return await api.post<Conversation>('/conversations', {
        userId,
        title: title || null,
        projectId,
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
      // console.log('dispatching convContext ', res)
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
