import React, { useEffect, useId, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { selectFocusedChatMessageId } from '../../features/chats/chatSelectors'
import { chatSliceActions } from '../../features/chats/chatSlice'
import type { RootState } from '../../store/store'

type textAreaState = 'default' | 'error' | 'disabled'
type textAreaWidth = 'w-1/6' | 'w-1/4' | 'w-1/2' | 'w-3/4' | 'w-3/5' | 'w-5/6' | 'w-full' | 'max-w-3xl'

interface TextAreaProps {
  label?: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  state?: textAreaState
  errorMessage?: string
  maxLength?: number
  width?: textAreaWidth
  className?: string
  minRows?: number
  maxRows?: number
  autoFocus?: boolean
  showCharCount?: boolean
}

export const InputTextArea: React.FC<TextAreaProps> = ({
  label,
  placeholder = 'Type your message...',
  value = '',
  onChange,
  onKeyDown,
  state = 'default',
  errorMessage,
  maxLength = 1000000,
  width = 'max-w-3xl',
  className = '',
  minRows = 1,
  maxRows = 10,
  autoFocus = false,
  showCharCount = false,
  ...rest
}) => {
  const dispatch = useDispatch()
  const focusedMessageId = useSelector(selectFocusedChatMessageId)
  const imageDrafts = useSelector((s: RootState) => s.chat.composition.imageDrafts)
  const editingBranch = useSelector((s: RootState) => s.chat.composition.editingBranch)
  const id = useId()
  const errorId = `${id}-error`
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (state !== 'disabled') {
      onChange?.(e.target.value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e)
  }

  const handleDragEnter = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (state !== 'disabled') setDragOver(true)
  }

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (state !== 'disabled') setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (state === 'disabled') return

    const files = Array.from(e.dataTransfer?.files || [])
    const images = files.filter(f => f.type.startsWith('image/'))
    if (images.length === 0) return

    Promise.all(
      images.map(async image => ({
        dataUrl: await fileToDataUrl(image),
        name: image.name,
        type: image.type,
        size: image.size,
      }))
    )
      .then(drafts => {
        dispatch(chatSliceActions.imageDraftsAppended(drafts))
        if (focusedMessageId != null) {
          dispatch(
            chatSliceActions.messageArtifactsAppended({
              messageId: focusedMessageId,
              artifacts: drafts.map(d => d.dataUrl),
            })
          )
        }
      })
      .catch(err => console.error('Failed to read dropped images', err))
  }

  // Auto-resize functionality
  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto'

      // Calculate the number of lines
      const lineHeight = 24 // Approximate line height in pixels
      const minHeight = minRows * lineHeight + 16 // 16px for padding
      const maxHeight = maxRows ? maxRows * lineHeight + 16 : undefined

      const scrollHeight = textarea.scrollHeight
      let newHeight = Math.max(scrollHeight, minHeight)

      if (maxHeight && newHeight > maxHeight) {
        newHeight = maxHeight
        textarea.style.overflowY = 'auto'
      } else {
        textarea.style.overflowY = 'hidden'
      }

      textarea.style.height = `${newHeight}px`
    }
  }

  // Adjust height when value changes
  useEffect(() => {
    adjustHeight()
  }, [value])

  // Adjust height on mount
  useEffect(() => {
    adjustHeight()
  }, [])

  // Programmatic focus when autoFocus toggles to true (e.g., after streaming finishes)
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  const baseStyles = `${width} px-4 py-3 rounded-xl transition-all duration-200 overflow-hidden bg-neutral-50 dark:bg-neutral-900`
  const labelClasses = state === 'disabled' ? 'opacity-40' : ''

  const stateStyles = {
    default: `${baseStyles} bg-gray-800 text-stone-800 dark:text-stone-200 placeholder-neutral-700 dark:placeholder-neutral-200 border-gray-600 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50`,
    error: `${baseStyles} bg-gray-800 text-stone-800 dark:text-stone-200 placeholder-neutral-700 dark:placeholder-neutral-200 border-red-500 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500 focus:ring-opacity-50`,
    disabled: `${baseStyles} bg-gray-900 text-stone-800 dark:text-stone-200 border-gray-700 placeholder-neutral-700 dark:placeholder-neutral-200 cursor-not-allowed`,
  }

  return (
    <div className='flex flex-col gap-1'>
      {label && (
        <label htmlFor={id} className={`text-sm font-medium text-neutral-800 dark:text-neutral-200 ${labelClasses}`}>
          {label}
        </label>
      )}

      <div className='relative'>
        <textarea
          ref={textareaRef}
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={state === 'disabled'}
          // maxLength={maxLength}
          className={`${stateStyles[state]} ${dragOver ? 'border-blue-500 ring-2 ring-blue-500' : ''} ${className}`}
          aria-invalid={state === 'error'}
          aria-describedby={state === 'error' && errorMessage ? errorId : undefined}
          autoFocus={autoFocus}
          style={{
            minHeight: `${minRows * 24 + 16}px`,
          }}
          {...rest}
        />

        {/* Character count indicator */}
        {showCharCount && (
          <div className='absolute bottom-2 right-3 text-xs text-stone-800 dark:text-stone-200'>
            {/* {value.length}/{maxLength} */}
            {value.length}
          </div>
        )}
      </div>

      {/* Image draft previews (hidden while editing a branch) */}
      {!editingBranch && imageDrafts && imageDrafts.length > 0 && (
        <div className='mt-2 flex flex-wrap gap-2'>
          {imageDrafts.map((img, idx) => (
            <div
              key={idx}
              className='w-16 h-16 rounded-md overflow-hidden border border-gray-600 bg-neutral-800'
              title={img.name}
            >
              <img src={img.dataUrl} alt={img.name || `image-${idx}`} className='w-full h-full object-cover' />
            </div>
          ))}
        </div>
      )}

      {state === 'error' && errorMessage && (
        <span id={errorId} className='text-sm text-red-400 mt-1'>
          {errorMessage}
        </span>
      )}
    </div>
  )
}
