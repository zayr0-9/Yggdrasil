import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { chatActions } from '../features/chats'
import {
  fetchConversations,
  createConversation,
  selectAllConversations,
  selectConvLoading,
  selectConvError,
  Conversation,
} from '../features/conversations'



const Homepage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const conversations = useAppSelector<Conversation[]>(selectAllConversations)
  const loading = useAppSelector(selectConvLoading)
  const error = useAppSelector(selectConvError)

  useEffect(() => {
    dispatch(fetchConversations())
  }, [dispatch])

  const handleSelect = (conv: Conversation) => {
    dispatch(chatActions.conversationSet(conv.id))
    navigate(`/chat/${conv.id}`)
  }

  const handleNewConversation = async () => {
    const result = await dispatch(createConversation({})).unwrap()
    handleSelect(result)
  }

  return (
    <div className='p-6 max-w-3xl mx-auto'>
      <h1 className='text-2xl font-bold mb-4'>Conversations</h1>

      <Button variant='primary' onClick={handleNewConversation} className='mb-4'>
        New Conversation
      </Button>

      {loading && <p>Loading...</p>}
      {error && <p className='text-red-500'>{error}</p>}

      <ul className='space-y-2'>
        {conversations.map(conv => (
          <li
            key={conv.id}
            className='p-3 bg-gray-800 rounded cursor-pointer hover:bg-gray-700'
            onClick={() => handleSelect(conv)}
          >
            <div className='font-semibold'>{conv.title || `Conversation ${conv.id}`}</div>
            {conv.created_at && (
              <div className='text-xs text-gray-400'>
                {new Date(conv.created_at).toLocaleString()}
              </div>
            )}
          </li>
        ))}
        {conversations.length === 0 && !loading && <p>No conversations yet.</p>}
      </ul>
    </div>
  )
}

export default Homepage
