import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import providersList from '../../../../../shared/providers.json'
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
  providerState: {
    providers: Object.values(providersList.providers),
    currentProvider: localStorage.getItem('currentProvider') || null,
    loading: false,
    error: null,
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
    multiReplyCount: 1,
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
  selectedNodes: [],
}

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    //provider management
    providerSelected: (state, action: PayloadAction<string>) => {
      state.providerState.currentProvider = action.payload
      localStorage.setItem('currentProvider', action.payload)
    },
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
      } else if (type === 'reset') {
        state.streaming.buffer = ''
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
          created_at: new Date().toISOString(),
          pastedContext: [],
          artifacts: [],
          parentId: state.conversation.messages.at(-1)?.id,
          children_ids: [],
          model_name: state.models.selected,
        }
        state.conversation.messages.push(assistantMessage)

        // Update the current path so the UI (chat list) follows the latest assistant reply
        if (!state.conversation.currentPath || state.conversation.currentPath.length === 0) {
          state.conversation.currentPath = [assistantMessage.id]
        } else if (!state.conversation.currentPath.includes(assistantMessage.id)) {
          state.conversation.currentPath = [...state.conversation.currentPath, assistantMessage.id]
        }
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

    nodesSelected: (state, action: PayloadAction<number[]>) => {
      state.selectedNodes = action.payload
    },

    messageAdded: (state, action: PayloadAction<Message>) => {
      const msg = action.payload
      state.conversation.messages.push(msg)

      // Keep the currentPath in sync when new messages arrive
      if (!state.conversation.currentPath || state.conversation.currentPath.length === 0) {
        // No existing path – start with the first message (user or assistant)
        state.conversation.currentPath = [msg.id]
      } else {
        const last = state.conversation.currentPath[state.conversation.currentPath.length - 1]
        if (last !== msg.id) {
          state.conversation.currentPath = [...state.conversation.currentPath, msg.id]
        }
      }
    },

    messagesCleared: state => {
      state.conversation.messages = []
    },
    messageUpdated: (state, action: PayloadAction<{ id: number; content: string }>) => {
      const message = state.conversation.messages.find(m => m.id === action.payload.id)
      if (message) {
        message.content = action.payload.content
      }
      // Reset multi-reply to default after editing
      state.composition.multiReplyCount = 1
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

      // Ensure children_ids is an array on both new and parent messages
      const normalizeIds = (ids: any): number[] => {
        if (Array.isArray(ids)) return ids as number[]
        try {
          return JSON.parse(ids || '[]') as number[]
        } catch {
          return []
        }
      }

      newMessage.children_ids = normalizeIds(newMessage.children_ids)

      // Add the new branched message
      state.conversation.messages.push(newMessage)

      // Update the parent's children_ids if it exists
      const parentMessage = state.conversation.messages.find(m => m.id === newMessage.parent_id)
      if (parentMessage) {
        parentMessage.children_ids = normalizeIds(parentMessage.children_ids)
        if (!parentMessage.children_ids.includes(newMessage.id)) {
          parentMessage.children_ids.push(newMessage.id)
        }
      }

      // Auto-navigate current path to new branch by building complete path from root
      // This ensures we switch cleanly to the new branch without leftover messages
      const buildPathToMessage = (messageId: number): number[] => {
        const path: number[] = []
        let currentId: number | null = messageId

        // Walk up the parent chain to build the complete path
        while (currentId !== null) {
          path.unshift(currentId)
          const message = state.conversation.messages.find(m => m.id === currentId)
          currentId = message?.parent_id ?? null
        }

        return path
      }

      state.conversation.currentPath = buildPathToMessage(newMessage.id)
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
    multiReplyCountSet: (state, action: PayloadAction<number>) => {
      state.composition.multiReplyCount = action.payload
    },
  },
})

export const chatSliceActions = chatSlice.actions
export default chatSlice.reducer
