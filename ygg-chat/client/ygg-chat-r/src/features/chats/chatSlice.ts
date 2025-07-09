import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ChatState, MessageInput, ModelSelectionPayload, ModelsResponse, StreamChunk } from './chatTypes'

const initialState: ChatState = {
  models: {
    available: [],
    selected: localStorage.getItem('selectedModel') || null,
    default: null,
    loading: false,
    error: null,
    lastRefresh: null,
  },
  composition: {
    input: {
      content: '',
      modelOverride: undefined,
      systemPrompt: undefined,
    },
    sending: false,
    validationError: null,
  },
  streaming: {
    active: false,
    buffer: '',
    messageId: null,
    error: null,
  },
  ui: {
    modelSelectorOpen: false,
  },
}

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Model management - simplified for string models
    modelsLoaded: (state, action: PayloadAction<ModelsResponse>) => {
      state.models.available = action.payload.models
      state.models.default = action.payload.default
      state.models.loading = false
      state.models.error = null
      state.models.lastRefresh = Date.now()

      // If no model selected yet, use the default
      if (!state.models.selected && action.payload.default) {
        state.models.selected = action.payload.default
        localStorage.setItem('selectedModel', action.payload.default)
      }
    },

    modelSelected: (state, action: PayloadAction<ModelSelectionPayload>) => {
      state.models.selected = action.payload.modelName
      if (action.payload.persist) {
        localStorage.setItem('selectedModel', action.payload.modelName)
      }
    },

    modelsError: (state, action: PayloadAction<string>) => {
      state.models.error = action.payload
      state.models.loading = false
    },

    modelsLoadingStarted: state => {
      state.models.loading = true
      state.models.error = null
    },

    // Composition - validation integrated
    inputChanged: (state, action: PayloadAction<Partial<MessageInput>>) => {
      Object.assign(state.composition.input, action.payload)

      // Immediate validation
      const content = state.composition.input.content.trim()
      if (content.length === 0) {
        state.composition.validationError = null
      } else if (content.length > 4000) {
        state.composition.validationError = 'Message too long'
      } else {
        state.composition.validationError = null
      }
    },

    inputCleared: state => {
      state.composition.input = initialState.composition.input
      state.composition.validationError = null
    },

    sendingStarted: state => {
      state.composition.sending = true
      state.streaming.active = true
      state.streaming.buffer = ''
      state.streaming.error = null
    },

    sendingCompleted: state => {
      state.composition.sending = false
      state.streaming.active = false
      state.composition.input.content = ''
    },

    // Streaming - optimized buffer management
    streamChunkReceived: (state, action: PayloadAction<StreamChunk>) => {
      const { type, content } = action.payload

      if (type === 'chunk' && content) {
        state.streaming.buffer += content
      } else if (type === 'error') {
        state.streaming.error = action.payload.error || 'Stream error'
        state.streaming.active = false
        state.composition.sending = false
      }
    },

    streamCompleted: (state, action: PayloadAction<{ messageId: number }>) => {
      //   state.streaming.messageId = action.payload.messageId
      state.streaming.active = false
      state.streaming.buffer = ''
    },

    // UI - minimal
    modelSelectorToggled: state => {
      state.ui.modelSelectorOpen = !state.ui.modelSelectorOpen
    },
  },
})

export const chatActions = chatSlice.actions
export default chatSlice.reducer
