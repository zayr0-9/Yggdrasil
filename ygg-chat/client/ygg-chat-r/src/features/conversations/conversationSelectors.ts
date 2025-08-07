import { createSelector } from '@reduxjs/toolkit'
import { RootState } from '../../store/store'

const selectConvState = (state: RootState) => state.conversations

export const selectAllConversations = createSelector([selectConvState], state => state.items)
export const selectConvLoading = createSelector([selectConvState], state => state.loading)
export const selectConvError = createSelector([selectConvState], state => state.error)

// Selector to get a conversation by id
export const makeSelectConversationById = (id: number) =>
  createSelector([selectAllConversations], conversations => conversations.find(c => c.id === id))
