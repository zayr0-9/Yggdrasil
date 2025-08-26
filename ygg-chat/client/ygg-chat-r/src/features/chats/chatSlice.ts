import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import providersList from '../../../../../shared/providers.json'
import {
  Attachment,
  ChatState,
  ImageDraft,
  Message,
  MessageInput,
  Model,
  ModelSelectionPayload,
  ModelsResponse,
  StreamChunk,
} from './chatTypes'

const getStoredSelectedModel = (): Model | null => {
  try {
    const raw = localStorage.getItem('selectedModel')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && typeof parsed.name === 'string') {
      return parsed as Model
    }
    // Legacy formats (plain string, etc.) are ignored
    return null
  } catch {
    return null
  }
}

const makeInitialState = (): ChatState => ({
  models: {
    available: [],
    selected: getStoredSelectedModel(),
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
    },
    sending: false,
    validationError: null,
    draftMessage: null,
    multiReplyCount: 1,
    imageDrafts: [],
    editingBranch: false,
  },
  // activeChat:{},
  streaming: {
    active: false,
    buffer: '',
    thinkingBuffer: '',
    messageId: null,
    error: null,
    finished: false,
    streamingMessageId: null,
  },
  ui: {
    modelSelectorOpen: false,
  },
  conversation: {
    currentConversationId: null,
    focusedChatMessageId: null,
    currentPath: [],
    messages: [],
    bookmarked: [],
    excludedMessages: [],
    context: '',
  },
  heimdall: {
    treeData: null,
    loading: false,
    error: null,
    compactMode: false,
    lastFetchedAt: null,
    lastConversationId: null,
  },
  initialization: {
    loading: false,
    error: null,
    userId: null,
  },
  selectedNodes: [],
  attachments: {
    byMessage: {},
    backup: {},
  },
})

const initialState: ChatState = makeInitialState()

