import 'boxicons' // Types
import 'boxicons/css/boxicons.min.css'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button, ChatMessage, Heimdall, InputTextArea, Select, SettingsPane, TextField } from '../components'
import {
  abortStreaming,
  chatSliceActions,
  deleteMessage,
  editMessageWithBranching,
  fetchConversationMessages,
  fetchMessageTree,
  fetchModelsForCurrentProvider,
  initializeUserAndConversation,
  refreshCurrentPathAfterDelete,
  selectConversationMessages,
  selectCurrentConversationId,
  selectCurrentPath,
  selectDisplayMessages,
  selectFocusedChatMessageId,
  selectHeimdallCompactMode,
  selectHeimdallData,
  selectHeimdallError,
  selectHeimdallLoading,
  selectMessageInput,
  // Chat selectors
  selectModels,
  selectMultiReplyCount,
  selectProviderState,
  selectSelectedModel,
  selectSendingState,
  selectStreamState,
  sendMessage,
  updateConversationTitle,
  updateMessage,
} from '../features/chats'
import {
  fetchContext,
  fetchConversations,
  fetchSystemPrompt,
  makeSelectConversationById,
  systemPromptSet,
} from '../features/conversations'
import { removeSelectedFileForChat, updateIdeContext } from '../features/ideContext'
import { selectSelectedFilesForChat, selectWorkspace } from '../features/ideContext/ideContextSelectors'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { useIdeContext } from '../hooks/useIdeContext'
import { getParentPath } from '../utils/path'
function Chat() {
  const dispatch = useAppDispatch()
  const { ideContext } = useIdeContext()
  const navigate = useNavigate()

  // Local state for input to completely avoid Redux dispatches during typing
  const [localInput, setLocalInput] = useState('')

  // Redux selectors
  const models = useAppSelector(selectModels)
  const selectedModel = useAppSelector(selectSelectedModel)
  const providers = useAppSelector(selectProviderState)
  const messageInput = useAppSelector(selectMessageInput)
  // const canSendFromRedux = useAppSelector(selectCanSend)
  const sendingState = useAppSelector(selectSendingState)
  const streamState = useAppSelector(selectStreamState)
  const conversationMessages = useAppSelector(selectConversationMessages)
  const displayMessages = useAppSelector(selectDisplayMessages)
  const currentConversationId = useAppSelector(selectCurrentConversationId)
  const selectedPath = useAppSelector(selectCurrentPath)
  const multiReplyCount = useAppSelector(selectMultiReplyCount)
  const focusedChatMessageId = useAppSelector(selectFocusedChatMessageId)
  // const ideContext = useAppSelector(selectIdeContext)
  const workspace = useAppSelector(selectWorkspace)
  // const isIdeConnected = useAppSelector(selectIsIdeConnected)
  // const activeFile = useAppSelector(selectActiveFile)
  const selectedFilesForChat = useAppSelector(selectSelectedFilesForChat)

  // File chip expanded modal state
  const [expandedFilePath, setExpandedFilePath] = useState<string | null>(null)
  // Temporary closing state to animate back to hover size before hiding
  const [closingFilePath, setClosingFilePath] = useState<string | null>(null)
  // Temporary opening state to blur content while expanding
  const [openingFilePath, setOpeningFilePath] = useState<string | null>(null)
  // Anchor position for fixed expanded panel (viewport coords)
  const [expandedAnchor, setExpandedAnchor] = useState<{ left: number; top: number } | null>(null)

  const handleCloseExpandedPreview = useCallback(() => {
    if (!expandedFilePath) return
    const path = expandedFilePath
    setExpandedFilePath(null)
    setClosingFilePath(path)
    // Match transition duration (100ms)
    window.setTimeout(() => setClosingFilePath(null), 130)
  }, [expandedFilePath])

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const handleRemoveFileSelection = useCallback(
    (file: { path: string; relativePath: string; name?: string }) => {
      // Remove from selected files in Redux
      dispatch(removeSelectedFileForChat(file.path))

      // Also remove the textual @mention from the local input value
      const mentionName = file.name || file.path.split('/').pop() || file.relativePath.split('/').pop() || ''
      if (mentionName) {
        const mentionRegex = new RegExp(`@${escapeRegExp(mentionName)}(\\b|$)\\s*`, 'g')
        setLocalInput(prev => prev.replace(mentionRegex, ''))
      }
    },
    [dispatch]
  )

  // Function to replace file mentions with actual content
  const replaceFileMentionsWithContent = useCallback(
    (message: string): string => {
      if (!message || typeof message !== 'string') return message || ''

      // Build a lookup map of mentionable names -> contents
      const nameToContent = new Map<string, string>()
      const basename = (p: string) => {
        if (!p) return p
        const parts = p.split(/\\\\|\//) // split on both \\ and /
        return parts[parts.length - 1]
      }
      for (const f of selectedFilesForChat) {
        if (f.name && !nameToContent.has(f.name)) nameToContent.set(f.name, f.contents)
        const baseRel = basename(f.relativePath)
        if (baseRel && !nameToContent.has(baseRel)) nameToContent.set(baseRel, f.contents)
        const basePath = basename(f.path)
        if (basePath && !nameToContent.has(basePath)) nameToContent.set(basePath, f.contents)
      }

      // Replace tokens like @filename with the corresponding contents
      // Allow letters, numbers, underscore, dot, dash, and path separators in the token
      const mentionRegex = /@([A-Za-z0-9._\/-]+)/g
      return message.replace(mentionRegex, (full: string, mName: string) => {
        const content = nameToContent.get(mName)
        return content != null ? content : full
      })
    },
    [selectedFilesForChat]
  )

  // Ref for auto-scroll
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  // Track whether the upcoming selection change came from an explicit user click in Heimdall
  const selectionScrollCauseRef = useRef<'user' | null>(null)
  // Track if the user manually scrolled during the current stream; disables bottom pin until finished
  const userScrolledDuringStreamRef = useRef<boolean>(false)
  // Sentinel at the end of the list for robust bottom scrolling
  const bottomRef = useRef<HTMLDivElement>(null)
  // rAF id to coalesce frequent scroll requests during streaming
  const scrollRafRef = useRef<number | null>(null)

  // Measure input area (controls + textarea) height so messages list can avoid being overlapped
  const inputAreaRef = useRef<HTMLDivElement>(null)
  const [inputAreaHeight, setInputAreaHeight] = useState<number>(0)
  // Track if we already applied the URL hash-based path to avoid overriding user branch switches
  const hashAppliedRef = useRef<number | null>(null)

  // Debounced input area height update to prevent excessive scroll recalculations
  const inputHeightTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const el = inputAreaRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const debouncedSetHeight = (height: number) => {
      if (inputHeightTimeoutRef.current) {
        clearTimeout(inputHeightTimeoutRef.current)
      }
      inputHeightTimeoutRef.current = setTimeout(() => {
        setInputAreaHeight(height)
      }, 50) // 50ms debounce
    }

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        debouncedSetHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    // Initialize immediately (no debounce needed on mount)
    setInputAreaHeight(el.getBoundingClientRect().height)

    return () => {
      observer.disconnect()
      if (inputHeightTimeoutRef.current) {
        clearTimeout(inputHeightTimeoutRef.current)
      }
    }
  }, [])

  // Lock page scroll while chat is mounted
  useEffect(() => {
    const prevDocOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = prevDocOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [])

  // Consider the user to be "at the bottom" if within this many pixels
  const NEAR_BOTTOM_PX = 48
  const isNearBottom = (el: HTMLElement, threshold = NEAR_BOTTOM_PX) => {
    // Account for the absolute-positioned input area occupying visual space at the bottom.
    // The messages container uses paddingBottom equal to inputAreaHeight; treat being within
    // that padding as "near bottom" so user pinning behaves intuitively.
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    return remaining <= threshold + inputAreaHeight
  }

  // Heimdall state from Redux
  const heimdallData = useAppSelector(selectHeimdallData)
  const loading = useAppSelector(selectHeimdallLoading)
  const error = useAppSelector(selectHeimdallError)
  const compactMode = useAppSelector(selectHeimdallCompactMode)
  // Conversation title editing
  const currentConversation = useAppSelector(
    currentConversationId ? makeSelectConversationById(currentConversationId) : () => null
  )
  const [titleInput, setTitleInput] = useState(currentConversation?.title ?? '')

  useEffect(() => {
    setTitleInput(currentConversation?.title ?? '')
  }, [currentConversation?.title])

  // Debounce title updates to avoid dispatching on every keystroke
  useEffect(() => {
    if (!currentConversationId) return
    const trimmed = titleInput.trim()
    const currentTrimmed = (currentConversation?.title ?? '').trim()
    // No-op if unchanged
    if (trimmed === currentTrimmed) return
    const handle = setTimeout(() => {
      dispatch(updateConversationTitle({ id: currentConversationId, title: trimmed }))
    }, 1000)
    return () => clearTimeout(handle)
  }, [titleInput, currentConversationId, currentConversation?.title, dispatch])

  // Ensure we have the latest conversation titles on reload/switch
  useEffect(() => {
    if (currentConversationId && !currentConversation) {
      dispatch(fetchConversations())
    }
  }, [currentConversationId, currentConversation, dispatch])

  // Resizable split-pane state
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftWidthPct, setLeftWidthPct] = useState<number>(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('chat:leftWidthPct') : null
      const n = stored ? parseFloat(stored) : NaN
      return Number.isFinite(n) ? Math.min(80, Math.max(20, n)) : 55
    } catch {
      return 55
    }
  })
  const [isResizing, setIsResizing] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [think, setThink] = useState<boolean>(false)
  // One-time spin flags for icon buttons
  const [spinSettings, setSpinSettings] = useState(false)
  const [spinRefresh, setSpinRefresh] = useState(false)
  // Session-level delete confirmation preference and modal state
  const [confirmDel, setconfirmDel] = useState<boolean>(true)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [dontAskAgain, setDontAskAgain] = useState<boolean>(false)

  useEffect(() => {
    if (!isResizing) return

    const clamp = (v: number) => Math.max(20, Math.min(80, v))

    const handleMove = (clientX: number) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const pct = clamp(((clientX - rect.left) / rect.width) * 100)
      setLeftWidthPct(pct)
      try {
        window.localStorage.setItem('chat:leftWidthPct', pct.toFixed(2))
      } catch {}
    }

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX)
    const onMouseUp = () => setIsResizing(false)
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) handleMove(e.touches[0].clientX)
    }
    const onTouchEnd = () => setIsResizing(false)

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)

    const prevUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      document.body.style.userSelect = prevUserSelect
    }
  }, [isResizing])

  // Fetch tree when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      // Clear previous tree to avoid stale display when switching conversations
      dispatch(chatSliceActions.heimdallDataLoaded({ treeData: null }))
      dispatch(fetchMessageTree(currentConversationId))
    } else {
      // If no conversation is selected, ensure the tree is cleared
      dispatch(chatSliceActions.heimdallDataLoaded({ treeData: null }))
    }
  }, [currentConversationId, dispatch])

  // Fetch conversation messages when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      dispatch(fetchConversationMessages(currentConversationId))
    }
  }, [currentConversationId, dispatch])

  // Fetch system prompt when conversation changes; clear when none selected
  useEffect(() => {
    if (currentConversationId) {
      dispatch(fetchSystemPrompt(currentConversationId))
      dispatch(fetchContext(currentConversationId))
    } else {
      dispatch(systemPromptSet(null))
    }
  }, [currentConversationId, dispatch])

  // Refresh tree when new message added
  useEffect(() => {
    if (currentConversationId) {
      dispatch(fetchMessageTree(currentConversationId))
    }
  }, [conversationMessages, dispatch])

  // Auto-scroll to bottom when messages update, with refined behavior:
  // - While streaming: keep pinned unless user scrolled away. If user returns near bottom, re-enable pinning.
  // - After streaming completes: only auto-scroll when there is no explicit selection path
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const scrollToBottom = (behavior: ScrollBehavior) => {
      const sentinel = bottomRef.current
      // Prefer sentinel-based scroll to handle both container and window scroll contexts
      if (sentinel && typeof sentinel.scrollIntoView === 'function') {
        // Use rAF to avoid spamming during streaming updates
        const doScroll = () => {
          sentinel.scrollIntoView({ block: 'end', inline: 'nearest', behavior })
        }
        if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
          if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current)
          scrollRafRef.current = requestAnimationFrame(doScroll)
        } else {
          doScroll()
        }
        return
      }

      // Fallback to direct container/window scroll
      if (container.scrollHeight > container.clientHeight) {
        container.scrollTo({ top: container.scrollHeight, behavior })
      } else if (typeof window !== 'undefined') {
        const doc = document.scrollingElement || document.documentElement
        window.scrollTo({ top: doc.scrollHeight, behavior })
      }
    }

    // During streaming, keep pinned unless the user opted out by scrolling away.
    // If they scroll back near bottom, re-enable pinning and scroll.
    if (streamState.active) {
      if (!userScrolledDuringStreamRef.current) {
        // Smooth scroll during streaming for a better UX; rAF above coalesces frequent updates
        scrollToBottom('smooth')
      } else {
        const nearBottom = isNearBottom(container, NEAR_BOTTOM_PX)
        if (nearBottom) {
          userScrolledDuringStreamRef.current = false
          scrollToBottom('smooth')
        }
      }
      return
    }

    // After streaming completes, only auto-scroll when there is no explicit selection path
    const noExplicitPath = !selectedPath || selectedPath.length === 0
    if (noExplicitPath) {
      // Smooth scroll when not streaming
      scrollToBottom('smooth')
    }
  }, [
    displayMessages,
    streamState.buffer,
    streamState.thinkingBuffer,
    streamState.active,
    streamState.finished,
    selectedPath,
    inputAreaHeight,
  ])

  // Cleanup any pending rAF on unmount
  useEffect(() => {
    return () => {
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current)
    }
  }, [])

  // Listen for user scrolls; while streaming, toggle override based on proximity to bottom
  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const onScroll = (e: Event) => {
      // Only treat as user scroll if the event is trusted (user-initiated)
      if (e.isTrusted && streamState.active) {
        const nearBottom = isNearBottom(el as HTMLElement, NEAR_BOTTOM_PX)
        // If the user is near the bottom, allow auto-pinning; otherwise, suppress it
        userScrolledDuringStreamRef.current = !nearBottom
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
    }
  }, [streamState.active, inputAreaHeight])

  // Reset the user scroll override when the stream finishes
  useEffect(() => {
    if (streamState.finished) {
      userScrolledDuringStreamRef.current = false
    }
  }, [streamState.finished])

  // Scroll to selected node when path changes (only for user-initiated selections)
  useEffect(() => {
    if (selectionScrollCauseRef.current === 'user' && selectedPath && selectedPath.length > 0) {
      const targetId = focusedChatMessageId
      const tryScroll = () => {
        const el = document.getElementById(`message-${targetId}`)
        const container = messagesContainerRef.current
        if (el && container) {
          // Compute element position relative to container and align its top to the container's top
          const containerRect = container.getBoundingClientRect()
          const elRect = el.getBoundingClientRect()
          const relativeTop = elRect.top - containerRect.top
          const targetTop = container.scrollTop + relativeTop
          container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
        }
        // After handling, reset so programmatic path changes (e.g., during send/stream) won't recenter
        selectionScrollCauseRef.current = null
      }

      // Defer until after DOM/layout has settled for this render
      if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
        requestAnimationFrame(() => requestAnimationFrame(tryScroll))
      } else {
        setTimeout(tryScroll, 0)
      }
    }
  }, [selectedPath, focusedChatMessageId])

  // If URL contains a #messageId fragment, capture it once
  const location = useLocation()
  const hashMessageId = React.useMemo(() => {
    if (location.hash && location.hash.startsWith('#')) {
      const idNum = parseInt(location.hash.substring(1))
      return isNaN(idNum) ? null : idNum
    }
    return null
  }, [location.hash])

  // When we have messages loaded and a hashMessageId, build path to that message and set it ONCE per hash.
  // This avoids resetting currentPath when the user switches branches after landing from a search result.
  useEffect(() => {
    // If hash cleared, allow future re-application when a new hash appears
    if (!hashMessageId) {
      hashAppliedRef.current = null
      return
    }
    // Skip if we've already applied this hash
    if (hashAppliedRef.current === hashMessageId) return

    if (conversationMessages.length > 0) {
      // Guard: only proceed if the target hash message exists
      const idToMsg = new Map(conversationMessages.map(m => [m.id, m]))
      if (!idToMsg.has(hashMessageId)) return

      // 1) Base path: root -> ... -> target(hash)
      const path = getParentPath(conversationMessages, hashMessageId)

      // 2) Extend path to leaf by following the first child repeatedly.
      //    If multiple children exist, choose the child with the lowest numeric id (consistent with Heimdall).
      let curId = path[path.length - 1]
      while (true) {
        const children = conversationMessages
          .filter(m => m.parent_id === curId)
          .sort((a, b) => a.id - b.id)
        if (children.length === 0) break
        const firstChild = children[0]
        path.push(firstChild.id)
        curId = firstChild.id
      }

      dispatch(chatSliceActions.conversationPathSet(path))
      // Keep Heimdall selection in sync (expects string IDs)
      dispatch(chatSliceActions.selectedNodePathSet(path.map(id => String(id))))
      // Ensure the focused message id is set so scrolling targets the correct element
      dispatch(chatSliceActions.focusedChatMessageSet(hashMessageId))
      hashAppliedRef.current = hashMessageId
    }
  }, [hashMessageId, conversationMessages, dispatch])

  // Reset the hash application guard when switching conversations
  useEffect(() => {
    hashAppliedRef.current = null
  }, [currentConversationId])

  // Clear selectedFilesForChat on route change
  useEffect(() => {
    dispatch(updateIdeContext({ selectedFilesForChat: [] }))
  }, [location.pathname, dispatch])

  // Also clear selectedFilesForChat on unmount
  useEffect(() => {
    return () => {
      dispatch(updateIdeContext({ selectedFilesForChat: [] }))
    }
  }, [dispatch])

  // useEffect(() => {
  //   if (focusedChatMessageId && conversationMessages.length > 0) {
  //     const path = getParentPath(conversationMessages, focusedChatMessageId)
  //     dispatch(chatSliceActions.conversationPathSet(path))
  //   }
  // }, [focusedChatMessageId, conversationMessages, dispatch])

  // Auto-select latest branch when messages first load
  useEffect(() => {
    if (conversationMessages.length > 0 && (!selectedPath || selectedPath.length === 0)) {
      // If URL has a hash message that exists, skip auto-selecting latest branch
      if (hashMessageId && conversationMessages.some(m => m.id === hashMessageId)) {
        return
      }
      // latest message by timestamp
      const latest = [...conversationMessages].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      if (latest) {
        const idToMsg = new Map(conversationMessages.map(m => [m.id, m]))
        const pathNums: number[] = []
        let cur: typeof latest | undefined = latest
        while (cur) {
          pathNums.unshift(cur.id)
          cur = cur.parent_id ? idToMsg.get(cur.parent_id) : undefined
        }
        if (pathNums.length) {
          // console.log(`path nums ${pathNums}`)
          dispatch(chatSliceActions.conversationPathSet(pathNums))
        }
      }
    }
  }, [conversationMessages, selectedPath, dispatch, hashMessageId])

  // Load models on mount
  useEffect(() => {
    dispatch(fetchModelsForCurrentProvider(true))
  }, [dispatch])

  // Reload models when provider changes
  useEffect(() => {
    if (providers.currentProvider) {
      dispatch(fetchModelsForCurrentProvider(true))
    }
  }, [providers.currentProvider, dispatch])

  // Sync local input with Redux state when conversation changes
  useEffect(() => {
    setLocalInput(messageInput.content)
  }, [messageInput.content, currentConversationId])

  // Initialize or set conversation based on route param
  const { id: conversationIdParam } = useParams<{ id?: string }>()

  useEffect(() => {
    if (conversationIdParam) {
      const idNum = parseInt(conversationIdParam)
      if (!isNaN(idNum)) {
        dispatch(chatSliceActions.conversationSet(idNum))
      }
    } else {
      dispatch(initializeUserAndConversation())
    }
  }, [conversationIdParam, dispatch])

  // Handle input changes with pure local state - no Redux dispatches during typing
  const handleInputChange = useCallback((content: string) => {
    setLocalInput(content)
  }, [])

  // Handle model selection
  const handleModelSelect = useCallback(
    (modelName: string) => {
      const model = models.find(m => m.name === modelName)
      if (model) {
        dispatch(chatSliceActions.modelSelected({ model, persist: true }))
      } else {
        console.warn('Selected model not found:', modelName)
      }
    },
    [models, dispatch]
  )
  const handleProviderSelect = useCallback(
    (providerName: string) => {
      dispatch(chatSliceActions.providerSelected(providerName))
    },
    [dispatch]
  )
  // Local version of canSend that checks localInput instead of Redux state
  const canSendLocal = useMemo(() => {
    const hasValidInput = localInput.trim().length > 0
    const isNotSending = !sendingState.sending && !streamState.active
    const hasModel = !!selectedModel
    return hasValidInput && isNotSending && hasModel
  }, [localInput, sendingState.sending, streamState.active, selectedModel])

  // Helper: scroll to bottom immediately using the sentinel or container fallback
  const scrollToBottomNow = useCallback((behavior: ScrollBehavior = 'auto') => {
    const sentinel = bottomRef.current
    const container = messagesContainerRef.current
    if (sentinel && typeof sentinel.scrollIntoView === 'function') {
      sentinel.scrollIntoView({ block: 'end', inline: 'nearest', behavior })
      return
    }
    if (container) {
      if (container.scrollHeight > container.clientHeight) {
        container.scrollTo({ top: container.scrollHeight, behavior })
      } else if (typeof window !== 'undefined') {
        const doc = document.scrollingElement || document.documentElement
        window.scrollTo({ top: doc.scrollHeight, behavior })
      }
    }
  }, [])

  const handleSend = useCallback(
    (value: number) => {
      // Process file mentions with actual content before sending
      // const processedContent = replaceFileMentionsWithContent(localInput)
      const processedContent = localInput

      // Update Redux state with processed content before sending
      dispatch(chatSliceActions.inputChanged({ content: processedContent }))

      // New send: re-enable auto-pinning until the user scrolls during this stream
      userScrolledDuringStreamRef.current = false
      if (canSendLocal && currentConversationId) {
        // Compute parent message index (last selected path item, if any)
        const parent: number = selectedPath.length > 0 ? selectedPath[selectedPath.length - 1] : 0

        // Use processed content for immediate send
        const inputToSend = { content: processedContent }
        console.log('input to send', inputToSend)
        // Clear local input immediately after sending
        setLocalInput('')
        // Immediately scroll to bottom so the user sees the outgoing message/stream start
        scrollToBottomNow('auto')

        // Dispatch a single sendMessage with repeatNum set to value.
        dispatch(
          sendMessage({
            conversationId: currentConversationId,
            input: inputToSend,
            parent,
            repeatNum: value,
            think: think,
          })
        )
      } else if (!currentConversationId) {
        console.error('📤 No conversation ID available')
      }
    },
    [
      canSendLocal,
      currentConversationId,
      selectedPath,
      think,
      dispatch,
      localInput,
      replaceFileMentionsWithContent,
      scrollToBottomNow,
    ]
  )

  const handleStopGeneration = useCallback(() => {
    if (streamState.streamingMessageId) {
      dispatch(abortStreaming({ messageId: streamState.streamingMessageId }))
    }
  }, [streamState.streamingMessageId, dispatch])

  const handleMessageEdit = useCallback(
    (id: string, newContent: string) => {
      dispatch(chatSliceActions.messageUpdated({ id: parseInt(id), content: newContent }))
      dispatch(updateMessage({ id: parseInt(id), content: newContent }))
      // console.log(parseInt(id))
    },
    [dispatch]
  )

  const handleMessageBranch = useCallback(
    (id: string, newContent: string) => {
      if (currentConversationId) {
        // Replace any @file mentions with actual file contents before branching
        const processed = replaceFileMentionsWithContent(newContent)
        console.log('processed', processed)
        dispatch(
          editMessageWithBranching({
            conversationId: currentConversationId,
            originalMessageId: parseInt(id),
            newContent: newContent,
            modelOverride: selectedModel?.name,
            think: think,
          })
        )
      }
    },
    [currentConversationId, selectedModel?.name, think, dispatch, replaceFileMentionsWithContent]
  )

  const handleResend = useCallback(
    (id: string) => {
      // Find the message by id from displayed messages first, fallback to all conversation messages
      const numericId = parseInt(id)
      const msg = displayMessages.find(m => m.id === numericId) || conversationMessages.find(m => m.id === numericId)

      if (!msg) {
        console.warn('Resend requested for unknown message id:', id)
        return
      }

      // For resend, branch from the PARENT user message with the parent's content
      const parentId = msg.parent_id
      if (!parentId) {
        console.warn('Resend requested but message has no parent to branch from:', id)
        return
      }
      const parentMsg =
        displayMessages.find(m => m.id === parentId) || conversationMessages.find(m => m.id === parentId)
      if (!parentMsg) {
        console.warn('Parent message not found for resend. Parent id:', parentId)
        return
      }

      // Use parent message id and its content to create a sibling branch (resend)
      handleMessageBranch(parentId.toString(), parentMsg.content)
    },
    [displayMessages, conversationMessages, handleMessageBranch]
  )

  const handleNodeSelect = (nodeId: string, path: string[]) => {
    if (!nodeId || !path || path.length === 0) return // ignore clicks on empty space
    // console.log('Node selected:', nodeId, 'Path:', path)
    console.log('selected path', path)
    // Mark this selection as user-initiated so the scroll-to-selection effect may run
    selectionScrollCauseRef.current = 'user'
    // Treat user selection during streaming as an override to bottom pinning
    if (streamState.active) {
      userScrolledDuringStreamRef.current = true
    }
    dispatch(chatSliceActions.conversationPathSet(path.map(id => parseInt(id))))
    dispatch(chatSliceActions.selectedNodePathSet(path))

    console.log('selected node', nodeId)
    dispatch(chatSliceActions.focusedChatMessageSet(parseInt(nodeId)))
  }

  // const handleOnResend = (id: string) => {
  //   if (currentConversationId) {
  //     dispatch(
  //       sendMessage({
  //         conversationId: currentConversationId,
  //         input: messageInput,
  //         repeatNum: 1,
  //         parent: parseInt(id),
  //       })
  //     )
  //   }
  // }

  const performDelete = useCallback(
    (id: string) => {
      const messageId = parseInt(id)
      dispatch(chatSliceActions.messageDeleted(messageId))
      if (currentConversationId) {
        dispatch(deleteMessage({ id: messageId, conversationId: currentConversationId }))
        dispatch(refreshCurrentPathAfterDelete({ conversationId: currentConversationId, messageId }))
      }
    },
    [dispatch, currentConversationId]
  )

  const handleRequestDelete = useCallback(
    (id: string) => {
      if (!confirmDel) {
        performDelete(id)
      } else {
        setPendingDeleteId(id)
      }
    },
    [confirmDel, performDelete]
  )

  const closeDeleteModal = () => {
    setPendingDeleteId(null)
    setDontAskAgain(false)
  }

  const confirmDeleteModal = () => {
    if (dontAskAgain) setconfirmDel(false)
    if (pendingDeleteId) performDelete(pendingDeleteId)
    closeDeleteModal()
  }

  // Handle key press
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend(multiReplyCount)
      }
    },
    [handleSend, multiReplyCount]
  )

  // const handleMultiReplyCountChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  //   const value = e.target.value
  //   if (value === '' || !isNaN(Number(value))) {
  //     dispatch(chatActions.multiReplyCountSet(Number(value)))
  //   }
  // }

  // Refresh models
  const handleRefreshModels = useCallback(() => {
    dispatch(fetchModelsForCurrentProvider(true))
  }, [dispatch])

  // Memoized message list to prevent re-rendering all messages when unrelated state changes
  const memoizedMessageList = useMemo(() => {
    return displayMessages.map(msg => (
      <ChatMessage
        key={msg.id}
        id={msg.id.toString()}
        role={msg.role}
        content={msg.content}
        thinking={msg.thinking_block}
        timestamp={msg.created_at}
        width='w-full'
        modelName={msg.model_name}
        artifacts={msg.artifacts}
        onEdit={handleMessageEdit}
        onBranch={handleMessageBranch}
        onDelete={handleRequestDelete}
        onResend={handleResend}
      />
    ))
  }, [displayMessages, handleMessageEdit, handleMessageBranch, handleRequestDelete, handleResend])

  // Removed obsolete streaming completion effect that synthesized assistant messages.
  // The streaming thunks now dispatch messageAdded and messageBranchCreated directly,
  // and reducers update currentPath appropriately. This avoids race conditions and
  // incorrect parent linking that could break currentPath after branching.

  return (
    <div ref={containerRef} className='flex h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-900'>
      <div
        className='relative flex flex-col flex-none min-w-[280px] h-screen overflow-hidden'
        style={{ width: `${leftWidthPct}%` }}
      >
        {/* <h1 className='text-3xl font-bold text-stone-800 dark:text-stone-200 mb-6'>
          {titleInput} {currentConversationId}
        </h1> */}
        {/* <h1 className='text-lg font-bold text-stone-800 dark:text-stone-200'>Title</h1> */}

        {/* {activeFile && <div className='active-file'>📁 {activeFile.name}</div>} */}
        {/* Conversation Title Editor */}
        {currentConversationId && (
          <div className='flex items-center gap-2 mb-2 mt-2 px-2'>
            <Button
              variant='secondary'
              size='medium'
              className='transition-transform duration-100 active:scale-95'
              aria-label='Conversations'
              onClick={() => navigate('/conversationPage')}
            >
              <i className='bx bx-chat text-2xl' aria-hidden='true'></i>
            </Button>
            <TextField
              value={titleInput}
              onChange={val => {
                setTitleInput(val)
              }}
              placeholder='Conversation title'
              size='large'
            />
          </div>
        )}

        {/* Messages Display */}
        <div className='relative ml-2 flex flex-col thin-scrollbar rounded-lg bg-neutral-50 dark:bg-neutral-900 flex-1 min-h-0'>
          <div
            ref={messagesContainerRef}
            className='px-2 dark:border-neutral-700 border-b border-stone-200 rounded-lg py-4 overflow-y-auto overscroll-y-contain touch-pan-y p-3 bg-neutral-50 dark:bg-neutral-900 flex-1 min-h-0'
          >
            {displayMessages.length === 0 ? (
              <p className='text-stone-800 dark:text-stone-200'>No messages yet...</p>
            ) : (
              memoizedMessageList
            )}

            {/* Show streaming content */}
            {streamState.active && (Boolean(streamState.buffer) || Boolean(streamState.thinkingBuffer)) && (
              <ChatMessage
                id='streaming'
                role='assistant'
                content={streamState.buffer}
                thinking={streamState.thinkingBuffer}
                width='w-full'
                modelName={selectedModel?.name || undefined}
                className=''
              />
            )}
            {streamState.active && (
              <div className=' pb-4 px-3 text-stone-800 dark:text-stone-200 flex justify-end'>
                <i className='bx bx-loader-alt text-2xl animate-spin' style={{ animationDuration: '1s' }}></i>
              </div>
            )}
            {/* Bottom sentinel for robust scrolling */}
            <div ref={bottomRef} data-bottom-sentinel='true' className='h-px' />
          </div>
        </div>
        {/* Input area: controls row + textarea (regular flex child to avoid overlap) */}
        <div ref={inputAreaRef} className='ml-2 flex-none shrink-0'>
          {/* Controls row (above) */}

          {/* Textarea (bottom, grows upward because wrapper is bottom-pinned) */}
          <div className='bg-neutral-100 px-4 pb-2 pt-4 rounded-t-lg dark:bg-neutral-800'>
            <InputTextArea
              value={localInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              onBlur={() => dispatch(chatSliceActions.inputChanged({ content: localInput }))}
              placeholder='Type your message...'
              state={sendingState.sending ? 'disabled' : 'default'}
              width='w-full'
              minRows={3}
              autoFocus={streamState.finished}
              showCharCount={true}
            />
            {/* Selected file chips moved from InputTextArea */}
            {selectedFilesForChat && selectedFilesForChat.length > 0 && (
              <div className='mt-2 flex flex-wrap gap-2'>
                {selectedFilesForChat.map(file => {
                  const displayName =
                    file.name || file.relativePath.split('/').pop() || file.path.split('/').pop() || file.relativePath
                  const isExpanded = expandedFilePath === file.path
                  const isClosing = closingFilePath === file.path
                  const isOpening = openingFilePath === file.path
                  return (
                    <div
                      key={file.path}
                      className='relative group inline-flex items-center gap-2 max-w-full rounded-md border border-neutral-500 dark:bg-neutral-700 dark:text-neutral-200 text-neutral-800 px-2 py-1 text-sm'
                      title={file.relativePath || file.path}
                      onClick={e => {
                        if (!isExpanded) {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setExpandedAnchor({ left: rect.left, top: rect.top })
                          setOpeningFilePath(file.path)
                          setExpandedFilePath(file.path)
                          // Clear opening state after transition completes
                          window.setTimeout(() => setOpeningFilePath(null), 130)
                        }
                      }}
                    >
                      <span className='truncate max-w-[220px]'>{displayName}</span>
                      <button
                        type='button'
                        className='rounded dark:hover:bg-blue-200 hover:bg-blue-700 p-0.5 text-blue-700 dark:text-blue-200'
                        aria-label={`Remove ${displayName}`}
                        onClick={e => {
                          e.stopPropagation()
                          handleRemoveFileSelection(file)
                        }}
                      >
                        ✕
                      </button>

                      {/* Hover tooltip that can expand into anchored modal */}
                      <div
                        className={`absolute bottom-full left-0 mb-2 origin-bottom-left rounded-lg shadow-xl border border-gray-600 p-3 transform transition-all duration-100 ease-out ${
                          isExpanded
                            ? 'hidden'
                            : 'z-50 dark:bg-neutral-900 bg-slate-100 opacity-0 invisible scale-95 pointer-events-none w-80 group-hover:opacity-100 group-hover:visible group-hover:scale-100'
                        }`}
                      >
                        <div className='text-xs text-blue-600 dark:text-blue-300 font-medium mb-2 truncate'>
                          {file.name || file.relativePath.split('/').pop() || file.path.split('/').pop()}
                        </div>
                        <div
                          className={`text-xs font-mono whitespace-pre-wrap break-words text-stone-800 dark:text-stone-300 ${isExpanded ? 'overflow-auto max-h-[60vh]' : isClosing ? 'overflow-hidden' : 'overflow-hidden line-clamp-6'} ${isOpening || isClosing ? 'opacity-50 ' : 'opacity-100 visible'} transition-opacity duration-50 overscroll-contain select-text`}
                        >
                          {file.contents}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className='bg-neutral-100 px-1 pt-2 rounded-b-lg dark:bg-neutral-800 flex flex-col items-end'>
              {/* <h3 className='text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3'>Send Message:</h3> */}

              {/* {messageInput.content.length > 0 && (
              <small className='text-stone-800 dark:text-stone-200 text-xs mb-3 block text-right w-full'>
                Press Enter to send, Shift+Enter for new line
              </small>
            )} */}

              {/* <h3 className='text-lg font-semibold text-stone-800 dark:text-stone-200 mb-1'>Model Selection:</h3> */}
              <div className='flex items-center gap-3 mb-3 justify-end w-full flex-wrap'>
                <div
                  className='ide-status text-neutral-900 max-w-2/12 dark:text-neutral-200 break-words line-clamp-2 text-right'
                  title={workspace?.name ? `Workspace: ${workspace.name} connected` : ''}
                >
                  {ideContext?.extensionConnected ? '' : ''}
                  {workspace?.name && `${workspace.name}`}
                </div>

                {/* {streamState.active && (
                  <Button
                    variant='secondary'
                    onClick={handleStopGeneration}
                    className='ml-2'
                    disabled={!streamState.streamingMessageId}
                  >
                    Stop
                  </Button>
                )} */}
                <Button
                  variant='secondary'
                  className='rounded-full'
                  size='medium'
                  onClick={() => {
                    setSpinSettings(true)
                    setSettingsOpen(true)
                  }}
                >
                  <i
                    className={`bx bx-cog text-xl ${spinSettings ? 'animate-[spin_0.6s_linear_1]' : ''}`}
                    aria-hidden='true'
                    onAnimationEnd={() => setSpinSettings(false)}
                  ></i>
                </Button>

                {/* <span className='text-stone-800 dark:text-stone-200 text-sm'>Available: {providers.providers.length}</span> */}
                <Select
                  value={providers.currentProvider || ''}
                  onChange={handleProviderSelect}
                  options={providers.providers.map(p => p.name)}
                  placeholder='Select a provider...'
                  disabled={providers.providers.length === 0}
                  className='max-w-md transition-transform duration-60 active:scale-97'
                  searchBarVisible={true}
                />
                {/* <span className='text-stone-800 dark:text-stone-200 text-sm'>{models.length} models</span> */}
                <Select
                  value={selectedModel?.name || ''}
                  onChange={handleModelSelect}
                  options={models.map(m => m.name)}
                  placeholder='Select a model...'
                  disabled={models.length === 0}
                  className='w-full max-w-xs transition-transform duration-60 active:scale-99'
                  searchBarVisible={true}
                />
                <Button
                  variant='secondary'
                  className='rounded-full'
                  size='medium'
                  onClick={() => {
                    setSpinRefresh(true)
                    handleRefreshModels()
                  }}
                >
                  <i
                    className={`bx bx-refresh text-xl ${spinRefresh ? 'animate-[spin_0.6s_linear_1]' : ''}`}
                    aria-hidden='true'
                    onAnimationEnd={() => setSpinRefresh(false)}
                  ></i>
                </Button>
                {selectedModel?.thinking && (
                  <Button variant='secondary' className='rounded-full' size='medium' onClick={() => setThink(t => !t)}>
                    {think ? (
                      <i className='bx bxs-bulb text-xl text-yellow-400' aria-hidden='true'></i>
                    ) : (
                      <i className='bx bx-bulb text-xl' aria-hidden='true'></i>
                    )}
                  </Button>
                )}
                {!currentConversationId ? (
                  'Creating...'
                ) : sendingState.streaming ? (
                  <Button variant='secondary' onClick={handleStopGeneration} disabled={!streamState.streamingMessageId}>
                    <i className='bx bx-stop-circle text-xl' aria-hidden='true'></i>
                  </Button>
                ) : sendingState.sending ? (
                  'Sending...'
                ) : (
                  <Button
                    variant={canSendLocal && currentConversationId ? 'primary' : 'secondary'}
                    size='medium'
                    disabled={!canSendLocal || !currentConversationId}
                    onClick={() => handleSend(multiReplyCount)}
                  >
                    <i className='bx bx-send text-xl' aria-hidden='true'></i>
                  </Button>
                )}
                {/* <Button
                  variant={canSendLocal && currentConversationId ? 'primary' : 'secondary'}
                  disabled={!canSendLocal || !currentConversationId}
                  onClick={() => handleSend(multiReplyCount)}
                >
                  {!currentConversationId
                    ? 'Creating...'
                    : sendingState.streaming
                      ? 'Streaming...'
                      : sendingState.sending
                        ? 'Sending...'
                        : 'Send'}
                </Button> */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEPARATOR */}
      <div
        className='w-2 bg-neutral-300 dark:bg-secondary-700 hover:bg-secondary-500 cursor-col-resize select-none'
        role='separator'
        aria-orientation='vertical'
        onMouseDown={() => setIsResizing(true)}
        onTouchStart={e => {
          e.preventDefault()
          setIsResizing(true)
        }}
        title='Drag to resize'
      />

      <div className='flex-1 min-w-0'>
        <Heimdall
          key={currentConversationId ?? 'none'}
          chatData={heimdallData}
          loading={loading}
          error={error}
          compactMode={compactMode}
          conversationId={currentConversationId}
          onNodeSelect={handleNodeSelect}
        />
      </div>
      <SettingsPane open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Centered custom delete confirmation modal */}
      {pendingDeleteId && confirmDel && (
        <div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/50' onClick={closeDeleteModal}>
          <div
            className='bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 w-[90%] max-w-sm'
            onClick={e => e.stopPropagation()}
          >
            <h3 className='text-lg font-semibold mb-2 text-neutral-900 dark:text-neutral-100'>Delete message?</h3>
            <p className='text-sm text-neutral-700 dark:text-neutral-300 mb-4'>This action cannot be undone.</p>
            <label className='flex items-center gap-2 mb-4 text-sm text-neutral-700 dark:text-neutral-300'>
              <input type='checkbox' checked={dontAskAgain} onChange={e => setDontAskAgain(e.target.checked)} />
              Don't ask again this session
            </label>
            <div className='flex justify-end gap-2'>
              <Button variant='secondary' onClick={closeDeleteModal} className='active:scale-90'>
                Cancel
              </Button>
              <Button
                variant='primary'
                className='bg-red-600 hover:bg-red-700 border-red-700 text-white active:scale-90'
                onClick={confirmDeleteModal}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed expanded panel rendered at root to sit above backdrop and allow scroll */}
      {(expandedFilePath || closingFilePath) &&
        (() => {
          const activePath = expandedFilePath || closingFilePath
          const file = selectedFilesForChat.find(f => f.path === activePath)
          if (!file) return null
          const isClosing = !!closingFilePath && closingFilePath === file.path
          const name = file.name || file.relativePath.split('/').pop() || file.path.split('/').pop()
          const left = expandedAnchor?.left ?? 16
          const top = (expandedAnchor?.top ?? 16) - 8
          return (
            <div
              className={`fixed z-[100000] -translate-y-full rounded-lg shadow-2xl border border-gray-600 p-3 transform transition-all duration-100 ease-out dark:bg-neutral-900 bg-slate-100 pointer-events-auto`}
              style={{ left, top, maxWidth: 'min(90vw, 56rem)', width: '56rem' }}
              onMouseDown={e => e.stopPropagation()}
              onMouseUp={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
              onWheel={e => e.stopPropagation()}
              onTouchStart={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}
              onTouchEnd={e => e.stopPropagation()}
            >
              <div className='flex items-center justify-between mb-2 gap-3'>
                <div className='text-xs text-blue-600 dark:text-blue-300 font-medium truncate'>{name}</div>
                <button
                  className='text-xs px-2 text-neutral-800 dark:text-neutral-300 py-1 rounded border border-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                  onClick={handleCloseExpandedPreview}
                >
                  Close
                </button>
              </div>
              <div
                className={`text-xs font-mono whitespace-pre-wrap break-words text-stone-800 dark:text-stone-200 ${isClosing ? 'opacity-50' : 'opacity-100'} transition-opacity duration-100 overflow-auto max-h-[60vh] overscroll-contain select-text`}
              >
                {file.contents}
              </div>
            </div>
          )
        })()}

      {/* Transparent backdrop to allow click-out close. Keep during closing to finish animation */}
      {(expandedFilePath || closingFilePath) && (
        <div className='fixed inset-0 z-[99998] bg-transparent' onClick={handleCloseExpandedPreview} />
      )}
    </div>
  )
}

export default Chat
