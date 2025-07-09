// src/App.tsx - Debug version
import React, { useState } from 'react'
import './App.css'
import { clearUser, loginUser, selectCurrentUser, selectUserStatus } from './features/users'
import { deleteUser } from './features/users/usersActions'
import { useAppDispatch, useAppSelector } from './hooks/redux'

// Create a simple homepage component
// const HomePage: React.FC = () => {
//   const [message, setMessage] = useState('')
//   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault()
//       // Handle send logic here or call your button component
//     }
//   }

//   return (
//     <div className='min-h-screen bg-gray-900 p-4'>
//       <h1 className='text-2xl text-left  px-155 py-5 text-white mb-4'>Ygg Chat</h1>
//       <div className='w-1/2 mx-auto rounded-lg p-4 outline outline-1 outline-gray-700'>
//         <div>
//           <ChatMessage
//             id='msg-1'
//             role='assistant'
//             content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
//             timestamp={new Date()}
//             onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
//             onDelete={id => console.log('Delete:', id)}
//             onCopy={content => console.log('Copied:', content)}
//             width='w-3/5'
//             className=''
//           />
//         </div>
//         <div className='px-10 flex justify-end'>
//           <ChatMessage
//             id='msg-1'
//             role='user'
//             content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
//             timestamp={new Date()}
//             onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
//             onDelete={id => console.log('Delete:', id)}
//             onCopy={content => console.log('Copied:', content)}
//             width='w-3/5'
//           />
//         </div>
//         <div>
//           <ChatMessage
//             id='msg-1'
//             role='assistant'
//             content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
//             timestamp={new Date()}
//             onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
//             onDelete={id => console.log('Delete:', id)}
//             onCopy={content => console.log('Copied:', content)}
//             width='w-3/5'
//             className=''
//           />
//         </div>
//         <div className='px-10 flex justify-end'>
//           <ChatMessage
//             id='msg-1'
//             role='user'
//             content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
//             timestamp={new Date()}
//             onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
//             onDelete={id => console.log('Delete:', id)}
//             onCopy={content => console.log('Copied:', content)}
//             width='w-3/5'
//           />
//         </div>
//         <div>
//           <ChatMessage
//             id='msg-1'
//             role='assistant'
//             content='Hello, how are you?'
//             timestamp={new Date()}
//             onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
//             onDelete={id => console.log('Delete:', id)}
//             onCopy={content => console.log('Copied:', content)}
//             width='w-3/5'
//             className=''
//           />
//         </div>
//         <div className='px-10 flex justify-end'>
//           <ChatMessage
//             id='msg-1'
//             role='user'
//             content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod te'
//             timestamp={new Date()}
//             onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
//             onDelete={id => console.log('Delete:', id)}
//             onCopy={content => console.log('Copied:', content)}
//             width='w-3/5'
//           />
//         </div>
//         <div>
//           <ChatMessage
//             id='msg-1'
//             role='assistant'
//             content='Hello, how are you?'
//             timestamp={new Date()}
//             onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
//             onDelete={id => console.log('Delete:', id)}
//             onCopy={content => console.log('Copied:', content)}
//             width='w-3/5'
//             className=''
//           />
//         </div>
//         <div className='px-10 flex justify-end'>
//           <ChatMessage
//             id='msg-1'
//             role='user'
//             content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod te'
//             timestamp={new Date()}
//             onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
//             onDelete={id => console.log('Delete:', id)}
//             onCopy={content => console.log('Copied:', content)}
//             width='w-3/5'
//           />
//         </div>
//         <div>
//           <ChatMessage
//             id='msg-1'
//             role='assistant'
//             content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
//             timestamp={new Date()}
//             onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
//             onDelete={id => console.log('Delete:', id)}
//             onCopy={content => console.log('Copied:', content)}
//             width='w-3/5'
//             className=''
//           />
//         </div>
//         <div className='px-10 flex justify-end'>
//           <ChatMessage
//             id='msg-1'
//             role='user'
//             content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
//             timestamp={new Date()}
//             onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
//             onDelete={id => console.log('Delete:', id)}
//             onCopy={content => console.log('Copied:', content)}
//             width='w-3/5'
//           />
//         </div>
//         <div className='mb-4 px-10 py-8 mr-0 ml-auto rounded-lg'>
//           {/* <p className='text-gray-300 text-sm mb-2'>w-full width:</p> */}
//           <TextArea
//             value={message}
//             onChange={setMessage}
//             onKeyDown={handleKeyDown}
//             placeholder='Type your message...'
//             minRows={1}
//             // maxRows={60}
//             width='w-full'
//             showCharCount={true}
//             className='shadow-xl/30'
//             // resize='vertical'
//           />
//         </div>
//       </div>
//     </div>
//   )
// }

// // Main App component that sets up routing
// function App() {
//   return (
//     <BrowserRouter>
//       <div className='App'>
//         <Routes>
//           <Route path='/' element={<HomePage />} />
//           <Route path='/components' element={<ComponentShowcase />} />
//         </Routes>
//       </div>
//     </BrowserRouter>
//   )
// }
// export default App

//test for user features

function UserTest() {
  const dispatch = useAppDispatch()
  const currentUser = useAppSelector(selectCurrentUser)
  const { loading, error, isAuthenticated } = useAppSelector(selectUserStatus)

  const [username, setUsername] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (username.trim()) {
      dispatch(loginUser(username.trim()))
    }
  }

  const handleLogout = () => {
    dispatch(clearUser())
    setUsername('')
  }

  const handleDelete = async () => {
    if (currentUser?.id) {
      dispatch(deleteUser(currentUser.id))
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h1>Yggdrasil User Test</h1>

      {/* Current State Display */}
      <div
        style={{
          background: '#f5f5f5',
          padding: '15px',
          marginBottom: '20px',
          borderRadius: '5px',
          fontFamily: 'monospace',
        }}
      >
        <h3>Current State:</h3>
        <p>
          <strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}
        </p>
        <p>
          <strong>Loading:</strong> {loading ? 'Yes' : 'No'}
        </p>
        <p>
          <strong>Error:</strong> {error || 'None'}
        </p>
        <p>
          <strong>User:</strong> {currentUser ? JSON.stringify(currentUser, null, 2) : 'None'}
        </p>
      </div>

      {/* Login Form */}
      {!isAuthenticated ? (
        <form onSubmit={handleLogin} style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label htmlFor='username'>Username:</label>
            <input
              id='username'
              type='text'
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={loading}
              style={{
                marginLeft: '10px',
                padding: '5px',
                width: '200px',
              }}
              placeholder='Enter username'
            />
          </div>
          <button
            type='submit'
            disabled={loading || !username.trim()}
            style={{
              padding: '8px 16px',
              backgroundColor: loading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          <p>
            Welcome, <strong>{currentUser?.username}</strong>!
          </p>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
          <button
            onClick={handleDelete}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginLeft: '10px',
            }}
          >
            Delete User
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div
          style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

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
          <li>Make sure your server is running on :3001</li>
          <li>Enter any username and click Login</li>
          <li>Check that user data appears in Current State</li>
          <li>Refresh the page - user should persist (localStorage)</li>
          <li>Click Logout to clear user</li>
          <li>Try the same username again - should get same user ID</li>
        </ol>
      </div>
    </div>
  )
}

function App() {
  return <UserTest />
}

export default App
