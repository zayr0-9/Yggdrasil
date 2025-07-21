import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import { ChatState, Message, MessageInput, ModelSelectionPayload, ModelsResponse, StreamChunk } from './chatTypes'

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
    draftMessage: null,
  },
  // activeChat:{},
  streaming: {
    active: false,
    buffer: '',
    messageId: null,
    error: null,
  },
  ui: {
    modelSelectorOpen: false,
  },
  conversation: {
    currentConversationId: null,
    currentPath: [],
    messages: [],
    bookmarked: [],
    excludedMessages: [],
  },
  heimdall: {
    treeData: null,
    loading: false,
    error: null,
    compactMode: false,
  },
  initialization: {
    loading: false,
    error: null,
    userId: null,
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
      } else if (content.length > 20000) {
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
      state.streaming.messageId = action.payload.messageId

      // Store assistant message immediately
      if (state.streaming.buffer && state.conversation.currentConversationId) {
        const assistantMessage = {
          id: action.payload.messageId,
          conversation_id: state.conversation.currentConversationId,
          role: 'assistant' as const,
          content: state.streaming.buffer,
          timestamp: new Date().toISOString(),
          pastedContext: [],
          artifacts: [],
          parentId: state.conversation.messages.at(-1)?.id,
          children_ids: [],
        }
        state.conversation.messages.push(assistantMessage)
      }

      state.streaming.active = false
      state.streaming.buffer = ''
    },

    // UI - minimal
    modelSelectorToggled: state => {
      state.ui.modelSelectorOpen = !state.ui.modelSelectorOpen
    },
    conversationSet: (state, action: PayloadAction<number>) => {
      state.conversation.currentConversationId = action.payload
      state.conversation.messages = []
      state.conversation.currentPath = []
    },

    conversationCleared: state => {
      state.conversation.currentConversationId = null
      state.conversation.messages = []
      state.conversation.currentPath = []
    },

    messageAdded: (state, action: PayloadAction<Message>) => {
      state.conversation.messages.push(action.payload)
    },

    messagesCleared: state => {
      state.conversation.messages = []
    },
    messageUpdated: (state, action: PayloadAction<{ id: number; content: string }>) => {
      const message = state.conversation.messages.find(m => m.id === action.payload.id)
      if (message) {
        message.content = action.payload.content
      }
    },

    messageDeleted: (state, action: PayloadAction<number>) => {
      state.conversation.messages = state.conversation.messages.filter(m => m.id !== action.payload)
    },

    messagesLoaded: (state, action: PayloadAction<Message[]>) => {
      state.conversation.messages = action.payload
    },

    // Branching support
    messageBranchCreated: (state, action: PayloadAction<{ newMessage: Message }>) => {
      const { newMessage } = action.payload
      
      // Add the new branched message
      state.conversation.messages.push(newMessage)
      
      // Update the parent's children_ids if it exists
      const parentMessage = state.conversation.messages.find(m => m.id === newMessage.parent_id)
      if (parentMessage && !parentMessage.children_ids.includes(newMessage.id)) {
        parentMessage.children_ids.push(newMessage.id)
      }

      // Auto-navigate current path to new branch
      if (!state.conversation.currentPath || state.conversation.currentPath.length === 0) {
        state.conversation.currentPath = [newMessage.id]
      } else {
        // If last element is parent or within path, append; otherwise reset to branch root then append
        const parentIndex = state.conversation.currentPath.lastIndexOf(newMessage.parent_id ?? -1)
        if (parentIndex !== -1) {
          state.conversation.currentPath = [
            ...state.conversation.currentPath.slice(0, parentIndex + 1),
            newMessage.id,
          ]
        } else {
          state.conversation.currentPath = [...state.conversation.currentPath, newMessage.id]
        }
      }
    },

    // Set current path for navigation through branches
    conversationPathSet: (state, action: PayloadAction<number[]>) => {
      state.conversation.currentPath = action.payload
    },

    // Set selected node path (string IDs from Heimdall)
    selectedNodePathSet: (state, action: PayloadAction<string[]>) => {
      // Convert string IDs to numbers for consistency with message IDs
      const numericPath = action.payload
        .filter(id => id !== 'empty' && id !== '') // Filter out empty/default nodes
        .map(id => parseInt(id))
        .filter(id => !isNaN(id)) // Filter out invalid numbers
      state.conversation.currentPath = numericPath
    },

    /* Heimdall tree reducers */
    heimdallLoadingStarted: state => {
      state.heimdall.loading = true
      state.heimdall.error = null
    },
    heimdallDataLoaded: (state, action: PayloadAction<{ treeData: any }>) => {
      state.heimdall.treeData = action.payload.treeData
      state.heimdall.loading = false
      state.heimdall.error = null
    },
    heimdallError: (state, action: PayloadAction<string>) => {
      state.heimdall.error = action.payload
      state.heimdall.loading = false
    },
    heimdallCompactModeToggled: state => {
      state.heimdall.compactMode = !state.heimdall.compactMode
    },

    /* Initialization reducers */
    initializationStarted: state => {
      state.initialization.loading = true
      state.initialization.error = null
    },
    initializationCompleted: (state, action: PayloadAction<{ userId: number; conversationId: number }>) => {
      state.initialization.loading = false
      state.initialization.userId = action.payload.userId
      state.conversation.currentConversationId = action.payload.conversationId
    },
    initializationError: (state, action: PayloadAction<string>) => {
      state.initialization.loading = false
      state.initialization.error = action.payload
    },
  },
})

export const chatActions = chatSlice.actions
export default chatSlice.reducer
