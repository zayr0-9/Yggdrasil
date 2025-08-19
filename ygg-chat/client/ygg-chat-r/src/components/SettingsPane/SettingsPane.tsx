import React, { useCallback, useEffect, useRef } from 'react'
import { chatSliceActions, selectCurrentConversationId, updateSystemPrompt } from '../../features/chats'
import { useAppDispatch, useAppSelector } from '../../hooks/redux'
import { Button } from '../Button/button'
import { InputTextArea } from '../InputTextArea/InputTextArea'

type SettingsPaneProps = {
  open: boolean
  onClose: () => void
}

export const SettingsPane: React.FC<SettingsPaneProps> = ({ open, onClose }) => {
  const dispatch = useAppDispatch()
  const systemPrompt = useAppSelector(state => state.chat.systemPrompt ?? '')
  const conversationId = useAppSelector(selectCurrentConversationId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback(
    (value: string) => {
      dispatch(chatSliceActions.systemPromptSet(value))
      if (!conversationId) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const persisted = value.trim() === '' ? null : value
      debounceRef.current = setTimeout(() => {
        dispatch(updateSystemPrompt({ id: conversationId, systemPrompt: persisted }))
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
        className='relative z-50 w-full max-w-2xl rounded-lg p-4 bg-neutral-100 dark:bg-neutral-800 shadow-lg'
        onClick={e => e.stopPropagation()}
      >
        <h2 className='text-lg font-semibold text-stone-800 dark:text-stone-200 mb-3'>AI Settings</h2>

        <InputTextArea
          label='System prompt'
          placeholder='Enter a system prompt to guide the assistant...'
          value={systemPrompt}
          onChange={handleChange}
          minRows={6}
          maxRows={16}
          width='w-full'
          showCharCount
        />

        <div className='mt-4 flex justify-end'>
          <Button variant='secondary' size='small' onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
