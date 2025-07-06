import React, { useEffect, useId, useRef } from 'react'

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

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  placeholder = 'Type your message...',
  value = '',
  onChange,
  onKeyDown,
  state = 'default',
  errorMessage,
  maxLength = 2000,
  width = 'max-w-3xl',
  className = '',
  minRows = 1,
  // maxRows = 10,
  autoFocus = false,
  showCharCount = false,
  ...rest
}) => {
  const id = useId()
  const errorId = `${id}-error`
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (state !== 'disabled') {
      onChange?.(e.target.value)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(e)
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

      const scrollHeight = textarea.scrollHeight
      const newHeight = Math.max(scrollHeight, minHeight)

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

  const baseStyles = `${width} px-4 py-3 rounded-xl border transition-all duration-200 overflow-hidden`
  const labelClasses = state === 'disabled' ? 'opacity-40' : ''

  const stateStyles = {
    default: `${baseStyles} bg-gray-800 text-gray-100 placeholder-gray-400 border-gray-600 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50`,
    error: `${baseStyles} bg-gray-800 text-gray-100 placeholder-gray-400 border-red-500 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500 focus:ring-opacity-50`,
    disabled: `${baseStyles} bg-gray-900 text-gray-500 border-gray-700 placeholder-gray-600 cursor-not-allowed`,
  }

  return (
    <div className='flex flex-col gap-1'>
      {label && (
        <label htmlFor={id} className={`text-sm font-medium text-gray-200 ${labelClasses}`}>
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
          disabled={state === 'disabled'}
          maxLength={maxLength}
          className={`${stateStyles[state]} ${className}`}
          aria-invalid={state === 'error'}
          aria-describedby={state === 'error' && errorMessage ? errorId : undefined}
          autoFocus={autoFocus}
          style={{
            minHeight: `${minRows * 24 + 16}px`,
          }}
          {...rest}
        />

        {/* Character count indicator */}
        {showCharCount && maxLength && (
          <div className='absolute bottom-2 right-3 text-xs text-gray-500'>
            {value.length}/{maxLength}
          </div>
        )}
      </div>

      {state === 'error' && errorMessage && (
        <span id={errorId} className='text-sm text-red-400 mt-1'>
          {errorMessage}
        </span>
      )}
    </div>
  )
}
