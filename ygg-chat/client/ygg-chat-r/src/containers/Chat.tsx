import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { Button, ChatMessage, Heimdall, TextArea, TextField } from '../components'
import {
  chatSliceActions,
  deleteMessage,
  editMessageWithBranching,
  fetchConversationMessages,
  fetchMessageTree,
  fetchModelsForCurrentProvider,
  initializeUserAndConversation,
  refreshCurrentPathAfterDelete,
  selectCanSend,
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
import { fetchConversations, makeSelectConversationById } from '../features/conversations'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { getParentPath } from '../utils/path'

// Types

function Chat() {
  const dispatch = useAppDispatch()

  // Redux selectors
  const models = useAppSelector(selectModels)
  const selectedModel = useAppSelector(selectSelectedModel)
  const providers = useAppSelector(selectProviderState)
  const messageInput = useAppSelector(selectMessageInput)
  const canSend = useAppSelector(selectCanSend)
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

  const titleChanged = titleInput !== (currentConversation?.title ?? '')

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

  const handleTitleSave = () => {
    if (currentConversationId && titleChanged) {
      dispatch(updateConversationTitle({ id: currentConversationId, title: titleInput.trim() }))
    }
  }

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

  // Refresh tree when new message added
  useEffect(() => {
    if (currentConversationId) {
      dispatch(fetchMessageTree(currentConversationId))
    }
  }, [conversationMessages, dispatch])

  // Auto-scroll to bottom when messages update, but avoid doing so when a specific
  // path is selected (e.g. after clicking a node in Heimdall) to prevent the
  // subsequent smooth scroll animation from always starting at the very bottom.
  useEffect(() => {
    // Only auto-scroll when no node/path is explicitly selected
    // During streaming, always keep scrolled to bottom regardless of selectedPath
    if ((streamState.active || !selectedPath || selectedPath.length === 0) && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [displayMessages, streamState.buffer, streamState.active, selectedPath])

  // Scroll to selected node when path changes
  useEffect(() => {
    if (selectedPath && selectedPath.length > 0) {
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
      }

      // Defer until after DOM/layout has settled for this render
      if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
        requestAnimationFrame(() => requestAnimationFrame(tryScroll))
      } else {
        setTimeout(tryScroll, 0)
      }
    }
  }, [selectedPath, displayMessages])

  // If URL contains a #messageId fragment, capture it once
  const location = useLocation()
  const hashMessageId = React.useMemo(() => {
    if (location.hash && location.hash.startsWith('#')) {
      const idNum = parseInt(location.hash.substring(1))
      return isNaN(idNum) ? null : idNum
    }
    return null
  }, [location.hash])

  // When we have messages loaded and a hashMessageId, build path to that message and set it
  useEffect(() => {
    if (hashMessageId && conversationMessages.length > 0) {
      const path = getParentPath(conversationMessages, hashMessageId)
      dispatch(chatSliceActions.conversationPathSet(path))
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

  // Handle input changes
  const handleInputChange = (content: string) => {
    dispatch(chatSliceActions.inputChanged({ content }))
  }

  // Handle model selection
  const handleModelSelect = (modelName: string) => {
    dispatch(chatSliceActions.modelSelected({ modelName, persist: true }))
  }

  const handleProviderSelect = (providerName: string) => {
    dispatch(chatSliceActions.providerSelected(providerName))
  }

  const handleSend = (value: number) => {
    if (canSend && currentConversationId) {
      // Compute parent message index (last selected path item, if any)
      const parent: number | null = selectedPath.length > 0 ? selectedPath[selectedPath.length - 1] : null

      // Dispatch a single sendMessage with repeatNum set to value.
      dispatch(
        sendMessage({
          conversationId: currentConversationId,
          input: messageInput,
          repeatNum: value,
          parent: parent ?? undefined,
        })
      )
    } else if (!currentConversationId) {
      console.error('📤 No conversation ID available')
    }
  }

  // Handle sending message
  // const handleSend = () => {
  //   if (canSend && currentConversationId) {
  //     // Send message
  //     dispatch(
  //       sendMessage({
  //         conversationId: currentConversationId,
  //         input: messageInput,
  //       })
  //     )
  //   } else if (!currentConversationId) {
  //     console.error('📤 No conversation ID available')
  //   }
  // }

  const handleMessageEdit = (id: string, newContent: string) => {
    dispatch(chatSliceActions.messageUpdated({ id: parseInt(id), content: newContent }))
    dispatch(updateMessage({ id: parseInt(id), content: newContent }))
    console.log(parseInt(id))
  }

  const handleMessageBranch = (id: string, newContent: string) => {
    if (currentConversationId) {
      dispatch(
        editMessageWithBranching({
          conversationId: currentConversationId,
          originalMessageId: parseInt(id),
          newContent: newContent,
          modelOverride: selectedModel || undefined,
        })
      )
    }
  }

  const handleResend = (id: string) => {
    // Find the message by id from displayed messages first, fallback to all conversation messages
    const numericId = parseInt(id)
    const msg =
      displayMessages.find(m => m.id === numericId) || conversationMessages.find(m => m.id === numericId)

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
  }

  const handleNodeSelect = (nodeId: string, path: string[]) => {
    if (!nodeId || !path || path.length === 0) return // ignore clicks on empty space
    // console.log('Node selected:', nodeId, 'Path:', path)
    console.log('selected path', path)
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

  const handleMessageDelete = (id: string) => {
    const messageId = parseInt(id)
    dispatch(chatSliceActions.messageDeleted(messageId))
    if (currentConversationId) {
      dispatch(deleteMessage({ id: messageId, conversationId: currentConversationId }))
      dispatch(refreshCurrentPathAfterDelete({ conversationId: currentConversationId, messageId }))
    }
    console.log(messageId)
  }

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(multiReplyCount)
    }
  }

  // const handleMultiReplyCountChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  //   const value = e.target.value
  //   if (value === '' || !isNaN(Number(value))) {
  //     dispatch(chatActions.multiReplyCountSet(Number(value)))
  //   }
  // }

  // Refresh models
  const handleRefreshModels = () => {
    dispatch(fetchModelsForCurrentProvider(true))
  }

  // Add assistant message when streaming completes
  useEffect(() => {
    if (!streamState.active && streamState.messageId && streamState.buffer && currentConversationId) {
      // Check if message already exists
      const alreadyExists = conversationMessages.some(
        msg => msg.id === streamState.messageId && msg.role === 'assistant'
      )
      console.log(conversationMessages)
      if (!alreadyExists) {
        const assistantMessage = {
          id: streamState.messageId,
          conversation_id: currentConversationId,
          role: 'assistant' as const,
          content: streamState.buffer,
          created_at: new Date().toISOString(),
          pastedContext: [],
          artifacts: [],
          parentId: null,
          children_ids: [],
          model_name: selectedModel,
        }
        dispatch(chatSliceActions.messageAdded(assistantMessage))
      }

      // Refresh tree when response completes
      console.log('🌳 Stream complete, refreshing tree data for conversation:', currentConversationId)
      setTimeout(() => {
        dispatch(fetchMessageTree(currentConversationId))
      }, 500)
    }
  }, [
    streamState.active,
    streamState.messageId,
    streamState.buffer,
    currentConversationId,
    conversationMessages,
    dispatch,
  ])

  return (
    <div ref={containerRef} className='flex min-h-screen bg-gray-900 bg-neutral-50 dark:bg-neutral-900'>
      <div className='p-5 flex-none min-w-[280px]' style={{ width: `${leftWidthPct}%` }}>
        <h1 className='text-3xl font-bold text-stone-800 dark:text-stone-200 mb-6'>
          {titleInput} {currentConversationId}
        </h1>
        {/* Conversation Title Editor */}
        {currentConversationId && (
          <div className='flex items-center gap-2 mb-4'>
            <TextField value={titleInput} onChange={setTitleInput} placeholder='Conversation title' size='large' />
            <Button variant='primary' size='small' disabled={!titleChanged} onClick={handleTitleSave}>
              Save
            </Button>
          </div>
        )}

        {/* Messages Display */}
        <div className='mb-6 bg-gray-800 py-4 rounded-lg bg-neutral-50 dark:bg-neutral-900'>
          <h3 className='text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3 px-2'>
            Messages ({conversationMessages.length}):
          </h3>
          <div
            ref={messagesContainerRef}
            className='px-2 dark:border-neutral-700 border-b border-stone-200 rounded-lg py-4 h-230 overflow-y-auto p-3 bg-neutral-50 bg-slate-50 dark:bg-neutral-900'
          >
            {displayMessages.length === 0 ? (
              <p className='text-stone-800 dark:text-stone-200'>No messages yet...</p>
            ) : (
              displayMessages.map(msg => (
                <ChatMessage
                  key={msg.id}
                  id={msg.id.toString()}
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.created_at}
                  width='w-full'
                  onEdit={handleMessageEdit}
                  onBranch={handleMessageBranch}
                  onDelete={handleMessageDelete}
                  onResend={handleResend}
                />
              ))
            )}

            {/* Show streaming content */}
            {streamState.active && streamState.buffer && (
              <ChatMessage
                id='streaming'
                role='assistant'
                content={streamState.buffer}
                width='w-full'
                className='animate-pulse border-blue-400'
              />
            )}
          </div>
        </div>

        {/* Message Input */}
        <div className='bg-neutral-100 p-4 rounded-lg dark:bg-neutral-800'>
          <h3 className='text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3'>Send Message:</h3>
          <div>
            <TextArea
              value={messageInput.content}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder='Type your message...'
              state={sendingState.sending ? 'disabled' : 'default'}
              width='w-full'
              minRows={3}
              autoFocus={streamState.finished}
              showCharCount={true}
            />

            <Button
              variant={canSend && currentConversationId ? 'primary' : 'secondary'}
              disabled={!canSend || !currentConversationId}
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
            <div className='flex items-center gap-3 flex-wrap mt-2'>
              <div className='flex items-center gap-2'>
                <div className='text-stone-800 dark:text-stone-200'>Multi reply count - </div>
                <TextArea
                  value={multiReplyCount.toString()}
                  onChange={e => dispatch(chatSliceActions.multiReplyCountSet(Number(e)))}
                  width='w-1/6'
                  minRows={1}
                ></TextArea>
              </div>

              <div className='flex items-center gap-3'>
                <span className='text-stone-800 dark:text-stone-200 text-sm'>
                  Available: {providers.providers.length} providers
                </span>
                <select
                  value={providers.currentProvider || ''}
                  onChange={e => handleProviderSelect(e.target.value)}
                  className='max-w-md p-2 rounded bg-neutral-50 dark:bg-gray-700 text-stone-800 dark:text-stone-200'
                  disabled={providers.providers.length === 0}
                >
                  <option value=''>Select a provider...</option>
                  {providers.providers.map(provider => (
                    <option key={provider.name} value={provider.name}>
                      {provider.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant='primary'
                  size='small'
                  onClick={() => {
                    if (currentConversationId) {
                      dispatch(fetchMessageTree(currentConversationId))
                    }
                  }}
                >
                  Refresh Tree
                </Button>
              </div>
            </div>
          </div>
          {messageInput.content.length > 0 && (
            <small className='text-stone-800 dark:text-stone-200 text-xs mt-2 block'>
              Press Enter to send, Shift+Enter for new line
            </small>
          )}
        </div>

        {/* Model Selection */}
        <div className='mb-6 bg-gray-800 p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800'>
          <h3 className='text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3'>Model Selection:</h3>
          <div className='flex items-center gap-3 mb-3'>
            <Button variant='primary' size='small' onClick={handleRefreshModels}>
              Refresh Models
            </Button>
            <Button onClick={() => dispatch(chatSliceActions.heimdallCompactModeToggled())}> change mode</Button>

            <span className='text-stone-800 dark:text-stone-200 text-sm'>Available: {models.length} models</span>
          </div>

          <select
            value={selectedModel || ''}
            onChange={e => handleModelSelect(e.target.value)}
            className='w-full max-w-md p-2 rounded bg-neutral-50 dark:bg-gray-700 text-stone-800 dark:text-stone-200'
            disabled={models.length === 0}
          >
            <option value=''>Select a model...</option>
            {models.map(model => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* Test Instructions */}
        {/* <div className=' bg-stone-100 bg-opacity-50 p-4 rounded-lg dark:bg-neutral-800 dark:border-neutral-700 mb-4'>
          <h4 className='font-semibold mb-2 text-stone-800 dark:text-stone-200'>Test Instructions:</h4>
          <ol className='list-decimal list-inside space-y-1 text-sm text-stone-800 dark:text-stone-200'>
            <li>Make sure your server is running on localhost:3001</li>
            <li>Make sure Ollama is running on localhost:11434</li>
            <li>Click "Refresh Models" to load available models from Ollama</li>
            <li>Select a model from the dropdown</li>
            <li>Type a message in the textarea</li>
            <li>Click Send or press Enter to send</li>
            <li>Watch the streaming response in the messages area</li>
            <li>Check the Chat State panel for real-time state updates</li>
            <li>Open browser console to see detailed logs</li>
          </ol>
          <p className='text-sm mt-2 text-stone-800 dark:text-stone-200'>
            <strong>Note:</strong> This tests the chat Redux logic without requiring actual conversation management.
          </p>
        </div> */}

        {/* Chat State Display */}
        {/* <div className='bg-gray-800 p-4 mb-6 rounded-lg text-gray-300 text-sm font-mono bg-neutral-100 dark:bg-neutral-800'>
          <h3 className='text-lg font-semibold mb-3 text-stone-800 dark:text-stone-200'>Chat State:</h3>
          <div className='grid grid-cols-2 gap-2 text-stone-800 dark:text-stone-200'>
            <p>
              <strong>Models Available:</strong> {models.length}
            </p>
            <p>
              <strong>Selected Model:</strong> {selectedModel || 'None'}
            </p>
            <p>
              <strong>Conversation ID:</strong> {currentConversationId || 'Creating...'}
            </p>
            <p>
              <strong>Can Send:</strong> {canSend && currentConversationId ? 'Yes' : 'No'}
            </p>
            <p>
              <strong>Sending:</strong> {sendingState.sending ? 'Yes' : 'No'}
            </p>
            <p>
              <strong>Streaming:</strong> {sendingState.streaming ? 'Yes' : 'No'}
            </p>
            <p>
              <strong>Stream Active:</strong> {streamState.active ? 'Yes' : 'No'}
            </p>
            <p>
              <strong>Input Length:</strong> {messageInput.content.length}
            </p>
            <p>
              <strong>Messages Count:</strong> {conversationMessages.length}
            </p>
            <p>
              <strong>Heimdall Data:</strong> {heimdallData ? 'Loaded' : 'Null'}
            </p>
            <p>
              <strong>Tree Loading:</strong> {loading ? 'Yes' : 'No'}
            </p>
          </div>
          {streamState.buffer && (
            <p className='mt-2'>
              <strong>Stream Buffer:</strong> "{streamState.buffer.slice(0, 50)}..."
            </p>
          )}
          {sendingState.error && (
            <p className='text-red-400 mt-2'>
              <strong>Error:</strong> {sendingState.error}
            </p>
          )}
          {error && (
            <p className='text-red-400 mt-2'>
              <strong>Tree Error:</strong> {error}
            </p>
          )}
        </div> */}
      </div>

      <div
        className='w-1 bg-neutral-300 dark:bg-neutral-700 hover:bg-blue-400 cursor-col-resize select-none'
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
    </div>
  )
}

export default Chat
