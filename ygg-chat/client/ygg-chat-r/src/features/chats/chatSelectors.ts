import { createSelector } from '@reduxjs/toolkit'
import { RootState } from '../../store/store'

// Base selector
const selectChatState = (state: RootState) => state.chat

// Model selectors - simplified for string models
export const selectModels = createSelector([selectChatState], chat => chat.models.available)

export const selectSelectedModel = createSelector([selectChatState], chat => chat.models.selected)

export const selectDefaultModel = createSelector([selectChatState], chat => chat.models.default)

export const selectModelsLoading = createSelector([selectChatState], chat => chat.models.loading)

export const selectModelsError = createSelector([selectChatState], chat => chat.models.error)

// Get effective model (selected or default)
export const selectEffectiveModel = createSelector(
  [selectSelectedModel, selectDefaultModel],
  (selected, defaultModel) => selected || defaultModel
)

// Check if a specific model is available
export const selectIsModelAvailable = createSelector(
  [selectModels, (_state: RootState, modelName: string) => modelName],
  (models, modelName) => models.includes(modelName)
)

// Composition selectors
export const selectMessageInput = createSelector([selectChatState], chat => chat.composition.input)

export const selectInputContent = createSelector([selectMessageInput], input => input.content)

export const selectInputValid = createSelector(
  [selectChatState],
  chat => !chat.composition.validationError && chat.composition.input.content.trim().length > 0
)

export const selectValidationError = createSelector([selectChatState], chat => chat.composition.validationError)

// Streaming selectors
export const selectStreamState = createSelector([selectChatState], chat => chat.streaming)

export const selectStreamBuffer = createSelector([selectStreamState], stream => stream.buffer)

export const selectStreamError = createSelector([selectStreamState], stream => stream.error)

export const selectIsStreaming = createSelector([selectStreamState], stream => stream.active)

// Combined state selectors - optimized
export const selectCanSend = createSelector(
  [selectInputValid, selectChatState, selectEffectiveModel],
  (valid, chat, model) => valid && !chat.composition.sending && !chat.streaming.active && !!model
)

export const selectSendingState = createSelector([selectChatState], chat => ({
  sending: chat.composition.sending,
  streaming: chat.streaming.active,
  error: chat.streaming.error,
}))

// Heimdall selectors
export const selectHeimdallState = createSelector([selectChatState], chat => chat.heimdall)
export const selectHeimdallData = createSelector([selectHeimdallState], h => h.treeData)
export const selectHeimdallLoading = createSelector([selectHeimdallState], h => h.loading)
export const selectHeimdallError = createSelector([selectHeimdallState], h => h.error)
export const selectHeimdallCompactMode = createSelector([selectHeimdallState], h => h.compactMode)

// Initialization selectors
export const selectInitializationState = createSelector([selectChatState], chat => chat.initialization)
export const selectInitializationLoading = createSelector([selectInitializationState], i => i.loading)
export const selectInitializationError = createSelector([selectInitializationState], i => i.error)

// UI selectors
export const selectModelSelectorOpen = createSelector([selectChatState], chat => chat.ui.modelSelectorOpen)

// Combined model state for UI
export const selectModelState = createSelector(
  [selectModels, selectSelectedModel, selectDefaultModel, selectModelsLoading, selectModelsError],
  (available, selected, defaultModel, loading, error) => ({
    available,
    selected,
    default: defaultModel,
    effective: selected || defaultModel,
    loading,
    error,
    hasModels: available.length > 0,
  })
)

// Conversation selectors
export const selectConversationState = createSelector([selectChatState], chat => chat.conversation)

export const selectCurrentConversationId = createSelector(
  [selectConversationState],
  conversation => conversation.currentConversationId
)

export const selectConversationMessages = createSelector(
  [selectConversationState],
  conversation => conversation.messages
)

export const selectCurrentPath = createSelector([selectConversationState], conversation => conversation.currentPath)

export const selectBookmarkedMessages = createSelector(
  [selectConversationState],
  conversation => conversation.bookmarked
)

export const selectExcludedMessages = createSelector(
  [selectConversationState],
  conversation => conversation.excludedMessages
)

// Filter messages based on selected path (for branch navigation)
export const selectFilteredMessages = createSelector(
  [selectConversationMessages, selectCurrentPath],
  (messages, currentPath) => {
    // If no path is selected, show all messages (default behavior)
    if (!currentPath || currentPath.length === 0) {
      return messages
    }
    
    // Filter messages to only include those in the selected path
    const pathSet = new Set(currentPath)
    return messages.filter(message => pathSet.has(message.id))
  }
)

// Get messages for display (either filtered by path or all messages)
export const selectDisplayMessages = createSelector(
  [selectConversationMessages, selectCurrentPath],
  (messages, currentPath) => {
    // If no path is selected, show all messages
    if (!currentPath || currentPath.length === 0) {
      return messages
    }
    
    // Build the conversation thread following the selected path
    const pathMessages: typeof messages = []
    const messageMap = new Map(messages.map(msg => [msg.id, msg]))
    
    // Follow the path from root to selected node
    for (const messageId of currentPath) {
      const message = messageMap.get(messageId)
      if (message) {
        pathMessages.push(message)
      }
    }
    
    return pathMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }
)
