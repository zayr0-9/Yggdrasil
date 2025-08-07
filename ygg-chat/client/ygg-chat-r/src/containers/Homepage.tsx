import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, TextField } from '../components'
import { chatActions } from '../features/chats'
import {
  Conversation,
  createConversation,
  deleteConversation,
  fetchConversations,
  selectAllConversations,
  selectConvError,
  selectConvLoading,
} from '../features/conversations'
import { searchActions, selectSearchLoading as selectSearchLoading2, selectSearchQuery, selectSearchResults } from '../features/search'
import { useAppDispatch, useAppSelector } from '../hooks/redux'



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

  const handleDelete = (id: number) => {
    dispatch(deleteConversation({ id }))
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
    <div className='bg-zinc-50 min-h-screen dark:bg-zinc-900'><div className='p-6 max-w-3xl mx-auto'>
      <h1 className='text-2xl font-bold mb-4 dark:text-neutral-100'>Conversations</h1>

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
          <div className='absolute z-10 left-0 right-0 bg-purple-50 p-4 text-sm'>Searching...</div>
        ) : (
          searchResults.length > 0 && (
            <ul
              ref={dropdownRef}
className='absolute z-10 left-0 right-0 max-h-60 overflow-y-auto bg-purple-50 border border-purple-100 dark:border-neutral-600 rounded shadow-lg dark:bg-neutral-700 scrollbar-thin scrollbar-track-transparent  dark:scrollbar-track-neutral-800 scrollbar-thumb-purple-200 dark:scrollbar-thumb-neutral-500'
style={{ colorScheme: 'dark' }}
            >
              {searchResults.map(res => (
                <li
                  key={`${res.conversationId}-${res.messageId}`}
                  className='p-3 hover:bg-purple-100 dark:bg-neutral-700 dark:hover:bg-neutral-500 cursor-pointer text-sm dark:text-neutral-200'
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

      <ul className='space-y-2 rounded'>
        {conversations.map(conv => (
          <li
            key={conv.id}
            className='p-3 mb-4 bg-rose-100 rounded-lg cursor-pointer dark:bg-zinc-700 hover:bg-rose-50 dark:hover:bg-zinc-600'
            onClick={() => handleSelect(conv)}
          >
            <div className='flex items-center justify-between'>
              <span className='font-semibold dark:text-neutral-100'>{conv.title || `Conversation ${conv.id}`}</span>
              <Button
                variant='secondary'
                size='small'
                onClick={(e => {
                  (e as unknown as React.MouseEvent).stopPropagation()
                  handleDelete(conv.id)
                }) as unknown as () => void}
              >
                Delete
              </Button>
            </div>
            {conv.created_at && (
              <div className='text-xs text-neutral-900 dark:text-neutral-100'>
                {new Date(conv.created_at).toLocaleString()}
              </div>
            )}
          </li>
        ))}
        {conversations.length === 0 && !loading && <p>No conversations yet.</p>}
      </ul>
    </div></div>
  )
}

export default Homepage
