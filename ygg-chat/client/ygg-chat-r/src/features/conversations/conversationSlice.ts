import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { updateConversationTitle } from '../chats'
import { createConversation, deleteConversation, fetchConversations, fetchConversationsByProjectId, updateConversation } from './conversationActions'
import { Conversation, ConversationsState } from './conversationTypes'

const initialState: ConversationsState = {
  items: [],
  loading: false,
  error: null,
  activeConversationId: null,
  systemPrompt: null,
  convContext: null,
}

const conversationSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    conversationsCleared: state => {
      state.items = []
      state.error = null
    },
    activeConversationIdSet: (state, action: PayloadAction<number | null>) => {
      state.activeConversationId = action.payload
    },
    systemPromptSet: (state, action: PayloadAction<string | null>) => {
      state.systemPrompt = action.payload
    },
    updateSystemPrompt: (state, action: PayloadAction<string | null>) => {
      state.systemPrompt = action.payload
    },
    convContextSet: (state, action: PayloadAction<string | null>) => {
      state.convContext = action.payload
    },
  },
  extraReducers: builder => {
    builder
      // fetch list
      .addCase(fetchConversations.pending, state => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchConversations.fulfilled, (state, action: PayloadAction<Conversation[]>) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // fetch by project ID
      .addCase(fetchConversationsByProjectId.pending, state => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchConversationsByProjectId.fulfilled, (state, action: PayloadAction<Conversation[]>) => {
        state.loading = false
        state.items = action.payload
      })
      .addCase(fetchConversationsByProjectId.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // create conversation
      .addCase(createConversation.pending, state => {
        state.loading = true
        state.error = null
      })
      .addCase(createConversation.fulfilled, (state, action: PayloadAction<Conversation>) => {
        state.loading = false
        state.items.unshift(action.payload)
      })
      .addCase(createConversation.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // update conversation title
      .addCase(updateConversation.pending, state => {
        state.loading = true
        state.error = null
      })
      .addCase(updateConversation.fulfilled, (state, action: PayloadAction<Conversation>) => {
        state.loading = false
        const idx = state.items.findIndex(c => c.id === action.payload.id)
        if (idx !== -1) {
          state.items[idx] = action.payload
        }
      })
      // also accept updates coming from chat feature thunk
      .addCase(updateConversationTitle.fulfilled, (state, action: PayloadAction<Conversation>) => {
        const idx = state.items.findIndex(c => c.id === action.payload.id)
        if (idx !== -1) {
          state.items[idx] = action.payload
        }
      })
      .addCase(updateConversation.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // delete conversation
      .addCase(deleteConversation.pending, state => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteConversation.fulfilled, (state, action: PayloadAction<number>) => {
        state.loading = false
        state.items = state.items.filter(conv => conv.id !== action.payload)
      })
      .addCase(deleteConversation.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  },
})

export const { conversationsCleared, activeConversationIdSet, systemPromptSet, updateSystemPrompt, convContextSet } =
  conversationSlice.actions
export default conversationSlice.reducer
