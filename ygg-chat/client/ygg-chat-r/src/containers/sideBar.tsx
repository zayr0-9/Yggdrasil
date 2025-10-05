import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Project, ConversationId } from '../../../../shared/types'
import { Button } from '../components'
import { chatSliceActions } from '../features/chats'
import { activeConversationIdSet, fetchRecentConversations } from '../features/conversations'
import {
  selectRecentConversations,
  selectRecentError,
  selectRecentLoading,
} from '../features/conversations/conversationSelectors'
import { fetchProjects, selectAllProjects } from '../features/projects'
import { useAppDispatch, useAppSelector } from '../hooks/redux'

const SideBar: React.FC<{ limit?: number; className?: string }> = ({ limit = 8, className = '' }) => {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const recent = useAppSelector(selectRecentConversations)
  const loading = useAppSelector(selectRecentLoading)
  const error = useAppSelector(selectRecentError)
  const projects = useAppSelector<Project[]>(selectAllProjects)

  useEffect(() => {
    dispatch(fetchRecentConversations({ limit }))
  }, [dispatch, limit])

  // Projects are fetched by Homepage component and stored in Redux
  // No need to fetch again here since projects state is global

  const handleSelect = (id: ConversationId) => {
    dispatch(chatSliceActions.conversationSet(id))
    dispatch(activeConversationIdSet(id))
    navigate(`/chat/${id}`)
  }

  return (
    <aside className={`flex flex-col items-stretch gap-2 p-2 ${className}`} aria-label='Recent conversations'>
      {loading && <div className='text-sm text-gray-500 dark:text-gray-300 px-1 py-0.5'>Loading…</div>}
      {error && (
        <div className='text-xs text-red-600 dark:text-red-400 px-1 py-0.5' role='alert'>
          {error}
        </div>
      )}
      {recent.map(conv => (
        <div key={conv.id} className='relative'>
          <Button
            variant='secondary'
            size='extraLarge'
            rounded='full'
            onClick={() => handleSelect(conv.id)}
            className='group relative h-14 w-14 overflow-visible p-1 shadow-sm'
          >
            {/* Avatar circle */}
            <span className='absolute inset-0 flex items-center justify-center'>
              <span className='flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500 dark:bg-yPink-300 text-white text-base font-semibold'>
                {conv.title ? conv.title.charAt(0).toUpperCase() : '#'}
              </span>
            </span>
            {/* Expanding label overlay (only this item) */}
            <span className='pointer-events-none absolute left-16 top-1/2 -translate-y-1/2 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 whitespace-nowrap rounded-lg bg-indigo-100 dark:bg-secondary-600 px-3 py-1.5 text-sm text-neutral-900 dark:text-neutral-100 shadow-lg transition-all duration-300 ease-in-out overflow-hidden max-w-0 group-hover:max-w-[500px]'>
              <span className='flex flex-col'>
                <span className='font-medium'>{conv.title || `Conversation ${conv.id}`}</span>
                {(() => {
                  const pid = conv.project_id ?? undefined
                  const pname = pid ? projects.find(p => p.id === pid)?.name : undefined
                  return pname ? <span className='text-sm text-left opacity-80'>Project: {pname}</span> : null
                })()}
              </span>
            </span>
          </Button>
        </div>
      ))}
    </aside>
  )
}

export default SideBar
