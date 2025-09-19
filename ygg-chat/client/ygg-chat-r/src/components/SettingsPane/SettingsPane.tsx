import React, { useCallback, useEffect, useRef } from 'react'
import { selectCurrentConversationId } from '../../features/chats'
import { convContextSet, systemPromptSet, updateContext, updateSystemPrompt } from '../../features/conversations'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { InputTextArea } from '../InputTextArea/InputTextArea'
import { ToolsSettings } from './ToolsSettings'

type SettingsPaneProps = {
  open: boolean
  onClose: () => void
}

export const SettingsPane: React.FC<SettingsPaneProps> = ({ open, onClose }) => {
  const dispatch = useAppDispatch()
  const systemPrompt = useAppSelector(state => state.conversations.systemPrompt ?? '')
  const context = useAppSelector(state => state.conversations.convContext ?? '')
  const conversationId = useAppSelector(selectCurrentConversationId)
  const tools = useAppSelector(state => state.chat.tools ?? [])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback(
    (value: string) => {
      dispatch(systemPromptSet(value))
      if (!conversationId) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const persisted = value.trim() === '' ? null : value
      debounceRef.current = setTimeout(() => {
        dispatch(updateSystemPrompt({ id: conversationId, systemPrompt: persisted }))
      }, 500)
    },
    [dispatch, conversationId]
  )

  const handleContextChange = useCallback(
    (value: string) => {
      dispatch(convContextSet(value))
      if (!conversationId) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const persisted = value.trim() === '' ? null : value
      debounceRef.current = setTimeout(() => {
        dispatch(updateContext({ id: conversationId, context: persisted }))
      }, 500)
    },
    [dispatch, conversationId]
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Cleanup debounce on unmount/close
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Cancel any pending debounce when conversation changes to avoid patching old conversation
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [conversationId])

  if (!open) return null

  return (
    <div className='fixed inset-0 z-40 flex items-center justify-center'>
      {/* Overlay */}
      <div className='fixed inset-0 bg-black/50' onClick={onClose} />

      {/* Modal */}
      <div
        className={`relative z-50 w-full max-w-4xl rounded-lg p-4 bg-neutral-100 dark:bg-neutral-900 shadow-lg overflow-y-scroll thin-scrollbar transition-all duration-300 ease-in-out ${
          tools.some(tool => tool.enabled) ? 'h-[60vh]' : 'h-[45vh]'
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
              value={systemPrompt}
              onChange={handleChange}
              minRows={6}
              maxRows={16}
              width='w-full'
              showCharCount
              outline={true}
            />
          </div>

          {/* Context Section */}
          <div>
            <InputTextArea
              label='Context'
              placeholder='Enter a context to augment your chat...'
              value={context}
              onChange={handleContextChange}
              minRows={6}
              maxRows={16}
              width='w-full'
              showCharCount
              outline={true}
            />
          </div>

          {/* Tools Section */}
          <div>
            <ToolsSettings />
          </div>
        </div>
      </div>
    </div>
  )
}
