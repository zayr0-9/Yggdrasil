import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { Chat, ConversationPage, Homepage, Login, Settings, PaymentPage } from './containers'
import IdeContextBootstrap from './IdeContextBootstrap'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      {/* Establish IDE Context WebSocket globally so it's not tied to any specific page */}
      <IdeContextBootstrap />
      <Routes>
        {/* Public route */}
        <Route path='/login' element={<Login />} />

        {/* Protected routes */}
        <Route
          path='/conversationPage'
          element={
            <ProtectedRoute>
              <ConversationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path='/'
          element={
            <ProtectedRoute>
              <Homepage />
            </ProtectedRoute>
          }
        />
        <Route
          path='/chat/:id'
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path='/settings'
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path='/payment'
          element={
            <ProtectedRoute>
              <PaymentPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
