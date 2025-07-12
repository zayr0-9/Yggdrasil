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
export { fetchModels, selectModel, sendMessage } from './chatActions'

// Selectors - grouped by feature
export {
  // Combined selectors
  selectCanSend,
  selectDefaultModel,
  selectEffectiveModel,
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
