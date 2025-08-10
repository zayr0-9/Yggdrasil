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
  selectCanSend,
  selectConversationMessages,
  selectCurrentConversationId,
  selectCurrentPath,
  selectDisplayMessages,
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
  updateMessage,
} from '../features/chats'
import { makeSelectConversationById, updateConversation } from '../features/conversations'
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

  // Conversation title editing
  const currentConversation = useAppSelector(
    currentConversationId ? makeSelectConversationById(currentConversationId) : () => null
  )
  const [titleInput, setTitleInput] = useState(currentConversation?.title ?? '')

  useEffect(() => {
    setTitleInput(currentConversation?.title ?? '')
  }, [currentConversation?.title])

  const titleChanged = titleInput !== (currentConversation?.title ?? '')

  const handleTitleSave = () => {
    if (currentConversationId && titleChanged) {
      dispatch(updateConversation({ id: currentConversationId, title: titleInput.trim() }))
    }
  }

  // Ref for auto-scroll
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Heimdall state from Redux
  const heimdallData = useAppSelector(selectHeimdallData)
  const loading = useAppSelector(selectHeimdallLoading)
  const error = useAppSelector(selectHeimdallError)
  const compactMode = useAppSelector(selectHeimdallCompactMode)

  // Fetch tree when conversation changes
  useEffect(() => {
    if (currentConversationId) {
      dispatch(fetchMessageTree(currentConversationId))
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
  }, [conversationMessages, currentConversationId, dispatch])

  // Auto-scroll to bottom when messages update, but avoid doing so when a specific
  // path is selected (e.g. after clicking a node in Heimdall) to prevent the
  // subsequent smooth scroll animation from always starting at the very bottom.
  useEffect(() => {
    // Only auto-scroll when no node/path is explicitly selected
    if ((!selectedPath || selectedPath.length === 0) && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [displayMessages, streamState.buffer, streamState.active, selectedPath])

  // Scroll to selected node when path changes
  useEffect(() => {
    if (selectedPath && selectedPath.length > 0) {
      const targetId = selectedPath[selectedPath.length - 1]
      const el = document.getElementById(`message-${targetId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
          console.log(`path nums ${pathNums}`)
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

  const handleNodeSelect = (nodeId: string, path: string[]) => {
    if (!nodeId || !path || path.length === 0) return // ignore clicks on empty space
    console.log('Node selected:', nodeId, 'Path:', path)
    dispatch(chatSliceActions.selectedNodePathSet(path))
  }

  const handleMessageDelete = (id: string) => {
    const messageId = parseInt(id)
    dispatch(chatSliceActions.messageDeleted(messageId))
    if (currentConversationId) {
      dispatch(deleteMessage({ id: messageId, conversationId: currentConversationId }))
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
    <div className='flex min-h-screen bg-gray-900 dark:bg-neutral-900'>
      <div className='p-5 max-w-4xl flex-1'>
        <h1 className='text-3xl font-bold text-white mb-6'>Ygg Chat {currentConversationId}</h1>
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
        <div className='mb-6 bg-gray-800 py-4 rounded-lg dark:bg-neutral-900'>
          <h3 className='text-lg font-semibold text-white mb-3'>Messages ({conversationMessages.length}):</h3>
          <div
            ref={messagesContainerRef}
            className='border light:border-neutral-300 dark:border-neutral-700 rounded-lg py-4 h-230 overflow-y-auto p-3 bg-gray-900 dark:bg-neutral-900'
          >
            {displayMessages.length === 0 ? (
              <p className='text-gray-500'>No messages yet...</p>
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
        <div className='mb-6 bg-gray-800 p-4 rounded-lg dark:bg-neutral-800'>
          <h3 className='text-lg font-semibold text-white mb-3'>Send Message:</h3>
          <div>
            <TextArea
              value={messageInput.content}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder='Type your message...'
              state={sendingState.sending ? 'disabled' : 'default'}
              width='w-full'
              minRows={3}
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
            <div className='text-neutral-50'>Multi reply count - </div>
            <TextArea
              value={multiReplyCount.toString()}
              onChange={e => dispatch(chatSliceActions.multiReplyCountSet(Number(e)))}
              width='w-1/6'
              minRows={1}
            ></TextArea>
          </div>
          {messageInput.content.length > 0 && (
            <small className='text-gray-400 text-xs mt-2 block'>Press Enter to send, Shift+Enter for new line</small>
          )}
        </div>

        {/* Provider Selection */}
        <div className='mb-6 bg-gray-800 p-4 rounded-lg dark:bg-neutral-800'>
          <h3 className='text-lg font-semibold text-white mb-3'>Provider Selection:</h3>
          <div className='flex items-center gap-3 mb-3'>
            {/* TODO : implement provider refresh */}
            {/* <Button variant='primary' size='small' onClick={handleRefreshProviders}>
              Refresh Providers
            </Button> */}

            <span className='text-gray-300 text-sm'>Available: {models.length} providers</span>
          </div>

          <select
            value={providers.currentProvider || ''}
            onChange={e => handleProviderSelect(e.target.value)}
            className='w-full max-w-md p-2 rounded bg-gray-700 text-white border border-gray-600'
            disabled={providers.providers.length === 0}
          >
            <option value=''>Select a provider...</option>
            {providers.providers.map(provider => (
              <option key={provider.name} value={provider.name}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        {/* Model Selection */}
        <div className='mb-6 bg-gray-800 p-4 rounded-lg dark:bg-neutral-800'>
          <h3 className='text-lg font-semibold text-white mb-3'>Model Selection:</h3>
          <div className='flex items-center gap-3 mb-3'>
            <Button variant='primary' size='small' onClick={handleRefreshModels}>
              Refresh Models
            </Button>
            <Button onClick={() => dispatch(chatSliceActions.heimdallCompactModeToggled())}> change mode</Button>

            <span className='text-gray-300 text-sm'>Available: {models.length} models</span>
          </div>

          <select
            value={selectedModel || ''}
            onChange={e => handleModelSelect(e.target.value)}
            className='w-full max-w-md p-2 rounded bg-gray-700 text-white border border-gray-600'
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

        {/* Test Actions */}
        <div className='mb-6 bg-gray-800 p-4 rounded-lg dark:bg-neutral-800'>
          <h3 className='text-lg font-semibold text-white mb-3'>Test Actions:</h3>
          <div className='flex gap-2 flex-wrap'>
            <Button variant='secondary' size='small' onClick={() => handleInputChange('Hello, how are you?')}>
              Set Test Message
            </Button>
            <Button variant='danger' size='small' onClick={() => dispatch(chatSliceActions.inputCleared())}>
              Clear Input
            </Button>
            <Button variant='outline' size='small' onClick={() => dispatch(chatSliceActions.messagesCleared())}>
              Clear Messages
            </Button>
            <Button
              variant='primary'
              size='small'
              onClick={() => {
                console.log('🆕 New conversation - clearing state')
                dispatch(chatSliceActions.conversationCleared())
                dispatch(chatSliceActions.heimdallDataLoaded({ treeData: null }))
              }}
            >
              New Conversation
            </Button>
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

        {/* Test Instructions */}
        <div className='bg-blue-900 bg-opacity-50 border border-blue-700 p-4 rounded-lg text-blue-100 dark:bg-neutral-800 dark:border-neutral-700 mb-4'>
          <h4 className='font-semibold mb-2'>Test Instructions:</h4>
          <ol className='list-decimal list-inside space-y-1 text-sm'>
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
          <p className='text-sm mt-2'>
            <strong>Note:</strong> This tests the chat Redux logic without requiring actual conversation management.
          </p>
        </div>

        {/* Chat State Display */}
        <div className='bg-gray-800 p-4 mb-6 rounded-lg text-gray-300 text-sm font-mono dark:bg-neutral-800'>
          <h3 className='text-lg font-semibold mb-3 text-white'>Chat State:</h3>
          <div className='grid grid-cols-2 gap-2'>
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
        </div>
      </div>

      <div className='flex-1 min-w-0'>
        <Heimdall
          chatData={heimdallData}
          loading={loading}
          error={error}
          compactMode={compactMode}
          onNodeSelect={handleNodeSelect}
        />
      </div>
    </div>
  )
}

export default Chat
