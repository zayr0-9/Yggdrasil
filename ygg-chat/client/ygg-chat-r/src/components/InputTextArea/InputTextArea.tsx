import React, { useEffect, useId, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { selectFocusedChatMessageId } from '../../features/chats/chatSelectors'
import { chatSliceActions } from '../../features/chats/chatSlice'
import { selectMentionableFiles } from '../../features/ideContext/ideContextSelectors'
import { useIdeContext } from '../../hooks/useIdeContext'
import type { RootState } from '../../store/store'

type textAreaState = 'default' | 'error' | 'disabled'
type textAreaWidth = 'w-1/6' | 'w-1/4' | 'w-1/2' | 'w-3/4' | 'w-3/5' | 'w-5/6' | 'w-full' | 'max-w-3xl'

interface TextAreaProps {
  label?: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onBlur?: () => void
  state?: textAreaState
  errorMessage?: string
  maxLength?: number
  width?: textAreaWidth
  className?: string
  minRows?: number
  maxRows?: number
  autoFocus?: boolean
  showCharCount?: boolean
  onProcessMessage?: (processMessage: (message: string) => string) => void
}

export const InputTextArea: React.FC<TextAreaProps> = ({
  label,
  placeholder = 'Type your message...',
  value = '',
  onChange,
  onKeyDown,
  onBlur,
  state = 'default',
  errorMessage,
  maxLength = 1000000,
  width = 'max-w-3xl',
  className = '',
  minRows = 1,
  maxRows = 10,
  autoFocus = false,
  showCharCount = false,
  onProcessMessage,
  ...rest
}) => {
  const dispatch = useDispatch()
  const focusedMessageId = useSelector(selectFocusedChatMessageId)
  const imageDrafts = useSelector((s: RootState) => s.chat.composition.imageDrafts)
  const editingBranch = useSelector((s: RootState) => s.chat.composition.editingBranch)
  const mentionableFiles = useSelector(selectMentionableFiles)
  // Local copy of mentionable files to prevent re-selecting the same file locally
  const [localMentionableFiles, setLocalMentionableFiles] = useState(mentionableFiles)
  // Merge in new files from the selector while preserving local removals
  useEffect(() => {
    setLocalMentionableFiles(prev => {
      if (prev.length === 0 && mentionableFiles.length > 0) return mentionableFiles
      const prevPaths = new Set(prev.map(f => f.path))
      const additions = mentionableFiles.filter(f => !prevPaths.has(f.path))
      return additions.length > 0 ? [...prev, ...additions] : prev
    })
  }, [mentionableFiles])
  const { requestFileContent } = useIdeContext()
  const id = useId()
  const errorId = `${id}-error`
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showFileList, setShowFileList] = useState(false)
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [filteredFiles, setFilteredFiles] = useState<Array<{ path: string; name: string; mention: string }>>([])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (state !== 'disabled') {
      const newValue = e.target.value
      onChange?.(newValue)

      // Check if last character is '@' to show file list
      const lastChar = newValue.slice(-1)
      if (lastChar === '@') {
        // console.log('showing file list')
        setFilteredFiles(localMentionableFiles)
        // console.log(mentionableFiles)
        setSelectedFileIndex(0)
        setShowFileList(true)
      } else if (showFileList && newValue.endsWith(' ')) {
        // Hide list when space is typed after @
        setShowFileList(false)
      } else if (showFileList) {
        // Filter files based on text after @
        const atIndex = newValue.lastIndexOf('@')
        if (atIndex !== -1) {
          const searchTerm = newValue.slice(atIndex + 1).toLowerCase()
          const filtered = localMentionableFiles.filter(
            file => file.name.toLowerCase().includes(searchTerm) || file.path.toLowerCase().includes(searchTerm)
          )
          setFilteredFiles(filtered)
          setSelectedFileIndex(0)
          if (filtered.length === 0) {
            setShowFileList(false)
          }
        } else {
          setShowFileList(false)
        }
      }
    }
  }

  const scrollToSelectedItem = (index: number) => {
    if (listRef.current) {
      const listElement = listRef.current
      const selectedElement = listElement.children[index] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        })
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showFileList && filteredFiles.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedFileIndex(prev => {
            const newIndex = prev < filteredFiles.length - 1 ? prev + 1 : 0
            setTimeout(() => scrollToSelectedItem(newIndex), 0)
            return newIndex
          })
          return
        case 'ArrowUp':
          e.preventDefault()
          setSelectedFileIndex(prev => {
            const newIndex = prev > 0 ? prev - 1 : filteredFiles.length - 1
            setTimeout(() => scrollToSelectedItem(newIndex), 0)
            return newIndex
          })
          return
        case 'Enter':
          e.preventDefault()
          handleFileSelection(filteredFiles[selectedFileIndex])
          return
        case 'Escape':
          e.preventDefault()
          setShowFileList(false)
          return
      }
    }
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

  const handleFileSelection = async (file: { path: string; name: string; mention: string }) => {
    try {
      await requestFileContent(file.path)
      // Remove the selected file from local mentionable list and current filtered list
      setLocalMentionableFiles(prev => prev.filter(f => f.path !== file.path))
      setFilteredFiles(prev => prev.filter(f => f.path !== file.path))

      // Replace the @ mention with just the filename
      if (textareaRef.current) {
        const currentValue = textareaRef.current.value
        const atIndex = currentValue.lastIndexOf('@')
        if (atIndex !== -1) {
          const beforeAt = currentValue.slice(0, atIndex)
          const newValue = beforeAt + `@${file.name} `
          onChange?.(newValue)

          // Focus back to textarea and position cursor after the mention
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.focus()
              textareaRef.current.setSelectionRange(newValue.length, newValue.length)
            }
          }, 0)
        }
      }
    } catch (error) {
      console.error('Failed to request file content:', error)
    } finally {
      setShowFileList(false)
    }
  }

  // Auto-resize functionality with debounced execution to prevent forced reflows
  const adjustHeightTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      // Use requestAnimationFrame to batch DOM reads and writes
      requestAnimationFrame(() => {
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
      })
    }
  }

  const debouncedAdjustHeight = () => {
    if (adjustHeightTimeoutRef.current) {
      clearTimeout(adjustHeightTimeoutRef.current)
    }
    adjustHeightTimeoutRef.current = setTimeout(adjustHeight, 16) // ~60fps
  }

  // Adjust height when value changes (debounced)
  useEffect(() => {
    debouncedAdjustHeight()
  }, [value])

  // Adjust height on mount and cleanup timeout
  useEffect(() => {
    adjustHeight()
    return () => {
      if (adjustHeightTimeoutRef.current) {
        clearTimeout(adjustHeightTimeoutRef.current)
      }
    }
  }, [])

  // Programmatic focus when autoFocus toggles to true (e.g., after streaming finishes)
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  // Handle clicking outside to close file list
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showFileList &&
        listRef.current &&
        textareaRef.current &&
        !listRef.current.contains(event.target as Node) &&
        !textareaRef.current.contains(event.target as Node)
      ) {
        setShowFileList(false)
      }
    }

    if (showFileList) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFileList])

  // const replaceFileMentionsWithContent = useCallback(
  //   (message: string): string => {
  //     if (!message || typeof message !== 'string') {
  //       return message || ''
  //     }

  //     let processedMessage = message

  //     // Find all @filename mentions in the message
  //     const mentionRegex = /@(\S+)/g
  //     const mentions = [...message.matchAll(mentionRegex)]

  //     for (const mention of mentions) {
  //       const fileName = mention[1]
  //       const fullMention = mention[0]

  //       // Find the corresponding file content in selectedFilesForChat
  //       const fileContent = selectedFilesForChat.find(file => {
  //         const fileNameFromPath = file.path.split('/').pop() || file.relativePath.split('/').pop()
  //         return fileNameFromPath === fileName
  //       })

  //       if (fileContent && fileContent.contents) {
  //         // Replace the @filename with the actual file content
  //         const replacement = `\n\n--- File: ${fileContent.relativePath} ---\n${fileContent.contents}\n--- End of ${fileContent.relativePath} ---\n\n`
  //         processedMessage = processedMessage.replace(fullMention, replacement)
  //       }
  //     }

  //     return processedMessage
  //   },
  //   [selectedFilesForChat]
  // )

  // Pass the processing function to parent component via callback
  // useEffect(() => {
  //   if (onProcessMessage) {
  //     onProcessMessage(replaceFileMentionsWithContent)
  //   }
  // }, [onProcessMessage, selectedFilesForChat])

  const baseStyles = `${width} px-4 py-3 rounded-xl transition-all duration-200 overflow-hidden bg-neutral-50 dark:bg-neutral-900`
  const labelClasses = state === 'disabled' ? 'opacity-40' : ''

  const stateStyles = {
    default: `${baseStyles} bg-gray-800 text-stone-900 dark:text-stone-200 placeholder-neutral-700 dark:placeholder-neutral-200 border-gray-600 outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 dark:focus:ring-2 dark:focus:ring-secondary-600`,
    error: `${baseStyles} bg-gray-800 text-stone-800 dark:text-stone-200 placeholder-neutral-700 dark:placeholder-neutral-200 border-red-500 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500 focus:ring-opacity-50`,
    disabled: `${baseStyles} bg-gray-900 text-stone-800 dark:text-stone-200 border-gray-700 placeholder-neutral-700 dark:placeholder-neutral-200 cursor-not-allowed`,
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className={`text-md font-medium text-neutral-800 dark:text-neutral-200 ${labelClasses}`}>
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
          onBlur={onBlur}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={state === 'disabled'}
          // maxLength={maxLength}
          className={`${stateStyles[state]} thin-scrollbar ${dragOver ? 'border-blue-500 ring-2 ring-blue-500' : ''} ${className}`}
          aria-invalid={state === 'error'}
          aria-describedby={state === 'error' && errorMessage ? errorId : undefined}
          autoFocus={autoFocus}
          style={{
            minHeight: `${minRows * 24 + 16}px`,
          }}
          {...rest}
        />

        {/* Character count indicator */}

        {/* Character count indicator */}
        {value.length <= 0 && (
          <div className='absolute top-1 right-2 text-xs text-stone-800 dark:text-stone-200'>
            {/* {value.length}/{maxLength} */}
            Shift+Enter
            <br />
            for new line
          </div>
        )}
        {/* Floating file list */}
        {showFileList && filteredFiles.length > 0 && (
          <div
            ref={listRef}
            className='absolute z-50 mb-1 w-80 max-h-60 overflow-y-auto dark:bg-secondary-600 bg-slate-50 border border-gray-600 rounded-lg shadow-lg thin-scrollbar'
            style={{
              bottom: '100%',
              left: 0,
            }}
          >
            {filteredFiles.map((file, index) => (
              <div
                key={file.path}
                className={`px-3 py-2 cursor-pointer text-sm border-gray-400 last:border-b-0 ${
                  index === selectedFileIndex
                    ? 'bg-slate-200 dark:bg-secondary-800 text-stone-800 dark:text-stone-200'
                    : 'text-stone-800 dark:text-stone-200'
                }`}
                onClick={() => handleFileSelection(file)}
                onMouseEnter={() => setSelectedFileIndex(index)}
              >
                <div className='font-medium truncate'>{file.name}</div>
                <div className='text-xs text-stone-800 dark:text-stone-300 truncate'>{file.path}</div>
              </div>
            ))}
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
