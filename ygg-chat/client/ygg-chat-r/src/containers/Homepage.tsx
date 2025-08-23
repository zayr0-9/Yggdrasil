import 'boxicons'
import 'boxicons/css/boxicons.min.css'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, TextField } from '../components'
import { chatSliceActions } from '../features/chats'
import {
  activeConversationIdSet,
  Conversation,
  createConversation,
  deleteConversation,
  fetchConversations,
  selectAllConversations,
  selectConvError,
  selectConvLoading,
} from '../features/conversations'
import {
  searchActions,
  selectSearchLoading as selectSearchLoading2,
  selectSearchQuery,
  selectSearchResults,
} from '../features/search'
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
    dispatch(chatSliceActions.stateReset())
    dispatch(fetchConversations())
    dispatch(chatSliceActions.heimdallDataLoaded({ treeData: null }))
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
    dispatch(chatSliceActions.conversationSet(conv.id))
    navigate(`/chat/${conv.id}`)
    dispatch(activeConversationIdSet(conv.id))
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
    dispatch(chatSliceActions.conversationSet(conversationId))
    navigate(`/chat/${conversationId}#${messageId}`)
    setDropdownOpen(false)
  }

  return (
    <div className='bg-zinc-50 min-h-screen dark:bg-zinc-900'>
      <div className='p-6 max-w-6xl mx-auto'>
        <div className='flex items-center justify-between mb-4'>
          <h1 className='text-2xl font-bold dark:text-neutral-100'>Conversations</h1>
          <Button variant='primary' size='small' onClick={() => navigate('/settings')}>
            Settings
          </Button>
        </div>

        {/* New Conversation + Search inline row */}
        <div className='mb-6 flex items-center gap-3'>
          <Button variant='primary' onClick={handleNewConversation} className='shrink-0'>
            New Conversation
          </Button>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p className='text-red-500'>{error}</p>}
        <div className='flex gap-4 items-start'>
          <ul className='space-y-2 rounded flex-1'>
            {conversations.map(conv => (
              <li
                key={conv.id}
                className='p-3 mb-4 bg-indigo-50 rounded-lg cursor-pointer dark:bg-zinc-700 hover:bg-indigo-100 dark:hover:bg-zinc-600'
                onClick={() => handleSelect(conv)}
              >
                <div className='flex items-center justify-between'>
                  <span className='font-semibold dark:text-neutral-100'>{conv.title || `Conversation ${conv.id}`}</span>
                  <Button
                    variant='secondary'
                    size='smaller'
                    onClick={
                      (e => {
                        ;(e as unknown as React.MouseEvent).stopPropagation()
                        handleDelete(conv.id)
                      }) as unknown as () => void
                    }
                  >
                    <i className='bx bx-trash-alt text-lg' aria-hidden='true'></i>
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
          <div className='relative w-128'>
            <TextField
              placeholder='Search messages...'
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown as any}
            />

            {/* Dropdown */}
            {isDropdownOpen &&
              (searchLoading ? (
                <div className='absolute z-10 left-0 right-0 bg-indigo-50 p-4 text-sm'>Searching...</div>
              ) : (
                searchResults.length > 0 && (
                  <ul
                    ref={dropdownRef}
                    className='absolute z-10 left-0 right-0 max-h-230 overflow-y-auto bg-slate-50 border border-indigo-100 dark:border-neutral-600 rounded shadow-lg dark:bg-neutral-700 thin-scrollbar'
                    style={{ colorScheme: 'dark' }}
                  >
                    {searchResults.map(res => (
                      <li
                        key={`${res.conversationId}-${res.messageId}`}
                        className='p-3 hover:bg-indigo-100 dark:bg-neutral-700 dark:hover:bg-neutral-500 cursor-pointer text-sm dark:text-neutral-200'
                        onClick={() => handleResultClick(res.conversationId, res.messageId)}
                      >
                        <div className='font-semibold text-indigo-600 dark:text-indigo-400'>
                          Conv {res.conversationId}
                        </div>
                        <div className='mt-1 text-neutral-800 dark:text-neutral-100 whitespace-pre-wrap break-words max-h-48 overflow-hidden'>
                          {res.content}
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Homepage
