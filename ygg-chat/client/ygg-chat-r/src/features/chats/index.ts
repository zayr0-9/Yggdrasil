// Types
export type {
  ChatState,
  CompositionState,
  Message,
  MessageInput,
  ModelSelectionPayload,
  ModelsResponse,
  ModelState,
  SendMessagePayload,
  StreamChunk,
  StreamState,
} from './chatTypes'

// Slice
export { chatActions, default as chatReducer } from './chatSlice'

// Async actions
export { deleteMessage, editMessageWithBranching, fetchModels, selectModel, sendMessage, sendMessageToBranch, updateMessage } from './chatActions'

// Selectors - grouped by feature
export {
  selectBookmarkedMessages,
  // Combined selectors
  selectCanSend,
  selectConversationMessages,
  selectConversationState,
  selectCurrentConversationId,
  selectCurrentPath,
  selectDefaultModel,
  selectDisplayMessages,
  selectEffectiveModel,
  selectExcludedMessages,
  selectFilteredMessages,
  selectInputContent,
  selectInputValid,
  selectIsModelAvailable,
  selectIsStreaming,
  // Composition selectors
  selectMessageInput,
  // Model selectors
  selectModels,
  // UI selectors
  selectModelSelectorOpen,
  selectModelsError,
  selectModelsLoading,
  selectModelState,
  selectSelectedModel,
  selectSendingState,
  selectStreamBuffer,
  selectStreamError,
  // Streaming selectors
  selectStreamState,
  selectValidationError,
} from './chatSelectors'

// Convenience re-exports
export { chatActions as actions } from './chatSlice'
