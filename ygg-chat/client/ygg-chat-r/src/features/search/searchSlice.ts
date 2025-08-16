// searchSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { SearchHistoryItem, SearchResult, SearchState } from './searchTypes'

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

const initialState: SearchState = {
  query: '',
  results: [],
  history: [],
  loading: false,
  error: null,
  focusedMessageId: null,
  focusedConversationId: null,
}

export const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    queryChanged: (state, action: PayloadAction<string>) => {
      state.query = action.payload
    },
    clearResults: state => {
      state.results = []
      state.error = null
    },
    focusSet: (
      state,
      action: PayloadAction<{ conversationId: number; messageId: string } | null>
    ) => {
      state.focusedConversationId = action.payload?.conversationId ?? null
      state.focusedMessageId = action.payload?.messageId ?? null
    },
  },
  extraReducers: builder => {
    builder
      .addCase(performSearch.pending, state => {
        state.loading = true
        state.error = null
      })
      .addCase(performSearch.fulfilled, (state, action) => {
        state.loading = false
        state.results = action.payload
        state.error = null

        // Add to history
        if (state.query.trim()) {
          const historyItem: SearchHistoryItem = {
            id: Date.now().toString(),
            query: state.query,
            timestamp: Date.now(),
          }
          // Keep latest 20 items, unique by query
          state.history = [historyItem, ...state.history.filter(h => h.query !== historyItem.query)].slice(
            0,
            20
          )
        }
      })
      .addCase(performSearch.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || 'Search failed'
      })
  },
})

export const searchActions = { ...searchSlice.actions, performSearch }

export default searchSlice.reducer


