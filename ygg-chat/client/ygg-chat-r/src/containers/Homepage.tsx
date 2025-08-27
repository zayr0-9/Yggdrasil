import 'boxicons'
import 'boxicons/css/boxicons.min.css'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Project } from '../../../../shared/types'
import { Button, TextField } from '../components'
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

  const projects = useAppSelector<Project[]>(selectAllProjects)
  const loading = useAppSelector(selectProjectsLoading)
  const searchLoading = useAppSelector(selectSearchLoading)
  const searchResults = useAppSelector(selectSearchResults)
  const searchQuery = useAppSelector(selectSearchQuery)
  //   const error = useAppSelector(selectProjectsError)

  const [showEditModal, setShowEditModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isDropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLUListElement | null>(null)

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
      <div className='py-4 max-w-7xl mx-auto'>
        <div className='flex items-center justify-between py-4'>
          <div className='flex items-center gap-3'>
            {/* <img src='/img/op26cyb01.svg' alt='Yggdrasil Logo' className='w-20 h-20' /> */}
            <h1 className='text-4xl font-bold dark:text-neutral-100'>Yggdrasil</h1>
          </div>
          <Button variant='primary' size='small' onClick={() => navigate('/settings')}>
            <i className='bx bx-cog text-xl' aria-hidden='true'></i>
          </Button>
        </div>
      </div>
      <div className='py-2 px-4 max-w-6xl mx-auto'>
        <div className='mb-4'>
          <h2 className='text-3xl py-4 font-bold dark:text-neutral-100'>Projects</h2>
        </div>

        {/* New Project Button + Search */}
        <div className='mb-6 flex items-center gap-3'>
          <Button variant='primary' size='medium' onClick={handleCreateProject} className='shrink-0'>
            New Project
          </Button>
        </div>

        {loading && <p>Loading...</p>}
        {/* {error && <p className='text-red-500'>{error}</p>} */}

        <div className='flex gap-4 items-start'>
          <ul className='space-y-2 rounded flex-1'>
            {projects.map(project => (
              <li
                key={project.id}
                className='p-4 mb-4 bg-indigo-50 rounded-lg cursor-pointer dark:bg-zinc-700 hover:bg-indigo-100 dark:hover:bg-zinc-600'
                onClick={() => handleSelectProject(project)}
              >
                <div className='flex items-center justify-between'>
                  <div className='flex-1'>
                    <span className='font-semibold text-lg dark:text-neutral-100'>{project.name}</span>
                    {project.context && (
                      <p className='text-sm text-gray-600 ygg-line-clamp-6 dark:text-gray-300 mt-1'>
                        {project.context}
                      </p>
                    )}
                  </div>
                  <div className='flex gap-1'>
                    <Button
                      variant='secondary'
                      size='smaller'
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
                      size='smaller'
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
