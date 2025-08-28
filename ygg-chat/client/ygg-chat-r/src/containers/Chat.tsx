import 'boxicons' // Types
import 'boxicons/css/boxicons.min.css'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
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
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { getParentPath } from '../utils/path'

function Chat() {
  const dispatch = useAppDispatch()

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
  // - While streaming: only pin if the user hasn't overridden AND either near bottom or no explicit path
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
        // Instant scroll during streaming to prevent smooth animation fighting frequent updates
        scrollToBottom('auto')
      } else {
        const nearBottom = isNearBottom(container, NEAR_BOTTOM_PX)
        if (nearBottom) {
          userScrolledDuringStreamRef.current = false
          scrollToBottom('auto')
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
          // Compute element position relative to container and center it within the scroll area
          const containerRect = container.getBoundingClientRect()
          const elRect = el.getBoundingClientRect()
          const relativeTop = elRect.top - containerRect.top
          const targetTop = container.scrollTop + relativeTop - container.clientHeight / 2 + el.clientHeight / 2
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
      const path = getParentPath(conversationMessages, hashMessageId)
      dispatch(chatSliceActions.conversationPathSet(path))
      // Ensure the focused message id is set so scrolling targets the correct element
      dispatch(chatSliceActions.focusedChatMessageSet(hashMessageId))
      hashAppliedRef.current = hashMessageId
    }
  }, [hashMessageId, conversationMessages, dispatch])

  // useEffect(() => {
  //   if (focusedChatMessageId && conversationMessages.length > 0) {
  //     const path = getParentPath(conversationMessages, focusedChatMessageId)
  //     dispatch(chatSliceActions.conversationPathSet(path))
  //   }
  // }, [focusedChatMessageId, conversationMessages, dispatch])

  // Auto-select latest branch when messages first load
  useEffect(() => {
    if (conversationMessages.length > 0 && (!selectedPath || selectedPath.length === 0)) {
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
  }, [conversationMessages, selectedPath, dispatch])

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

  const handleSend = useCallback(
    (value: number) => {
      // Update Redux state with current local input before sending
      dispatch(chatSliceActions.inputChanged({ content: localInput }))

      // New send: re-enable auto-pinning until the user scrolls during this stream
      userScrolledDuringStreamRef.current = false
      if (canSendLocal && currentConversationId) {
        // Compute parent message index (last selected path item, if any)
        const parent: number = selectedPath.length > 0 ? selectedPath[selectedPath.length - 1] : 0

        // Use localInput directly for immediate send
        const inputToSend = { content: localInput }

        // Clear local input immediately after sending
        setLocalInput('')

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
    [canSendLocal, currentConversationId, selectedPath, think, dispatch, localInput]
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
      console.log(parseInt(id))
    },
    [dispatch]
  )

  const handleMessageBranch = useCallback(
    (id: string, newContent: string) => {
      if (currentConversationId) {
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
    [currentConversationId, selectedModel?.name, think, dispatch]
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
    <div ref={containerRef} className='flex h-screen overflow-hidden bg-gray-900 bg-neutral-50 dark:bg-neutral-900'>
      <div
        className='relative flex flex-col flex-none min-w-[280px] h-screen overflow-hidden'
        style={{ width: `${leftWidthPct}%` }}
      >
        {/* <h1 className='text-3xl font-bold text-stone-800 dark:text-stone-200 mb-6'>
          {titleInput} {currentConversationId}
        </h1> */}
        {/* <h1 className='text-lg font-bold text-stone-800 dark:text-stone-200'>Title</h1> */}

        {/* Conversation Title Editor */}
        {currentConversationId && (
          <div className='flex items-center gap-2 mb-2 mt-2 px-2'>
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
        <div className='relative ml-2 flex flex-col thin-scrollbar bg-gray-800 rounded-lg bg-neutral-50 dark:bg-neutral-900 flex-1 min-h-0'>
          <div
            ref={messagesContainerRef}
            className='px-2 dark:border-neutral-700 border-b border-stone-200 rounded-lg py-4 overflow-y-auto overscroll-y-contain touch-pan-y p-3 bg-neutral-50 dark:bg-neutral-900 flex-1 min-h-0'
            style={{ paddingBottom: `${inputAreaHeight}px` }}
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
            {/* Bottom sentinel for robust scrolling */}
            <div ref={bottomRef} data-bottom-sentinel='true' className='h-px' />
          </div>
        </div>
        {/* Absolute input area: controls row + textarea, measured as one block */}
        <div ref={inputAreaRef} className='absolute left-0 right-0 bottom-0 z-10'>
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
            <div className='bg-neutral-100 px-1 pt-2 rounded-b-lg dark:bg-neutral-800 flex flex-col items-end'>
              {/* <h3 className='text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3'>Send Message:</h3> */}

              {/* {messageInput.content.length > 0 && (
              <small className='text-stone-800 dark:text-stone-200 text-xs mb-3 block text-right w-full'>
                Press Enter to send, Shift+Enter for new line
              </small>
            )} */}

              {/* <h3 className='text-lg font-semibold text-stone-800 dark:text-stone-200 mb-1'>Model Selection:</h3> */}
              <div className='flex items-center gap-3 mb-3 justify-end w-full flex-wrap'>
                {streamState.active && (
                  <Button
                    variant='secondary'
                    onClick={handleStopGeneration}
                    className='ml-2'
                    disabled={!streamState.streamingMessageId}
                  >
                    Stop
                  </Button>
                )}
                <Button variant='primary' className='rounded-full' size='small' onClick={() => setSettingsOpen(true)}>
                  <i className='bx bx-cog text-xl' aria-hidden='true'></i>
                </Button>

                {/* <span className='text-stone-800 dark:text-stone-200 text-sm'>Available: {providers.providers.length}</span> */}
                <Select
                  value={providers.currentProvider || ''}
                  onChange={handleProviderSelect}
                  options={providers.providers.map(p => p.name)}
                  placeholder='Select a provider...'
                  disabled={providers.providers.length === 0}
                  className='max-w-md'
                  searchBarVisible={true}
                />
                {/* <span className='text-stone-800 dark:text-stone-200 text-sm'>{models.length} models</span> */}
                <Select
                  value={selectedModel?.name || ''}
                  onChange={handleModelSelect}
                  options={models.map(m => m.name)}
                  placeholder='Select a model...'
                  disabled={models.length === 0}
                  className='w-full max-w-xs'
                  searchBarVisible={true}
                />
                <Button variant='primary' className='rounded-full' size='small' onClick={handleRefreshModels}>
                  <i className='bx bx-refresh text-xl' aria-hidden='true'></i>
                </Button>
                {selectedModel?.thinking && (
                  <Button variant='primary' className='rounded-full' size='small' onClick={() => setThink(t => !t)}>
                    {think ? (
                      <i className='bx bxs-bulb text-xl text-yellow-400' aria-hidden='true'></i>
                    ) : (
                      <i className='bx bx-bulb text-xl' aria-hidden='true'></i>
                    )}
                  </Button>
                )}
                <Button
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
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEPARATOR */}
      <div
        className='w-2 bg-neutral-300 dark:bg-neutral-700 hover:bg-neutral-400 cursor-col-resize select-none'
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
              <Button variant='secondary' onClick={closeDeleteModal}>
                Cancel
              </Button>
              <Button
                variant='primary'
                className='bg-red-600 hover:bg-red-700 border-red-700 text-white'
                onClick={confirmDeleteModal}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Chat
