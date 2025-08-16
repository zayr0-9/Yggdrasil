import { createAsyncThunk } from '@reduxjs/toolkit'
import { RootState } from '../../store/store'
import { api } from '../../utils/api'
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
        title: title || 'New Conversation',
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

// delete conversation
