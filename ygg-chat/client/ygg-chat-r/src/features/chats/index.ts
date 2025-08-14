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
export { default as chatReducer, chatSliceActions } from './chatSlice'

// Async actions
export {
  deleteMessage,
  editMessageWithBranching,
  fetchModels,
  fetchModelsForCurrentProvider,
  refreshCurrentPathAfterDelete,
  selectModel,
  sendMessage,
  sendMessageToBranch,
  updateMessage,
} from './chatActions'

// Selectors - grouped by feature
export {
  HeimdallDataReset,
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
  selectFocusedChatMessageId,
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
  selectProviderState,
  selectSelectedModel,
  selectSendingState,
  selectStreamBuffer,
  selectStreamError,
  // Streaming selectors
  selectStreamState,
  selectValidationError,
} from './chatSelectors'

// Convenience re-exports
// New async thunks
export { fetchConversationMessages, fetchMessageTree, initializeUserAndConversation, updateConversationTitle } from './chatActions'

// New selectors for Heimdall and initialization
export {
  selectHeimdallCompactMode,
  selectHeimdallData,
  selectHeimdallError,
  selectHeimdallLoading,
  selectHeimdallState,
  selectInitializationError,
  selectInitializationLoading,
  selectInitializationState,
  selectMultiReplyCount,
} from './chatSelectors'

export { chatSliceActions as actions } from './chatSlice'
