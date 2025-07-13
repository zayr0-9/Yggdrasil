import React, { useEffect, useState } from 'react'
import './App.css'
import { Heimdall } from './components'
import {
  // Chat actions
  chatActions,
  fetchModels,
  selectCanSend,
  selectMessageInput,
  // Chat selectors
  selectModels,
  selectSelectedModel,
  selectSendingState,
  selectStreamState,
  sendMessage,
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

  // Chat selectors
  const models = useAppSelector(selectModels)
  const selectedModel = useAppSelector(selectSelectedModel)
  const messageInput = useAppSelector(selectMessageInput)
  const canSend = useAppSelector(selectCanSend)
  const sendingState = useAppSelector(selectSendingState)
  const streamState = useAppSelector(selectStreamState)

  // Local state for test
  const [testConversationId, setTestConversationId] = useState<number | null>(null)
  const [testMessages, setTestMessages] = useState<any[]>([])
  const [heimdallData, setHeimdallData] = useState<ChatNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // Use effect to fetch when conversation changes
  useEffect(() => {
    console.log('🔄 Conversation ID changed:', testConversationId)
    if (testConversationId) {
      console.log('🔄 Triggering initial fetchTreeData for conversation:', testConversationId)
      fetchTreeData(testConversationId)
    }
  }, [testConversationId])

  // Load models on mount
  useEffect(() => {
    dispatch(fetchModels(true))
  }, [dispatch])

  // Create or get conversation on mount
  useEffect(() => {
    const initializeConversation = async () => {
      try {
        // First, create a test user if needed
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

        // Create a conversation for this user
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
        setTestConversationId(conversation.id)
      } catch (error) {
        console.error('Failed to initialize conversation:', error)
      }
    }

    if (!testConversationId) {
      initializeConversation()
    }
  }, [selectedModel, testConversationId])

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
    if (canSend && testConversationId) {
      // Add user message to local test messages
      const userMessage = {
        id: Date.now(),
        role: 'user',
        content: messageInput.content,
        timestamp: new Date().toISOString(),
      }
      setTestMessages(prev => [...prev, userMessage])

      // Send message
      dispatch(
        sendMessage({
          conversationId: testConversationId,
          input: messageInput,
        })
      )

      // Backup: Try to refresh tree after a longer delay as fallback
      setTimeout(() => {
        console.log('🌳 Backup tree refresh after 3 seconds for conversation:', testConversationId)
        fetchTreeData(testConversationId)
      }, 3000)
    } else if (!testConversationId) {
      console.error('📤 No conversation ID available')
    }
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

  // Update test messages when streaming completes
  useEffect(() => {
    if (!streamState.active && streamState.messageId && streamState.buffer) {
      // Prevent duplicate assistant messages
      const alreadyExists = testMessages.some(msg => msg.id === streamState.messageId && msg.role === 'assistant')

      if (!alreadyExists) {
        const assistantMessage = {
          id: streamState.messageId,
          role: 'assistant',
          content: streamState.buffer,
          timestamp: new Date().toISOString(),
        }
        setTestMessages(prev => [...prev, assistantMessage])
      }

      // 🔧 FIX: Refresh tree data when response is complete
      if (testConversationId) {
        console.log('🌳 Stream complete, refreshing tree data for conversation:', testConversationId)
        // Add small delay to ensure message is fully saved
        setTimeout(() => {
          fetchTreeData(testConversationId)
        }, 500)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamState.active, streamState.messageId, streamState.buffer, testConversationId])

  return (
    <div className='flex'>
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }} className=''>
        <h1>Ygg Chat</h1>

        {/* Chat State Display */}
        <div
          style={{
            background: '#f5f5f5',
            padding: '15px',
            marginBottom: '20px',
            borderRadius: '5px',
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        >
          <h3>Chat State:</h3>
          <p>
            <strong>Models Available:</strong> {models.length}
          </p>
          <p>
            <strong>Selected Model:</strong> {selectedModel || 'None'}
          </p>
          <p>
            <strong>Conversation ID:</strong> {testConversationId || 'Creating...'}
          </p>
          <p>
            <strong>Can Send:</strong> {canSend && testConversationId ? 'Yes' : 'No'}
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
            <strong>Stream Buffer:</strong> {streamState.buffer ? `"${streamState.buffer.slice(0, 50)}..."` : 'Empty'}
          </p>
          <p>
            <strong>Input Length:</strong> {messageInput.content.length}
          </p>
          <p>
            <strong>Heimdall Data:</strong> {heimdallData ? 'Loaded' : 'Null'}
          </p>
          <p>
            <strong>Tree Loading:</strong> {loading ? 'Yes' : 'No'}
          </p>
          {sendingState.error && (
            <p style={{ color: 'red' }}>
              <strong>Error:</strong> {sendingState.error}
            </p>
          )}
          {error && (
            <p style={{ color: 'red' }}>
              <strong>Tree Error:</strong> {error}
            </p>
          )}
        </div>

        {/* Model Selection */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Model Selection:</h3>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            <button
              onClick={handleRefreshModels}
              style={{
                padding: '5px 10px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Refresh Models
            </button>
            <span>Available: {models.length} models</span>
          </div>

          <select
            value={selectedModel || ''}
            onChange={e => handleModelSelect(e.target.value)}
            style={{ padding: '5px', width: '300px' }}
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

        {/* Test Messages Display */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Test Messages:</h3>
          <div
            style={{
              border: '1px solid #ddd',
              height: '200px',
              overflowY: 'auto',
              padding: '10px',
              backgroundColor: '#fafafa',
            }}
          >
            {testMessages.length === 0 ? (
              <p style={{ color: '#666' }}>No messages yet...</p>
            ) : (
              testMessages.map(msg => (
                <div key={msg.id} style={{ marginBottom: '10px' }}>
                  <strong>{msg.role}:</strong> {msg.content}
                </div>
              ))
            )}

            {/* Show streaming content */}
            {streamState.active && streamState.buffer && (
              <div style={{ marginBottom: '10px', fontStyle: 'italic', color: '#007bff' }}>
                <strong>assistant (streaming):</strong> {streamState.buffer}
              </div>
            )}
          </div>
        </div>

        {/* Message Input */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Send Message:</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <textarea
              value={messageInput.content}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder='Type your message...'
              disabled={sendingState.sending}
              style={{
                flex: 1,
                padding: '10px',
                minHeight: '80px',
                borderRadius: '4px',
                border: '1px solid #ddd',
                resize: 'vertical',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!canSend || !testConversationId}
              style={{
                padding: '10px 20px',
                backgroundColor: canSend && testConversationId ? '#007bff' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: canSend && testConversationId ? 'pointer' : 'not-allowed',
                alignSelf: 'flex-start',
              }}
            >
              {!testConversationId
                ? 'Creating conversation...'
                : sendingState.streaming
                  ? 'Streaming...'
                  : sendingState.sending
                    ? 'Sending...'
                    : 'Send'}
            </button>
          </div>
          {messageInput.content.length > 0 && (
            <small style={{ color: '#666' }}>
              Characters: {messageInput.content.length} | Press Enter to send, Shift+Enter for new line
            </small>
          )}
        </div>

        {/* Test Actions */}
        <div style={{ marginBottom: '20px' }}>
          <h3>Test Actions:</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleInputChange('Hello, how are you?')}
              style={{
                padding: '5px 10px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Set Test Message
            </button>
            <button
              onClick={() => dispatch(chatActions.inputCleared())}
              style={{
                padding: '5px 10px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Clear Input
            </button>
            <button
              onClick={() => setTestMessages([])}
              style={{
                padding: '5px 10px',
                backgroundColor: '#ffc107',
                color: 'black',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Clear Messages
            </button>
            <button
              onClick={() => {
                console.log('🆕 New conversation - clearing state')
                setTestConversationId(null)
                setTestMessages([])
                setHeimdallData(null)
              }}
              style={{
                padding: '5px 10px',
                backgroundColor: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              New Conversation
            </button>
            <button
              onClick={() => {
                if (testConversationId) {
                  console.log('🔄 Manual tree refresh for conversation:', testConversationId)
                  fetchTreeData(testConversationId)
                } else {
                  console.warn('🔄 Cannot refresh - no conversation ID')
                }
              }}
              style={{
                padding: '5px 10px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Refresh Tree
            </button>
          </div>
        </div>

        {/* Test Instructions */}
        <div
          style={{
            background: '#d1ecf1',
            color: '#0c5460',
            padding: '15px',
            borderRadius: '4px',
            fontSize: '14px',
          }}
        >
          <h4>Test Instructions:</h4>
          <ol>
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
          <p>
            <strong>Note:</strong> This tests the chat Redux logic without requiring actual conversation management.
          </p>
        </div>
      </div>
      <div className='grow-1'>
        <Heimdall chatData={heimdallData} loading={loading} error={error} compactMode={true} />
      </div>
    </div>
  )
}

// Main App component
function App() {
  return <ChatTest />
}

export default App