export const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    //provider management
    providerSelected: (state, action: PayloadAction<string>) => {
      state.providerState.currentProvider = action.payload
      localStorage.setItem('currentProvider', action.payload)
    },
    // Model management - preserve server-provided fields
    modelsLoaded: (state, action: PayloadAction<ModelsResponse>) => {
      state.models.available = action.payload.models
      state.models.default = action.payload.default
      state.models.loading = false
      state.models.error = null
      state.models.lastRefresh = Date.now()

      // If no model selected yet, use the default
      if (!state.models.selected && action.payload.default) {
        state.models.selected = action.payload.default
        localStorage.setItem('selectedModel', JSON.stringify(action.payload.default))
      }
    },

    modelSelected: (state, action: PayloadAction<ModelSelectionPayload>) => {
      state.models.selected = action.payload.model

      if (action.payload.persist) {
        localStorage.setItem('selectedModel', JSON.stringify(action.payload.model))
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
      state.composition.imageDrafts = []
    },

    imageDraftsAppended: (state, action: PayloadAction<ImageDraft[]>) => {
      const existing = new Set(state.composition.imageDrafts.map(d => d.dataUrl))
      for (const draft of action.payload) {
        if (!existing.has(draft.dataUrl)) {
          state.composition.imageDrafts.push(draft)
          existing.add(draft.dataUrl)
        }
      }
    },
    imageDraftsCleared: state => {
      state.composition.imageDrafts = []
    },

    // Branch editing flag
    editingBranchSet: (state, action: PayloadAction<boolean>) => {
      state.composition.editingBranch = action.payload
    },

    sendingStarted: state => {
      state.composition.sending = true
      state.streaming.active = true
      state.streaming.buffer = ''
      state.streaming.thinkingBuffer = ''
      state.composition.input.content = ''
      state.streaming.error = null
      state.streaming.finished = false
      state.streaming.streamingMessageId = null
    },

    sendingCompleted: state => {
      state.composition.sending = false
      state.streaming.active = false
      state.composition.input.content = ''
      state.composition.imageDrafts = []
      state.streaming.finished = true
      state.streaming.streamingMessageId = null
    },

    streamingAborted: state => {
      state.composition.sending = false
      state.streaming.active = false
      state.streaming.error = 'Generation aborted'
      state.streaming.streamingMessageId = null
    },

    // Streaming - optimized buffer management
    streamChunkReceived: (state, action: PayloadAction<StreamChunk>) => {
      const chunk = action.payload
      if (chunk.type === 'reset') {
        state.streaming.buffer = ''
        state.streaming.thinkingBuffer = ''
        state.streaming.error = null
        return
      }

      if (chunk.type === 'generation_started') {
        state.streaming.streamingMessageId = chunk.messageId || null
      } else if (chunk.type === 'chunk') {
        if (chunk.part === 'reasoning') {
          const delta = chunk.delta ?? chunk.content ?? ''
          state.streaming.thinkingBuffer += delta
        } else {
          const delta = chunk.delta ?? chunk.content ?? ''
          state.streaming.buffer += delta
        }
      } else if (chunk.type === 'complete') {
        state.streaming.messageId = chunk.message?.id || null
        state.streaming.active = false
        state.streaming.streamingMessageId = null
      } else if (chunk.type === 'error') {
        state.streaming.error = chunk.error || 'Unknown stream error'
        state.streaming.active = false
        state.streaming.streamingMessageId = null
      }
    },

    streamCompleted: (state, action: PayloadAction<{ messageId: number }>) => {
      state.streaming.active = false
      state.streaming.finished = true
      state.streaming.messageId = action.payload.messageId
      // Fallback: ensure currentPath points to the completed assistant message
      const targetId = action.payload.messageId
      const exists = state.conversation.messages.some(m => m.id === targetId)
      if (exists) {
        const buildPathToMessage = (messageId: number): number[] => {
          const path: number[] = []
          let currentId: number | null = messageId
          while (currentId !== null) {
            path.unshift(currentId)
            const message = state.conversation.messages.find(m => m.id === currentId)
            currentId = message?.parent_id ?? null
          }
          return path
        }
        state.conversation.currentPath = buildPathToMessage(targetId)
      }
    },

    // UI - minimal
    modelSelectorToggled: state => {
      state.ui.modelSelectorOpen = !state.ui.modelSelectorOpen
    },

    conversationSet: (state, action: PayloadAction<number>) => {
      state.conversation.currentConversationId = action.payload
    },

    conversationCleared: state => {
      state.conversation.currentConversationId = null
      state.conversation.messages = []
      state.conversation.currentPath = []
    },

    nodesSelected: (state, action: PayloadAction<number[]>) => {
      state.selectedNodes = action.payload
    },

    focusedChatMessageSet: (state, action: PayloadAction<number>) => {
      state.conversation.focusedChatMessageId = action.payload
    },

    messageAdded: (state, action: PayloadAction<Message>) => {
      const m = action.payload
      const existing = state.conversation.messages.findIndex(x => x.id === m.id)
      if (existing >= 0) {
        state.conversation.messages[existing] = m
      } else {
        state.conversation.messages.push(m)
      }
    },

    messagesCleared: state => {
      state.conversation.messages = []
    },

    messageUpdated: (state, action: PayloadAction<{ id: number; content: string }>) => {
      const { id, content } = action.payload
      const msg = state.conversation.messages.find(m => m.id === id)
      if (msg) msg.content = content
    },

    messageDeleted: (state, action: PayloadAction<number>) => {
      const id = action.payload
      state.conversation.messages = state.conversation.messages.filter(m => m.id !== id)
    },

    messagesLoaded: (state, action: PayloadAction<Message[]>) => {
      state.conversation.messages = action.payload
    },

    // Branching support
    messageBranchCreated: (state, action: PayloadAction<{ newMessage: Message }>) => {
      const { newMessage } = action.payload

      const normalizeIds = (ids: any): number[] => {
        if (Array.isArray(ids)) return ids as number[]
        if (typeof ids === 'string') return ids.split(',').map(Number)
        return []
      }

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

    /* Attachment reducers */
    attachmentsSetForMessage: (state, action: PayloadAction<{ messageId: number; attachments: Attachment[] }>) => {
      const { messageId, attachments } = action.payload
      state.attachments.byMessage[messageId] = attachments
    },
    attachmentUpsertedForMessage: (state, action: PayloadAction<{ messageId: number; attachment: Attachment }>) => {
      const { messageId, attachment } = action.payload
      const arr = state.attachments.byMessage[messageId] || []
      const idx = arr.findIndex(a => a.id === attachment.id)
      if (idx >= 0) {
        arr[idx] = attachment
      } else {
        arr.push(attachment)
      }
      state.attachments.byMessage[messageId] = arr
    },
    attachmentsClearedForMessage: (state, action: PayloadAction<number>) => {
      const messageId = action.payload
      state.attachments.byMessage[messageId] = []
    },
    // When editing a branch, allow removing an artifact image while backing it up for potential restore
    messageArtifactDeleted: (state, action: PayloadAction<{ messageId: number; index: number }>) => {
      const { messageId, index } = action.payload
      const msg = state.conversation.messages.find(m => m.id === messageId)
      if (!msg || !Array.isArray(msg.artifacts)) return
      if (index < 0 || index >= msg.artifacts.length) return
      const removed = msg.artifacts.splice(index, 1)[0]
      if (!state.attachments.backup[messageId]) state.attachments.backup[messageId] = []
      // Store removed artifact (base64) in backup bucket for this message
      state.attachments.backup[messageId].push(removed)
    },
    // Restore backed up artifacts to the message (used on cancel)
    messageArtifactsRestoreFromBackup: (state, action: PayloadAction<{ messageId: number }>) => {
      const { messageId } = action.payload
      const backup = state.attachments.backup[messageId]
      if (!backup || backup.length === 0) return
      const msg = state.conversation.messages.find(m => m.id === messageId)
      if (!msg) return
      const current = Array.isArray(msg.artifacts) ? msg.artifacts : []
      msg.artifacts = [...current, ...backup]
      state.attachments.backup[messageId] = []
    },
    // Clear backup explicitly (used after creating branch)
    messageArtifactsBackupCleared: (state, action: PayloadAction<{ messageId: number }>) => {
      const { messageId } = action.payload
      state.attachments.backup[messageId] = []
    },
    // Update a message's artifacts (e.g., after fetching attachments)
    messageArtifactsSet: (state, action: PayloadAction<{ messageId: number; artifacts: string[] }>) => {
      const { messageId, artifacts } = action.payload
      const msg = state.conversation.messages.find(m => m.id === messageId)
      if (msg) {
        msg.artifacts = artifacts
      }
    },
    // Append artifacts to a message (e.g., when user adds image drafts)
    messageArtifactsAppended: (state, action: PayloadAction<{ messageId: number; artifacts: string[] }>) => {
      const { messageId, artifacts } = action.payload
      const msg = state.conversation.messages.find(m => m.id === messageId)
      if (msg) {
        const existing = Array.isArray(msg.artifacts) ? msg.artifacts : []
        msg.artifacts = [...existing, ...artifacts]
      }
    },

    stateReset: () => makeInitialState(),
  },
})

export const chatSliceActions = chatSlice.actions
export default chatSlice.reducer
