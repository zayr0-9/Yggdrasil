import 'boxicons'
import 'boxicons/css/boxicons.min.css'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, TextField } from '../components'
import { Select } from '../components/Select/Select'
import { chatSliceActions } from '../features/chats'
import {
  activeConversationIdSet,
  Conversation,
  createConversation,
  deleteConversation,
  fetchConversations,
  fetchConversationsByProjectId,
  selectAllConversations,
  selectConvError,
  selectConvLoading,
} from '../features/conversations'
import { fetchProjectById, selectSelectedProject } from '../features/projects'
import {
  searchActions,
  selectSearchLoading as selectSearchLoading2,
  selectSearchQuery,
  selectSearchResults,
} from '../features/search'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import EditProject from './EditProject'

const ConversationPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId')

  const allConversations = useAppSelector<Conversation[]>(selectAllConversations)
  const selectedProject = useAppSelector(selectSelectedProject)
  const loading = useAppSelector(selectConvLoading)
  const searchLoading = useAppSelector(selectSearchLoading2)
  const error = useAppSelector(selectConvError)
  const searchResults = useAppSelector(selectSearchResults)
  const searchQuery = useAppSelector(selectSearchQuery)

  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name'>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const handleSearchClick = () => {
    if (searchQuery.trim()) {
      dispatch(searchActions.performSearch(searchQuery))
      setDropdownOpen(true)
    }
  }
  // Sorting function for conversations
  const sortConversations = (
    convs: Conversation[],
    sortBy: 'updated' | 'created' | 'name',
    invert: boolean = false
  ) => {
    const sorted = [...convs].sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          // Use updated_at if available, otherwise fall back to created_at
          const aDate = a.updated_at || a.created_at || ''
          const bDate = b.updated_at || b.created_at || ''
          if (!aDate) return 1
          if (!bDate) return -1
          return bDate.localeCompare(aDate)

        case 'created':
          if (!a.created_at) return 1
          if (!b.created_at) return -1
          return b.created_at.localeCompare(a.created_at)

        case 'name':
          const aTitle = a.title || `Conversation ${a.id}`
          const bTitle = b.title || `Conversation ${b.id}`
          return aTitle.localeCompare(bTitle)

        default:
          return 0
      }
    })

    return invert ? sorted.reverse() : sorted
  }

  // Use conversations directly from Redux state (already filtered by project ID if applicable)
  const conversations = sortConversations(allConversations, sortBy, sortOrder === 'asc')

  const [isDropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLUListElement | null>(null)

  useEffect(() => {
    dispatch(chatSliceActions.stateReset())

    // Fetch conversations by project ID if projectId is provided, otherwise fetch all
    if (projectId) {
      dispatch(fetchConversationsByProjectId(parseInt(projectId)))
      dispatch(fetchProjectById(parseInt(projectId)))
    } else {
      dispatch(fetchConversations())
    }

    dispatch(chatSliceActions.heimdallDataLoaded({ treeData: null }))
  }, [dispatch, projectId])

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
    // TODO: Link conversation to project when backend supports it
    const payload = selectedProject
      ? {
          title: `${selectedProject.name} Conversation`,
          // Add project_id when backend supports it
        }
      : {}
    const result = await dispatch(createConversation(payload)).unwrap()
    handleSelect(result)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      dispatch(searchActions.performProjectSearch({ query: searchQuery, projectId: selectedProject?.id }))
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

  const handleEditProject = () => {
    setShowEditProjectModal(true)
  }

  const handleCloseEditProjectModal = () => {
    setShowEditProjectModal(false)
  }

  return (
    <div className='bg-zinc-50 min-h-screen dark:bg-zinc-900'>
      <div className='px-2 pt-10 max-w-[1440px] mx-auto'>
        <div className='flex items-center justify-between mb-8'>
          <div className='flex items-center gap-2 pt-2 mb-2'>
            <Button variant='secondary' size='medium' onClick={() => navigate('/')} className='group'>
              <i
                className='bx bx-home text-2xl transition-transform duration-100 group-active:scale-90 pointer-events-none'
                aria-hidden='true'
              ></i>
            </Button>
            <h1 className='text-5xl py-4 px-2 font-bold dark:text-neutral-100'>
              {selectedProject ? `${selectedProject.name}` : 'Conversations'}
            </h1>
            {/* {selectedProject && (
                <Button variant='secondary' size='small' onClick={handleEditProject}>
                  <i className='bx bx-edit text-lg' aria-hidden='true'></i>
                </Button>
              )} */}
          </div>
          {/* {selectedProject?.context && (
              <p className='text-sm text-gray-600 ygg-line-clamp-6 dark:text-gray-300 ml-12'>
                {selectedProject.context}
              </p>
            )} */}
        </div>
      </div>
      <div className='p-6 max-w-7xl mx-auto'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-3xl py-4 font-bold dark:text-neutral-100'>Projects</h2>
          <div className='flex items-center gap-2 pt-2'>
            <Button variant='primary' size='medium' onClick={handleEditProject} className='group'>
              <p className='transition-transform duration-100 group-active:scale-95'>Project Settings</p>
            </Button>
          </div>
        </div>
        {/* New Conversation + Sort Controls + Search inline row */}
        <div className='mb-6 flex items-center gap-3'>
          <Button variant='primary' size='large' onClick={handleNewConversation} className='group'>
            <p className='transition-transform duration-100 group-active:scale-95'>New Conversation</p>
          </Button>

          <div className='flex items-center gap-2'>
            <span className='text-sm text-gray-600 dark:text-gray-300'>Sort by:</span>
            <Select
              value={sortBy}
              onChange={value => setSortBy(value as 'updated' | 'created' | 'name')}
              options={[
                { value: 'updated', label: 'Updated' },
                { value: 'created', label: 'Created' },
                { value: 'name', label: 'Name' },
              ]}
              className='w-32 transition-transform duration-70 active:scale-95'
            />
            <Button
              variant='secondary'
              size='medium'
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className='shrink-0 group'
            >
              <i
                className={`bx ${sortOrder === 'asc' ? 'bx-sort-up' : 'bx-sort-down'} text-lg transition-transform duration-100 group-active:scale-90 pointer-events-none`}
                aria-hidden='true'
              ></i>
            </Button>
          </div>
        </div>

        {loading && <p>Loading...</p>}
        {error && <p className='text-red-500'>{error}</p>}
        <div className='flex gap-4 items-start'>
          <ul className='space-y-2 rounded flex-2'>
            {conversations.map(conv => (
              <li
                key={conv.id}
                className='p-3 mb-4 bg-indigo-50 rounded-lg cursor-pointer dark:bg-secondary-700 hover:bg-indigo-100 dark:hover:bg-secondary-800 group'
                onClick={() => handleSelect(conv)}
              >
                <div className='flex items-center justify-between'>
                  <span className='font-semibold dark:text-neutral-100 transition-transform duration-100 group-active:scale-99'>
                    {conv.title || `Conversation ${conv.id}`}
                  </span>
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
                  <div className='text-xs text-neutral-900 dark:text-neutral-100 transition-transform duration-100 group-active:scale-99'>
                    {new Date(conv.created_at).toLocaleString()}
                  </div>
                )}
              </li>
            ))}
            {conversations.length === 0 && !loading && <p className='dark:text-neutral-300'>No conversations yet.</p>}
          </ul>
          <div className='relative flex-1'>
            <TextField
              placeholder='Search messages...'
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown as any}
              showSearchIcon
              onSearchClick={handleSearchClick}
            />

            {/* Dropdown */}
            {isDropdownOpen &&
              (searchLoading ? (
                <div className='absolute z-10 left-0 right-0 bg-indigo-50 p-4 text-sm'>Searching...</div>
              ) : (
                searchResults.length > 0 && (
                  <ul
                    ref={dropdownRef}
                    className='absolute z-10 left-0 right-0 max-h-230 overflow-y-auto bg-slate-50 border border-indigo-100 dark:border-secondary-600 rounded shadow-lg dark:bg-neutral-700 thin-scrollbar'
                    style={{ colorScheme: 'dark' }}
                  >
                    {searchResults.map(res => (
                      <li
                        key={`${res.conversationId}-${res.messageId}`}
                        className='p-3 hover:bg-indigo-100 dark:bg-secondary-700 dark:hover:bg-secondary-800 cursor-pointer text-sm dark:text-neutral-200'
                        onClick={() => handleResultClick(res.conversationId, res.messageId)}
                      >
                        <div className='font-semibold text-indigo-600 dark:text-yBrown-50'>
                          Conv {res.conversationId}
                        </div>
                        <div className='mt-1 text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words max-h-48 overflow-hidden'>
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

      <EditProject
        isOpen={showEditProjectModal}
        onClose={handleCloseEditProjectModal}
        editingProject={selectedProject}
      />
    </div>
  )
}

export default ConversationPage
