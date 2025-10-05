import { createAsyncThunk } from '@reduxjs/toolkit'
import { apiCall } from '../../utils/api'
import { SearchResult } from './searchTypes'
import { ProjectId } from '../../../../../shared/types'

// Async thunk to perform search against server API
export const performSearch = createAsyncThunk<SearchResult[], string, { rejectValue: string }>(
  'search/perform',
  async (query, { rejectWithValue }) => {
    try {
      const raw: any[] = await apiCall<any[]>(`/search?q=${encodeURIComponent(query)}`)
      const data: SearchResult[] = raw.map(r => ({
        conversationId: r.conversation_id ?? r.conversationId,
        messageId: r.messageId ?? r.id?.toString(),
        content: r.content,
        createdAt: r.created_at ?? r.createdAt,
        highlighted: r.highlighted,
        conversationTitle: r.conversation_title ?? r.conversationTitle,
      }))
      return data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return rejectWithValue(message)
    }
  }
)

// Async thunk to perform project-specific search
export const performProjectSearch = createAsyncThunk<
  SearchResult[],
  { query: string; projectId?: ProjectId },
  { rejectValue: string }
>(
  'search/performProject',
  async ({ query, projectId }, { rejectWithValue }) => {
    try {
      const raw: any[] = await apiCall<any[]>(
        `/search/project?q=${encodeURIComponent(query)}&projectId=${projectId}`
      )
      const data: SearchResult[] = raw.map(r => ({
        conversationId: r.conversation_id ?? r.conversationId,
        messageId: r.messageId ?? r.id?.toString(),
        content: r.content,
        createdAt: r.created_at ?? r.createdAt,
        highlighted: r.highlighted,
        conversationTitle: r.conversation_title ?? r.conversationTitle,
      }))
      return data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return rejectWithValue(message)
    }
  }
)
