// src/App.tsx - Debug version
import React , { useState }  from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ComponentShowcase } from './pages/ComponentShowcase';
import {TextArea} from './components/TextArea/TextArea';
import './App.css';

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
            placeholder="Type your message..."
            minRows={1}
            // maxRows={60}
            width="w-full"
            showCharCount={true}
            // resize='vertical'
          />
        </div>
      
      {/* Container for TextArea */}
      <div className=''>
        <h2 className='text-white text-xl mb-4'>TextArea Test</h2>
        
        {/* Try different width settings */}
        <div className='mb-4'>
          <p className='text-gray-300 text-sm mb-2'>w-1/2 width:</p>
          <TextArea
            value={message}
            onChange={setMessage}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            minRows={1}
            // maxRows={6}
            width="w-1/2"
            showCharCount={true}
          />
        </div>
        
        <div className='mb-4'>
          <p className='text-gray-300 text-sm mb-2'>w-3/4 width:</p>
          <TextArea
            value={message}
            onChange={setMessage}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            minRows={1}
            // maxRows={6}
            width="w-3/4"
            showCharCount={true}
          />
        </div>
        
        <div className='mb-4'>
          <p className='text-gray-300 text-sm mb-2'>w-full width:</p>
          <TextArea
            value={message}
            onChange={setMessage}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            minRows={1}
            // maxRows={6}
            width="w-full"
            showCharCount={true}
          />
        </div>
      </div>
    </div>
  );
};

// Main App component that sets up routing
function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/components" element={<ComponentShowcase />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
export default App;