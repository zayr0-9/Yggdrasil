import 'boxicons'
import 'boxicons/css/boxicons.min.css'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Project } from '../../../../shared/types'
import { Button, TextField } from '../components'
import { Select } from '../components/Select/Select'
import { chatSliceActions } from '../features/chats'
import {
  deleteProject,
  fetchProjects,
  selectAllProjects,
  //   selectProjectsError,
  selectProjectsLoading,
} from '../features/projects'
import { searchActions, selectSearchLoading, selectSearchQuery, selectSearchResults } from '../features/search'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import EditProject from './EditProject'

const Homepage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const allProjects = useAppSelector<Project[]>(selectAllProjects)
  const loading = useAppSelector(selectProjectsLoading)
  const searchLoading = useAppSelector(selectSearchLoading)
  const searchResults = useAppSelector(selectSearchResults)
  const searchQuery = useAppSelector(selectSearchQuery)
  //   const error = useAppSelector(selectProjectsError)

  const [showEditModal, setShowEditModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isDropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLUListElement | null>(null)
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name'>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Sorting function for projects
  const sortProjects = (projects: Project[], sortBy: 'updated' | 'created' | 'name', invert: boolean = false) => {
    const sorted = [...projects].sort((a, b) => {
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
          return a.name.localeCompare(b.name)

        default:
          return 0
      }
    })

    return invert ? sorted.reverse() : sorted
  }

  const projects = sortProjects(allProjects, sortBy, sortOrder === 'asc')

  useEffect(() => {
    dispatch(chatSliceActions.stateReset())
    dispatch(fetchProjects())
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

  const handleSelectProject = (project: Project) => {
    navigate(`/conversationPage?projectId=${project.id}`)
  }

  const handleDeleteProject = (id: number) => {
    dispatch(deleteProject(id))
  }

  const handleCloseModal = () => {
    setShowEditModal(false)
    setEditingProject(null)
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project)
    setShowEditModal(true)
  }

  const handleCreateProject = () => {
    setEditingProject(null)
    setShowEditModal(true)
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
      <div className='py-4 max-w-screen-2xl mx-auto'>
        <div className='flex items-center justify-between py-4'>
          <div className='flex items-center gap-3'>
            <img src='/img/logo-d.svg' alt='Yggdrasil Logo' className='w-22 h-22 dark:hidden' />
            <img src='/img/logo-l.svg' alt='Yggdrasil Logo' className='w-22 h-22 hidden dark:block' />
            <h1 className='text-5xl font-bold px-2 dark:text-neutral-100'>Yggdrasil</h1>
          </div>
          <Button variant='primary' size='smaller' onClick={() => navigate('/settings')} rounded='full'>
            <i className='bx bx-cog text-3xl p-1' aria-hidden='true'></i>
          </Button>
        </div>
      </div>
      <div className='py-6 px-6 max-w-7xl mx-auto'>
        <div className='mb-4'>
          <h2 className='text-3xl py-4 font-bold dark:text-neutral-100'>Projects</h2>
        </div>

        {/* New Project Button + Sort Controls + Search */}
        <div className='mb-6 flex items-center gap-3'>
          <Button variant='primary' size='large' onClick={handleCreateProject} className='shrink-0'>
            New Project
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
              className='w-32'
            />
            <Button
              variant='secondary'
              size='smaller'
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className='shrink-0'
            >
              <i className={`bx ${sortOrder === 'asc' ? 'bx-sort-up' : 'bx-sort-down'} text-lg`} aria-hidden='true'></i>
            </Button>
          </div>
        </div>

        {loading && <p>Loading...</p>}
        {/* {error && <p className='text-red-500'>{error}</p>} */}

        <div className='flex gap-4 items-start'>
          <ul className='space-y-2 rounded flex-1'>
            {projects.map(project => (
              <li
                key={project.id}
                className='p-4 mb-4 bg-indigo-50 rounded-lg cursor-pointer border-1 border-indigo-100 dark:bg-zinc-700 hover:bg-indigo-100 dark:hover:bg-zinc-600'
                onClick={() => handleSelectProject(project)}
              >
                <div className='flex place-items-start justify-between'>
                  <div className='flex-1'>
                    <span className='font-semibold text-xl dark:text-neutral-100'>{project.name}</span>
                    {project.context && (
                      <p className='text-sm text-gray-600 ygg-line-clamp-6 dark:text-gray-300 mt-2 mr-2'>
                        {project.context}
                      </p>
                    )}
                  </div>
                  <div className='flex gap-2'>
                    <Button
                      variant='secondary'
                      size='small'
                      onClick={
                        (e => {
                          ;(e as unknown as React.MouseEvent).stopPropagation()
                          handleEditProject(project)
                        }) as unknown as () => void
                      }
                    >
                      <i className='bx bx-edit text-lg' aria-hidden='true'></i>
                    </Button>
                    <Button
                      variant='secondary'
                      size='small'
                      onClick={
                        (e => {
                          ;(e as unknown as React.MouseEvent).stopPropagation()
                          handleDeleteProject(project.id)
                        }) as unknown as () => void
                      }
                    >
                      <i className='bx bx-trash-alt text-lg' aria-hidden='true'></i>
                    </Button>
                  </div>
                </div>
                {project.created_at && (
                  <div className='text-xs text-neutral-600 dark:text-neutral-400 mt-2'>
                    Created: {new Date(project.created_at).toLocaleString()}
                  </div>
                )}
              </li>
            ))}
            {projects.length === 0 && !loading && (
              <p className='dark:text-neutral-300'>No projects yet. Create your first project to get started!</p>
            )}
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

      <EditProject isOpen={showEditModal} onClose={handleCloseModal} editingProject={editingProject} />
    </div>
  )
}

export default Homepage
