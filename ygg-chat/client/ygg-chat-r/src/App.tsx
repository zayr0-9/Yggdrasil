// src/App.tsx - Debug version
import React, { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './App.css'
import { ChatMessage, TextArea } from './components'
import { ComponentShowcase } from './pages/ComponentShowcase'

// Create a simple homepage component
const HomePage: React.FC = () => {
  const [message, setMessage] = useState('')
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Handle send logic here or call your button component
    }
  }

  return (
    <div className='min-h-screen bg-gray-900 p-4'>
      {/* Test if Tailwind is working */}
      <div className='bg-red-500 text-white p-4 mb-4 rounded'>
        Tailwind Test - This should be red background with white text
      </div>
      <div className='mb-4'>
        <p className='text-gray-300 text-sm mb-2'>w-full width:</p>
        <TextArea
          value={message}
          onChange={setMessage}
          onKeyDown={handleKeyDown}
          placeholder='Type your message...'
          minRows={1}
          // maxRows={60}
          width='w-full'
          showCharCount={true}
          // resize='vertical'
        />
      </div>

      <ChatMessage
        id='msg-1'
        role='user'
        content='Hello, how are you?'
        timestamp={new Date()}
        onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
        onDelete={id => console.log('Delete:', id)}
        onCopy={content => console.log('Copied:', content)}
      />
    </div>
  )
}

// Main App component that sets up routing
function App() {
  return (
    <BrowserRouter>
      <div className='App'>
        <Routes>
          <Route path='/' element={<HomePage />} />
          <Route path='/components' element={<ComponentShowcase />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
export default App
