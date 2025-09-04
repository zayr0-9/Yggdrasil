import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Chat, ConversationPage, Homepage, Settings } from './containers'
import IdeContextBootstrap from './IdeContextBootstrap'

function App() {
  return (
    <BrowserRouter>
      {/* Establish IDE Context WebSocket globally so it's not tied to any specific page */}
      <IdeContextBootstrap />
      <Routes>
        <Route path='/conversationPage' element={<ConversationPage />} />
        <Route path='/' element={<Homepage />} />
        <Route path='/chat/:id' element={<Chat />} />
        <Route path='/settings' element={<Settings />} />
        {/* Fallback */}
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
