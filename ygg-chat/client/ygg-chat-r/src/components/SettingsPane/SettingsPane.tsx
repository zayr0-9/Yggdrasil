import { useQueryClient } from '@tanstack/react-query'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { selectCurrentConversationId } from '../../features/chats'
import { updateContext, updateSystemPrompt } from '../../features/conversations'
import type { Conversation } from '../../features/conversations/conversationTypes'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { useConversationsByProject } from '../../hooks/useQueries'
import { InputTextArea } from '../InputTextArea/InputTextArea'
import { ToolsSettings } from './ToolsSettings'

type SettingsPaneProps = {
  open: boolean
  onClose: () => void
  projectId?: string | null
}

export const SettingsPane: React.FC<SettingsPaneProps> = ({ open, onClose, projectId }) => {
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()
  const conversationId = useAppSelector(selectCurrentConversationId)
  const tools = useAppSelector(state => state.chat.tools ?? [])

  // Fetch conversations from React Query to get conversation-specific data
  // Use projectId prop to ensure we query the correct cache
  const { data: projectConversations = [] } = useConversationsByProject(projectId || null)
  const currentConversation = projectConversations.find(c => c.id === conversationId)

  // Log cache data for debugging
  useEffect(() => {}, [projectId, conversationId, projectConversations, currentConversation])

  // Local state for system prompt and context (not global Redux state)
  const [localSystemPrompt, setLocalSystemPrompt] = useState('')
  const [localContext, setLocalContext] = useState('')

  // Track initial values when modal opens to detect changes
  const initialSystemPromptRef = useRef<string | null>(null)
  const initialContextRef = useRef<string | null>(null)

  // Track if we've loaded data for the current modal session
  const hasLoadedForCurrentSessionRef = useRef(false)

  const handleChange = useCallback((value: string) => {
    // Update local state for instant UI feedback
    setLocalSystemPrompt(value)
  }, [])

  const handleContextChange = useCallback((value: string) => {
    // Update local state for instant UI feedback
    setLocalContext(value)
  }, [])

  // Load from cache when modal opens (only once per session)
  useEffect(() => {
    if (open && currentConversation && !hasLoadedForCurrentSessionRef.current) {
      const systemPromptFromCache = currentConversation.system_prompt ?? ''
      const contextFromCache = currentConversation.conversation_context ?? ''

      // Set local state from cache
      setLocalSystemPrompt(systemPromptFromCache)
      setLocalContext(contextFromCache)

      // Capture these as initial values for change detection
      initialSystemPromptRef.current = systemPromptFromCache
      initialContextRef.current = contextFromCache

      // Mark that we've loaded for this session
      hasLoadedForCurrentSessionRef.current = true
    }

    // Reset the flag when modal closes
    if (!open) {
      hasLoadedForCurrentSessionRef.current = false
    }
  }, [open, currentConversation])

  // Save changes when modal closes
  useEffect(() => {
    if (!open) {
      // When modal closes, save changes if values have changed
      if (!conversationId) return

      const currentSystemPrompt = localSystemPrompt.trim() === '' ? null : localSystemPrompt
      const currentContext = localContext.trim() === '' ? null : localContext
      const initialSystemPrompt = initialSystemPromptRef.current?.trim() === '' ? null : initialSystemPromptRef.current
      const initialContext = initialContextRef.current?.trim() === '' ? null : initialContextRef.current

      const systemPromptChanged = currentSystemPrompt !== initialSystemPrompt
      const contextChanged = currentContext !== initialContext

      // Use projectId prop for cache updates
      const projectIdForCache = projectId

      // Helper function to update conversation in cached array
      const updateSystemPromptInCache = (conversations: Conversation[] | undefined) => {
        if (!conversations) return conversations
        return conversations.map(conv =>
          conv.id === conversationId ? { ...conv, system_prompt: currentSystemPrompt } : conv
        )
      }

      const updateContextInCache = (conversations: Conversation[] | undefined) => {
        if (!conversations) return conversations
        return conversations.map(conv =>
          conv.id === conversationId ? { ...conv, conversation_context: currentContext } : conv
        )
      }

      // Save system prompt if changed
      if (systemPromptChanged) {
        dispatch(updateSystemPrompt({ id: conversationId, systemPrompt: currentSystemPrompt }))
          .unwrap()
          .then(() => {
            // Update all conversations cache
            queryClient.setQueryData<Conversation[]>(['conversations'], updateSystemPromptInCache)

            // Update project-specific conversations cache if projectId exists
            if (projectIdForCache) {
              queryClient.setQueryData<Conversation[]>(
                ['conversations', 'project', projectIdForCache],
                updateSystemPromptInCache
              )
            }
          })
          .catch(error => {
            console.error('[SettingsPane] Failed to update system prompt:', error)
          })
      }

      // Save context if changed
      if (contextChanged) {
        dispatch(updateContext({ id: conversationId, context: currentContext }))
          .unwrap()
          .then(() => {
            // Update all conversations cache
            queryClient.setQueryData<Conversation[]>(['conversations'], updateContextInCache)

            // Update project-specific conversations cache if projectId exists
            if (projectIdForCache) {
              queryClient.setQueryData<Conversation[]>(
                ['conversations', 'project', projectIdForCache],
                updateContextInCache
              )
            }
          })
          .catch(error => {
            console.error('[SettingsPane] Failed to update context:', error)
          })
      }
    }
  }, [open, conversationId, localSystemPrompt, localContext, dispatch, queryClient, projectId])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className='fixed inset-0 z-40 flex items-center justify-center'>
      {/* Overlay */}
      <div
        className='fixed inset-0 bg-neutral-300/50 dark:bg-neutral-900/20 bg-opacity-50 backdrop-blur-sm'
        onClick={onClose}
      />

      {/* Modal */}
      <div className='py-2'>
        <div
          className={`relative z-50 w-full max-w-4xl rounded-3xl px-4 py-2 dark:border-1 dark:border-neutral-900 bg-neutral-100 dark:bg-yBlack-900 shadow-lg overflow-y-scroll no-scrollbar transition-all duration-300 ease-in-out ${
            tools.some(tool => tool.enabled) ? 'h-[80vh]' : 'h-[58vh]'
          }`}
          onClick={e => e.stopPropagation()}
          style={{ scrollbarGutter: 'stable' }}
        >
          <div className='flex justify-between items-center mb-3 py-4'>
            <h2 className='text-2xl font-semibold text-stone-800 dark:text-stone-200'>AI Settings</h2>
            <button onClick={onClose} className='p-1 rounded-md transition-colors' aria-label='Close settings'>
              <i className='bx bx-x text-2xl text-gray-600 dark:text-gray-400 active:scale-95'></i>
            </button>
          </div>

          <div className='space-y-6'>
            {/* System Prompt Section */}
            <div>
              <InputTextArea
                label='System prompt'
                placeholder='Enter a system prompt to guide the assistant...'
                value={localSystemPrompt}
                onChange={handleChange}
                minRows={10}
                maxRows={16}
                width='w-full'
                showCharCount
                outline={true}
                variant='outline'
                className='drop-shadow-xl shadow-[0_0px_12px_3px_rgba(0,0,0,0.05),0_0px_2px_0px_rgba(0,0,0,0.1)] dark:shadow-[0_0px_24px_2px_rgba(0,0,0,0.5),0_0px_2px_2px_rgba(0,0,0,0)]'
              />
            </div>

            {/* Context Section */}
            <div>
              <InputTextArea
                label='Context'
                placeholder='Enter a context to augment your chat...'
                value={localContext}
                onChange={handleContextChange}
                minRows={10}
                maxRows={16}
                width='w-full'
                showCharCount
                variant='outline'
                outline={true}
                className='drop-shadow-xl shadow-[0_0px_12px_3px_rgba(0,0,0,0.05),0_0px_2px_0px_rgba(0,0,0,0.1)] dark:shadow-[0_0px_24px_2px_rgba(0,0,0,0.5),0_0px_2px_2px_rgba(0,0,0,0)]'
              />
            </div>

            {/* Tools Section */}
            <div>
              <ToolsSettings />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
