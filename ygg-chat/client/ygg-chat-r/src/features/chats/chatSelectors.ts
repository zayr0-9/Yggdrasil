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
