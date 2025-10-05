import 'boxicons'
import 'boxicons/css/boxicons.min.css'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Project, ProjectId } from '../../../../shared/types'
import { Button } from '../components'
import SearchList from '../components/SearchList/SearchList'
import { Select } from '../components/Select/Select'
import { chatSliceActions } from '../features/chats'
import { fetchConversations, selectConversationsByProject } from '../features/conversations'
import {
  deleteProject,
  fetchProjects,
  selectAllProjects,
  //   selectProjectsError,
  selectProjectsLoading,
} from '../features/projects'
import { searchActions, selectSearchLoading, selectSearchQuery, selectSearchResults } from '../features/search'
import { useAppDispatch, useAppSelector } from '../hooks/redux'
import { supabase } from '../lib/supabase'
import EditProject from './EditProject'
import SideBar from './sideBar'

const Homepage: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const allProjects = useAppSelector<Project[]>(selectAllProjects)
  const loading = useAppSelector(selectProjectsLoading)
  const searchLoading = useAppSelector(selectSearchLoading)
  const searchResults = useAppSelector(selectSearchResults)
  const searchQuery = useAppSelector(selectSearchQuery)
  const conversationsByProject = useAppSelector(selectConversationsByProject)
  //   const error = useAppSelector(selectProjectsError)

  const [showEditModal, setShowEditModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  // Search dropdown is handled inside SearchList component
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'name'>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window === 'undefined') return 'light'
    const saved = localStorage.getItem('theme')
    return saved === 'dark' ? 'dark' : saved === 'light' ? 'light' : 'system'
  })

  // Sorting function for projects
  const sortProjects = (projects: Project[], sortBy: 'updated' | 'created' | 'name', invert: boolean = false) => {
    const sorted = [...projects].sort((a, b) => {
      switch (sortBy) {
        case 'updated':
          // Use latest conversation time if available, otherwise fall back to project updated_at or created_at
          const aConvData = conversationsByProject.get(a.id)
          const bConvData = conversationsByProject.get(b.id)

          const aDate = aConvData?.latestConversation || a.updated_at || a.created_at || ''
          const bDate = bConvData?.latestConversation || b.updated_at || b.created_at || ''

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
    dispatch(fetchConversations())
    dispatch(chatSliceActions.heimdallDataLoaded({ treeData: null }))

    // Context is now requested automatically on WebSocket connection
  }, [dispatch])

  // Apply theme immediately when user toggles preference; global manager in main.tsx
  // handles system theme changes and cross-page updates.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const isDark = themeMode === 'dark' || (themeMode === 'system' && media.matches)
    document.documentElement.classList.toggle('dark', isDark)
  }, [themeMode])

  // Persist preference: remove key for system, set explicit for light/dark
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (themeMode === 'system') {
      localStorage.removeItem('theme')
    } else {
      localStorage.setItem('theme', themeMode)
    }
  }, [themeMode])

  const cycleTheme = () => {
    setThemeMode(prev => (prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'))
  }

  // Dropdown open/close is managed internally by SearchList

  const handleSelectProject = (project: Project) => {
    navigate(`/conversationPage?projectId=${project.id}`)
  }

  const handleDeleteProject = (id: ProjectId) => {
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

  const handleSearchChange = (value: string) => {
    dispatch(searchActions.queryChanged(value))
  }

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      dispatch(searchActions.performSearch(searchQuery))
    }
  }

  const handleResultClick = (conversationId: number, messageId: string) => {
    dispatch(chatSliceActions.conversationSet(conversationId))
    navigate(`/chat/${conversationId}#${messageId}`)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    // The ProtectedRoute component will automatically redirect to /login
  }

  return (
    <div className='bg-zinc-50 min-h-screen dark:bg-yBlack-500 flex flex-col'>
      {/* Recent conversations sidebar - fixed; page content padded to avoid overlap */}
      <div className='flex fixed left-2 top-89 items-start'>
        <SideBar limit={8} />
      </div>
      <div className='pl-20 md:pl-24'>
        <div className='py-4 max-w-[1640px] mx-auto'>
          <div className='flex items-center justify-baseline px-2 py-10'>
            <div className='flex items-center flex-wrap gap-3'>
              <img src='/img/logo-d.svg' alt='Yggdrasil Logo' className='w-22 h-22 dark:hidden' />
              <img src='/img/logo-l.svg' alt='Yggdrasil Logo' className='w-22 h-22 hidden dark:block' />
              <h1 className='text-5xl font-bold px-2 dark:text-neutral-100'>Yggdrasil</h1>
            </div>
          </div>
        </div>
        <div className='py-6 px-6 max-w-7xl mx-auto'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='text-3xl py-4 font-bold dark:text-neutral-100'>Projects</h2>
            <div className='flex items-center gap-2 pt-2'>
              <Button
                variant='secondary'
                size='smaller'
                onClick={cycleTheme}
                rounded='full'
                title={`Theme: ${themeMode} (click to change)`}
                aria-label={`Theme: ${themeMode}`}
                className='group'
              >
                <i
                  className={`bx ${themeMode === 'system' ? 'bx-desktop' : themeMode === 'dark' ? 'bx-moon' : 'bx-sun'} text-3xl p-1 transition-transform duration-100 group-active:scale-90 pointer-events-none`}
                  aria-hidden='true'
                ></i>
              </Button>
              <Button
                variant='secondary'
                size='smaller'
                onClick={handleLogout}
                rounded='full'
                title='Logout'
                aria-label='Logout'
                className='group'
              >
                <i
                  className='bx bx-log-out text-3xl p-1 transition-transform duration-100 group-active:scale-90 pointer-events-none'
                  aria-hidden='true'
                ></i>
              </Button>
              <Button
                variant='primary'
                size='smaller'
                onClick={() => navigate('/settings')}
                className='group'
                rounded='full'
              >
                <i
                  className='bx bx-cog text-3xl p-1 transition-transform duration-100 group-active:scale-90 pointer-events-none'
                  aria-hidden='true'
                ></i>
              </Button>
            </div>
          </div>

          {/* New Project Button + Sort Controls + Search */}
          <div className='mb-6 flex flex-wrap items-center gap-3'>
            <Button variant='primary' size='large' onClick={handleCreateProject} className='shrink-0 group'>
              <p className='transition-transform duration-100 group-active:scale-95'>New Project</p>
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
          {/* {error && <p className='text-red-500'>{error}</p>} */}

          <div className='flex gap-4 flex-wrap items-start'>
            <ul className='space-y-2 rounded flex-3'>
              {projects.map(project => (
                <li
                  key={project.id}
                  className='p-4 mb-4 bg-indigo-50 rounded-lg cursor-pointer  border-indigo-100 dark:border-neutral-600 dark:bg-secondary-700 hover:bg-indigo-100 dark:hover:border-neutral-500 dark:hover:bg-secondary-800 group'
                  onClick={() => handleSelectProject(project)}
                >
                  <div className='flex place-items-start justify-between'>
                    <div className='flex-1'>
                      <span className='font-semibold text-xl dark:text-neutral-100 transition-transform duration-100 group-active:scale-99'>
                        <p className='transition-transform duration-100 group-active:scale-99'>{project.name}</p>
                      </span>
                      {project.context && (
                        <p className='text-sm text-gray-600 ygg-line-clamp-6 dark:text-gray-300 mt-2 mr-2 transition-transform duration-100 group-active:scale-99'>
                          {project.context}
                        </p>
                      )}
                    </div>
                    <div className='flex gap-2'>
                      <Button
                        variant='secondary'
                        size='small'
                        className='group'
                        onClick={
                          (e => {
                            ;(e as unknown as React.MouseEvent).stopPropagation()
                            handleEditProject(project)
                          }) as unknown as () => void
                        }
                      >
                        <i
                          className='bx bx-edit text-lg transition-transform duration-100 group-active:scale-90 pointer-events-none'
                          aria-hidden='true'
                        ></i>
                      </Button>
                      <Button
                        variant='secondary'
                        size='small'
                        className='group'
                        onClick={
                          (e => {
                            ;(e as unknown as React.MouseEvent).stopPropagation()
                            handleDeleteProject(project.id)
                          }) as unknown as () => void
                        }
                      >
                        <i
                          className='bx bx-trash-alt text-lg transition-transform duration-100 group-active:scale-90 pointer-events-none'
                          aria-hidden='true'
                        ></i>
                      </Button>
                    </div>
                  </div>
                  {project.created_at && (
                    <div className='text-xs text-neutral-600 dark:text-neutral-300 mt-2 transition-transform duration-100 group-active:scale-99'>
                      Created: {new Date(project.created_at).toLocaleString()}
                    </div>
                  )}
                </li>
              ))}
              {projects.length === 0 && !loading && (
                <p className='dark:text-neutral-300'>No projects yet. Create your first project to get started!</p>
              )}
            </ul>
            <div className='w-128 flex-2'>
              <SearchList
                value={searchQuery}
                onChange={handleSearchChange}
                onSubmit={handleSearchSubmit}
                results={searchResults}
                loading={searchLoading}
                onResultClick={handleResultClick}
                placeholder='Search messages...'
                dropdownVariant='neutral'
              />
            </div>
          </div>
        </div>
      </div>

      <EditProject isOpen={showEditModal} onClose={handleCloseModal} editingProject={editingProject} />
    </div>
  )
}

export default Homepage
