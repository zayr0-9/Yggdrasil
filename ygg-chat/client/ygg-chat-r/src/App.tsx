import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Chat, Homepage } from './containers'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Homepage />} />
        <Route path='/chat/:id' element={<Chat />} />
        {/* Fallback */}
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App