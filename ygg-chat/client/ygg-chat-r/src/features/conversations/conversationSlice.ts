import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ConversationsState, Conversation } from './conversationTypes'
import { fetchConversations, createConversation } from './conversationActions'

const initialState: ConversationsState = {
  items: [],
  loading: false,
  error: null,
}

const conversationSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    conversationsCleared: state => {
      state.items = []
      state.error = null
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
  },
})

export const { conversationsCleared } = conversationSlice.actions
export default conversationSlice.reducer
