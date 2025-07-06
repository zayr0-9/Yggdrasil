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
      <h1 className='text-2xl text-left  px-155 py-5 text-white mb-4'>Ygg Chat</h1>
      <div className='w-1/2 mx-auto rounded-lg p-4 outline outline-1 outline-gray-700'>
        <div>
          <ChatMessage
            id='msg-1'
            role='assistant'
            content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
            timestamp={new Date()}
            onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
            onDelete={id => console.log('Delete:', id)}
            onCopy={content => console.log('Copied:', content)}
            width='w-3/5'
            className=''
          />
        </div>
        <div className='px-10 flex justify-end'>
          <ChatMessage
            id='msg-1'
            role='user'
            content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
            timestamp={new Date()}
            onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
            onDelete={id => console.log('Delete:', id)}
            onCopy={content => console.log('Copied:', content)}
            width='w-3/5'
          />
        </div>
        <div>
          <ChatMessage
            id='msg-1'
            role='assistant'
            content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
            timestamp={new Date()}
            onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
            onDelete={id => console.log('Delete:', id)}
            onCopy={content => console.log('Copied:', content)}
            width='w-3/5'
            className=''
          />
        </div>
        <div className='px-10 flex justify-end'>
          <ChatMessage
            id='msg-1'
            role='user'
            content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
            timestamp={new Date()}
            onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
            onDelete={id => console.log('Delete:', id)}
            onCopy={content => console.log('Copied:', content)}
            width='w-3/5'
          />
        </div>
        <div>
          <ChatMessage
            id='msg-1'
            role='assistant'
            content='Hello, how are you?'
            timestamp={new Date()}
            onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
            onDelete={id => console.log('Delete:', id)}
            onCopy={content => console.log('Copied:', content)}
            width='w-3/5'
            className=''
          />
        </div>
        <div className='px-10 flex justify-end'>
          <ChatMessage
            id='msg-1'
            role='user'
            content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod te'
            timestamp={new Date()}
            onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
            onDelete={id => console.log('Delete:', id)}
            onCopy={content => console.log('Copied:', content)}
            width='w-3/5'
          />
        </div>
        <div>
          <ChatMessage
            id='msg-1'
            role='assistant'
            content='Hello, how are you?'
            timestamp={new Date()}
            onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
            onDelete={id => console.log('Delete:', id)}
            onCopy={content => console.log('Copied:', content)}
            width='w-3/5'
            className=''
          />
        </div>
        <div className='px-10 flex justify-end'>
          <ChatMessage
            id='msg-1'
            role='user'
            content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod te'
            timestamp={new Date()}
            onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
            onDelete={id => console.log('Delete:', id)}
            onCopy={content => console.log('Copied:', content)}
            width='w-3/5'
          />
        </div>
        <div>
          <ChatMessage
            id='msg-1'
            role='assistant'
            content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
            timestamp={new Date()}
            onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
            onDelete={id => console.log('Delete:', id)}
            onCopy={content => console.log('Copied:', content)}
            width='w-3/5'
            className=''
          />
        </div>
        <div className='px-10 flex justify-end'>
          <ChatMessage
            id='msg-1'
            role='user'
            content='Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
            timestamp={new Date()}
            onEdit={(id, newContent) => console.log('Edit:', id, newContent)}
            onDelete={id => console.log('Delete:', id)}
            onCopy={content => console.log('Copied:', content)}
            width='w-3/5'
          />
        </div>
        <div className='mb-4 px-10 py-8 mr-0 ml-auto rounded-lg'>
          {/* <p className='text-gray-300 text-sm mb-2'>w-full width:</p> */}
          <TextArea
            value={message}
            onChange={setMessage}
            onKeyDown={handleKeyDown}
            placeholder='Type your message...'
            minRows={1}
            // maxRows={60}
            width='w-full'
            showCharCount={true}
            className='shadow-xl/30'
            // resize='vertical'
          />
        </div>
      </div>
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
