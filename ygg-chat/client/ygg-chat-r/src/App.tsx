import React, { useEffect } from 'react'
import './App.css'
import { Button, ChatMessage, Heimdall, TextArea } from './components'
import {
  // Chat actions
  chatActions,
  deleteMessage,
  fetchModels,
  selectCanSend,
  selectConversationMessages,
  selectCurrentConversationId,
  selectMessageInput,
  // Chat selectors
  selectModels,
  selectSelectedModel,
  selectSendingState,
  selectStreamState,
  sendMessage,
  updateMessage,
} from './features/chats'
import { useAppDispatch, useAppSelector } from './hooks/redux'

function ChatTest() {
  const dispatch = useAppDispatch()

  interface ChatNode {
    id: string
    message: string
    sender: 'user' | 'assistant'
    children: ChatNode[]
  }

  // Redux selectors
  const models = useAppSelector(selectModels)
  const selectedModel = useAppSelector(selectSelectedModel)
  const messageInput = useAppSelector(selectMessageInput)
  const canSend = useAppSelector(selectCanSend)
  const sendingState = useAppSelector(selectSendingState)
  const streamState = useAppSelector(selectStreamState)
  const conversationMessages = useAppSelector(selectConversationMessages)
  const currentConversationId = useAppSelector(selectCurrentConversationId)

  // Local state only for Heimdall tree visualization
  const [heimdallData, setHeimdallData] = React.useState<ChatNode | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [compactMode, setCompactMode] = React.useState<boolean>(false)

  const fetchTreeData = async (conversationId: number) => {
    console.log('🌳 fetchTreeData: Starting fetch for conversation:', conversationId)
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`http://localhost:3001/api/conversations/${conversationId}/messages/tree`)
      console.log('🌳 fetchTreeData: Response status:', response.status)

      if (!response.ok) {
        throw new Error(`Failed to fetch conversation tree: ${response.status} ${response.statusText}`)
      }

      const treeData = await response.json()
      console.log('🌳 fetchTreeData: Tree data received:', treeData)
      setHeimdallData(treeData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('🌳 fetchTreeData: Error:', errorMessage)
      setError(errorMessage)
      setHeimdallData(null)
    } finally {
      setLoading(false)
      console.log('🌳 fetchTreeData: Fetch complete')
    }
  }

  // Fetch tree when conversation changes
  useEffect(() => {
    console.log('🔄 Conversation ID changed:', currentConversationId)
    if (currentConversationId) {
      console.log('🔄 Triggering initial fetchTreeData for conversation:', currentConversationId)
      fetchTreeData(currentConversationId)
    }
  }, [currentConversationId])

  //refresh tree when new message added
  useEffect(() => {
    console.log('messages refreshed')
    fetchTreeData(currentConversationId)
  }, [conversationMessages])

  // Load models on mount
  useEffect(() => {
    dispatch(fetchModels(true))
  }, [dispatch])

  // Initialize conversation on mount
  useEffect(() => {
    const initializeConversation = async () => {
      try {
        // Create test user
        const userResponse = await fetch('http://localhost:3001/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'test-user' }),
        })

        if (!userResponse.ok) {
          console.error('Failed to create user:', userResponse.status)
          return
        }

        const user = await userResponse.json()

        // Create conversation
        const convResponse = await fetch('http://localhost:3001/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            title: 'Test Conversation',
            modelName: selectedModel,
          }),
        })

        if (!convResponse.ok) {
          console.error('Failed to create conversation:', convResponse.status)
          return
        }

        const conversation = await convResponse.json()
        console.log('💬 Conversation created with ID:', conversation.id)
        dispatch(chatActions.conversationSet(conversation.id))
      } catch (error) {
        console.error('Failed to initialize conversation:', error)
      }
    }

    if (!currentConversationId) {
      initializeConversation()
    }
  }, [selectedModel, currentConversationId, dispatch])

  // Handle input changes
  const handleInputChange = (content: string) => {
    dispatch(chatActions.inputChanged({ content }))
  }

  // Handle model selection
  const handleModelSelect = (modelName: string) => {
    dispatch(chatActions.modelSelected({ modelName, persist: true }))
  }

  // Handle sending message
  const handleSend = () => {
    if (canSend && currentConversationId) {
      // Send message
      dispatch(
        sendMessage({
          conversationId: currentConversationId,
          input: messageInput,
        })
      )
    } else if (!currentConversationId) {
      console.error('📤 No conversation ID available')
    }
  }

  const handleMessageEdit = (id: string, newContent: string) => {
    dispatch(chatActions.messageUpdated({ id: parseInt(id), content: newContent }))
    dispatch(updateMessage({ id: parseInt(id), content: newContent }))
    console.log(parseInt(id))
  }

  const handleMessageDelete = (id: string) => {
    dispatch(chatActions.messageDeleted(parseInt(id)))
    dispatch(deleteMessage(parseInt(id)))
    console.log(parseInt(id))
  }

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Refresh models
  const handleRefreshModels = () => {
    dispatch(fetchModels(true))
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
          timestamp: new Date().toISOString(),
          pastedContext: [],
          artifacts: [],
          parentId: null,
          children_ids: [],
        }
        dispatch(chatActions.messageAdded(assistantMessage))
      }

      // Refresh tree when response completes
      console.log('🌳 Stream complete, refreshing tree data for conversation:', currentConversationId)
      setTimeout(() => {
        fetchTreeData(currentConversationId)
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
    <div className='flex min-h-screen bg-gray-900'>
      <div className='p-5 max-w-4xl flex-1'>
        <h1 className='text-3xl font-bold text-white mb-6'>Ygg Chat</h1>

        {/* Model Selection */}
        <div className='mb-6 bg-gray-800 p-4 rounded-lg'>
          <h3 className='text-lg font-semibold text-white mb-3'>Model Selection:</h3>
          <div className='flex items-center gap-3 mb-3'>
            <Button variant='primary' size='small' onClick={handleRefreshModels}>
              Refresh Models
            </Button>
            <Button
              onClick={() => {
                setCompactMode(!compactMode)
              }}
            >
              {' '}
              change mode
            </Button>
            {/* <Button
              onClick={() => {
                setCompactMode('false')
              }}
            >
              {' '}
              expanded mode
            </Button> */}

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

        {/* Messages Display */}
        <div className='mb-6 bg-gray-800 p-4 rounded-lg'>
          <h3 className='text-lg font-semibold text-white mb-3'>Messages ({conversationMessages.length}):</h3>
          <div className='border border-gray-600 rounded h-128 overflow-y-auto p-3 bg-gray-900'>
            {conversationMessages.length === 0 ? (
              <p className='text-gray-500'>No messages yet...</p>
            ) : (
              conversationMessages.map(msg => (
                <ChatMessage
                  key={msg.id}
                  id={msg.id.toString()}
                  role={msg.role}
                  content={msg.content}
                  timestamp={new Date(msg.timestamp)}
                  width='w-full'
                  onEdit={handleMessageEdit}
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
        <div className='mb-6 bg-gray-800 p-4 rounded-lg'>
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
              onClick={handleSend}
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
          {messageInput.content.length > 0 && (
            <small className='text-gray-400 text-xs mt-2 block'>Press Enter to send, Shift+Enter for new line</small>
          )}
        </div>

        {/* Test Actions */}
        <div className='mb-6 bg-gray-800 p-4 rounded-lg'>
          <h3 className='text-lg font-semibold text-white mb-3'>Test Actions:</h3>
          <div className='flex gap-2 flex-wrap'>
            <Button variant='secondary' size='small' onClick={() => handleInputChange('Hello, how are you?')}>
              Set Test Message
            </Button>
            <Button variant='danger' size='small' onClick={() => dispatch(chatActions.inputCleared())}>
              Clear Input
            </Button>
            <Button variant='outline' size='small' onClick={() => dispatch(chatActions.messagesCleared())}>
              Clear Messages
            </Button>
            <Button
              variant='primary'
              size='small'
              onClick={() => {
                console.log('🆕 New conversation - clearing state')
                dispatch(chatActions.conversationCleared())
                setHeimdallData(null)
              }}
            >
              New Conversation
            </Button>
            <Button
              variant='primary'
              size='small'
              onClick={() => {
                if (currentConversationId) {
                  console.log('🔄 Manual tree refresh for conversation:', currentConversationId)
                  fetchTreeData(currentConversationId)
                } else {
                  console.warn('🔄 Cannot refresh - no conversation ID')
                }
              }}
            >
              Refresh Tree
            </Button>
          </div>
        </div>

        {/* Test Instructions */}
        <div className='bg-blue-900 bg-opacity-50 border border-blue-700 p-4 rounded-lg text-blue-100'>
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
        <div className='bg-gray-800 p-4 mb-6 rounded-lg text-gray-300 text-sm font-mono'>
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
        <Heimdall chatData={heimdallData} loading={loading} error={error} compactMode={compactMode} />
      </div>
    </div>
  )
}

// Main App component
function App() {
  return <ChatTest />
}

export default App

//id|conversation_id|parent_id|children_ids|role|content|created_at
