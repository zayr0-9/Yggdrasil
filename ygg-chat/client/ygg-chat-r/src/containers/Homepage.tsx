import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, TextField } from '../components'
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
import { searchActions, selectSearchResults, selectSearchQuery, selectSearchLoading as selectSearchLoading2 } from '../features/search'



const Homepage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const conversations = useAppSelector<Conversation[]>(selectAllConversations)
  const loading = useAppSelector(selectConvLoading)
  const searchLoading = useAppSelector(selectSearchLoading2)
  const error = useAppSelector(selectConvError)
  const searchResults = useAppSelector(selectSearchResults)
  const searchQuery = useAppSelector(selectSearchQuery)

  const [isDropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => {
    dispatch(fetchConversations())
  }, [dispatch])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const handleSelect = (conv: Conversation) => {
    dispatch(chatActions.conversationSet(conv.id))
    navigate(`/chat/${conv.id}`)
  }

  const handleNewConversation = async () => {
    const result = await dispatch(createConversation({})).unwrap()
    handleSelect(result)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      dispatch(searchActions.performSearch(searchQuery))
      setDropdownOpen(true)
    }
  }

  const handleSearchChange = (value: string) => {
    dispatch(searchActions.queryChanged(value))
  }

  const handleResultClick = (conversationId: number, messageId: string) => {
    dispatch(chatActions.conversationSet(conversationId))
    navigate(`/chat/${conversationId}#${messageId}`)
    setDropdownOpen(false)
  }

  return (
    <div className='p-6 max-w-3xl mx-auto'>
      <h1 className='text-2xl font-bold mb-4'>Conversations</h1>

      {/* Search Field */}
      <div className='mb-6 relative'>
        <TextField
          placeholder='Search messages...'
          value={searchQuery}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown as any}
        />

        {/* Dropdown */}
        {isDropdownOpen && (searchLoading ? (
          <div className='absolute z-10 left-0 right-0 bg-gray-800 p-4 text-sm'>Searching...</div>
        ) : (
          searchResults.length > 0 && (
            <ul
              ref={dropdownRef}
              className='absolute z-10 left-0 right-0 max-h-60 overflow-y-auto bg-gray-800 border border-gray-700 rounded shadow-lg'
            >
              {searchResults.map(res => (
                <li
                  key={`${res.conversationId}-${res.messageId}`}
                  className='p-3 hover:bg-gray-700 cursor-pointer text-sm'
                  onClick={() => handleResultClick(res.conversationId, res.messageId)}
                >
                  <div className='font-semibold'>Conv {res.conversationId}</div>
                  <div className='truncate'>{res.content}</div>
                </li>
              ))}
            </ul>
          )
        ))}
      </div>

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
