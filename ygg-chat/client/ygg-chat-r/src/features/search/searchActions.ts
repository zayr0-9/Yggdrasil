import { createAsyncThunk } from '@reduxjs/toolkit'
import { SearchResult } from './searchTypes'

// Async thunk to perform search against server API
export const performSearch = createAsyncThunk<SearchResult[], string, { rejectValue: string }>(
  'search/perform',
  async (query, { rejectWithValue }) => {
    try {
      const response = await fetch(`http://localhost:3001/api/search?q=${encodeURIComponent(query)}`)
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }
      const raw: any[] = await response.json()
      const data: SearchResult[] = raw.map(r => ({
        conversationId: r.conversation_id ?? r.conversationId,
        messageId: r.messageId ?? r.id?.toString(),
        content: r.content,
        createdAt: r.created_at ?? r.createdAt,
        highlighted: r.highlighted,
        conversationTitle: r.conversation_title ?? r.conversationTitle,
      }))
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return rejectWithValue(message)
    }
  }
)

// Async thunk to perform project-specific search
export const performProjectSearch = createAsyncThunk<
  SearchResult[], 
  { query: string; projectId: number }, 
  { rejectValue: string }
>(
  'search/performProject',
  async ({ query, projectId }, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/search/project?q=${encodeURIComponent(query)}&projectId=${projectId}`
      )
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }
      const raw: any[] = await response.json()
      const data: SearchResult[] = raw.map(r => ({
        conversationId: r.conversation_id ?? r.conversationId,
        messageId: r.messageId ?? r.id?.toString(),
        content: r.content,
        createdAt: r.created_at ?? r.createdAt,
        highlighted: r.highlighted,
        conversationTitle: r.conversation_title ?? r.conversationTitle,
      }))
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return rejectWithValue(message)
    }
  }
)
