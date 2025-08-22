import React, { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useDispatch } from 'react-redux'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { chatSliceActions } from '../../features/chats/chatSlice'
import { Button } from '../Button/button'
import { TextArea } from '../TextArea/TextArea'

type MessageRole = 'user' | 'assistant' | 'system'
// Updated to use valid Tailwind classes
type ChatMessageWidth =
  | 'max-w-sm'
  | 'max-w-md'
  | 'max-w-lg'
  | 'max-w-xl'
  | 'max-w-2xl'
  | 'max-w-3xl'
  | 'w-full'
  | 'w-3/5'

interface ChatMessageProps {
  id: string
  role: MessageRole
  content: string
  thinking?: string
  timestamp?: string | Date
  onEdit?: (id: string, newContent: string) => void
  onBranch?: (id: string, newContent: string) => void
  onDelete?: (id: string) => void
  onCopy?: (content: string) => void
  onResend?: (id: string) => void
  isEditing?: boolean
  width: ChatMessageWidth
  modelName?: string
  className?: string
  artifacts?: string[]
}

interface MessageActionsProps {
  onEdit?: () => void
  onBranch?: () => void
  onDelete?: () => void
  onCopy?: () => void
  onResend?: () => void
  onSave?: () => void
  onCancel?: () => void
  onSaveBranch?: () => void
  isEditing: boolean
  editMode?: 'edit' | 'branch'
  copied?: boolean
}

const MessageActions: React.FC<MessageActionsProps> = ({
  onEdit,
  onBranch,
  onDelete,
  onCopy,
  onResend,
  onSave,
  onCancel,
  onSaveBranch,
  isEditing,
  editMode = 'edit',
  copied = false,
}) => {
  return (
    <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200'>
      {isEditing ? (
        <>
          <button
            onClick={editMode === 'branch' ? onSaveBranch : onSave}
            className='p-1.5 rounded-md text-gray-400 hover:text-green-400 hover:bg-gray-700 transition-colors duration-150'
            title={editMode === 'branch' ? 'Create branch' : 'Save changes'}
          >
            {editMode === 'branch' ? (
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
              </svg>
            ) : (
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
              </svg>
            )}
          </button>
          <button
            onClick={onCancel}
            className='p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors duration-150'
            title='Cancel editing'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onCopy}
            className={`p-1.5 rounded-md transition-colors duration-150 ${
              copied
                ? 'text-green-500 hover:text-green-500 hover:bg-neutral-300'
                : 'text-gray-400 hover:text-blue-400 hover:bg-neutral-300'
            }`}
            title={copied ? 'Copied' : 'Copy message'}
          >
            {copied ? (
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
              </svg>
            ) : (
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
                />
              </svg>
            )}
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className='p-1.5 rounded-md text-gray-400 hover:text-yellow-400 hover:bg-neutral-300 transition-colors duration-150'
              title='Edit message'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
                />
              </svg>
            </button>
          )}
          {onBranch && (
            <button
              onClick={onBranch}
              className='p-1.5 rounded-md text-gray-400 hover:text-green-400 hover:bg-neutral-300 transition-colors duration-150'
              title='Branch message'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 4v8a4 4 0 004 4h4M6 8a2 2 0 100-4 2 2 0 000 4zm8 8a2 2 0 100-4 2 2 0 000 4z'
                />
              </svg>
            </button>
          )}
          {onResend && (
            <button
              onClick={onResend}
              className='p-1.5 rounded-md text-gray-400 hover:text-indigo-400 hover:bg-neutral-300 transition-colors duration-150'
              title='Resend message'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M4 4v6h6M20 20v-6h-6M5 19a9 9 0 1114-7'
                />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className='p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-neutral-300 transition-colors duration-150'
              title='Delete message'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  )
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  id,
  role,
  content,
  thinking,
  timestamp,
  onEdit,
  onBranch,
  onDelete,
  onCopy,
  onResend,
  isEditing = false,
  width = 'w-3/5',
  modelName,
  className,
  artifacts = [],
}) => {
  const dispatch = useDispatch()
  const [editingState, setEditingState] = useState(isEditing)
  const [editContent, setEditContent] = useState(content)
  const [editMode, setEditMode] = useState<'edit' | 'branch'>('edit')
  const [copied, setCopied] = useState(false)
  // Toggle visibility of the reasoning/thinking block
  const [showThinking, setShowThinking] = useState(true)

  const handleEdit = () => {
    dispatch(chatSliceActions.editingBranchSet(false))
    setEditingState(true)
    setEditContent(content)
    setEditMode('edit')
  }

  const handleBranch = () => {
    dispatch(chatSliceActions.editingBranchSet(true))
    setEditingState(true)
    setEditContent(content)
    setEditMode('branch')
  }

  const handleSave = () => {
    if (onEdit && editContent.trim() !== content) {
      onEdit(id, editContent.trim())
    }
    dispatch(chatSliceActions.editingBranchSet(false))
    setEditingState(false)
  }

  const handleSaveBranch = () => {
    if (onBranch) {
      onBranch(id, editContent.trim())
    }
    dispatch(chatSliceActions.editingBranchSet(false))
    // Clear any image drafts after branching is initiated
    dispatch(chatSliceActions.imageDraftsCleared())
    setEditingState(false)
  }

  const handleCancel = () => {
    setEditContent(content)
    dispatch(chatSliceActions.editingBranchSet(false))
    if (editMode === 'branch') {
      dispatch(chatSliceActions.imageDraftsCleared())
      // Restore any artifacts deleted during branch editing
      const numericId = Number(id)
      if (!Number.isNaN(numericId)) {
        dispatch(chatSliceActions.messageArtifactsRestoreFromBackup({ messageId: numericId }))
      }
    }
    setEditingState(false)
    setEditMode('edit')
  }

  const handleCopy = async () => {
    if (onCopy) {
      onCopy(content)
    }
    const ok = await copyPlainText(content)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } else {
      console.error('Failed to copy message')
    }
  }

  const handleDelete = () => {
    if (onDelete) {
      onDelete(id)
    }
  }

  const handleResend = () => {
    if (onResend) {
      onResend(id)
    }
  }

  const handleDeleteArtifact = (index: number) => {
    const numericId = Number(id)
    if (Number.isNaN(numericId)) return
    dispatch(chatSliceActions.messageArtifactDeleted({ messageId: numericId, index }))
  }

  const copyPlainText = async (text: string) => {
    // Try async clipboard API first
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch (_) {
      // fall through to fallback
    }

    // Fallback for non-secure contexts or older browsers
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      // @ts-ignore - Deprecated API used intentionally as a safe fallback when Clipboard API is unavailable
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      return ok
    } catch (err) {
      console.error('Copy fallback failed:', err)
      return false
    }
  }

  const getRoleStyles = () => {
    switch (role) {
      case 'user':
        return {
          container: 'bg-gray-800 border-l-4 border-l-blue-500 bg-indigo-50 dark:bg-neutral-800',
          role: 'text-indigo-800',
          roleText: 'User',
        }
      case 'assistant':
        return {
          container: 'bg-gray-850 border-l-4 border-l-green-500 bg-lime-50 dark:bg-neutral-800',
          role: 'text-lime-800',
          roleText: 'Assistant',
        }
      case 'system':
        return {
          container: 'bg-gray-800 border-l-4 border-l-purple-500 bg-purple-50 dark:bg-neutral-800',
          role: 'text-purple-400',
          roleText: 'System',
        }
      default:
        return {
          container: 'bg-gray-800 border-l-4 border-l-gray-500 bg-gray-50 dark:bg-neutral-800',
          role: 'text-gray-400',
          roleText: 'Unknown',
        }
    }
  }

  const styles = getRoleStyles()

  const formatTimestamp = (dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    if (isNaN(date.getTime())) {
      return typeof dateInput === 'string' ? dateInput : ''
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Custom renderer for block code (<pre>) to add a copy button while preserving valid HTML structure
  const PreRenderer: React.FC<any> = ({ children, ...props }) => {
    const [copied, setCopied] = useState(false)
    const preRef = useRef<HTMLPreElement | null>(null)

    const handleCopyCode = async () => {
      try {
        const plain = preRef.current?.innerText ?? ''
        await navigator.clipboard.writeText(plain)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } catch (err) {
        console.error('Failed to copy code block:', err)
      }
    }

    return (
      <div className='relative group my-3 not-prose'>
        {role === 'assistant' && (
          <Button
            type='button'
            onClick={handleCopyCode}
            className='absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 border-1 text-slate-900 dark:text-white border-neutral-600 dark:border-neutral-600 dark:hover:bg-neutral-700'
            size='smaller'
            variant='outline'
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        )}
        <pre
          ref={preRef}
          className={`not-prose overflow-auto rounded-lg border-0 ring-0 outline-none shadow-none bg-gray-100 text-gray-900 dark:bg-neutral-900 dark:text-neutral-100 p-3`}
          {...props}
        >
          {children}
        </pre>
      </div>
    )
  }

  return (
    <div
      id={`message-${id}`}
      className={`group rounded-lg p-4 mb-4 ${styles.container} ${width} transition-all duration-200 hover:bg-opacity-80 ${className ?? ''}`}
    >
      {/* Header with role and actions */}
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <span className={`text-sm font-semibold ${styles.role}`}>{styles.roleText}</span>
          {timestamp && formatTimestamp(timestamp) && (
            <span className='text-xs text-gray-500'>{formatTimestamp(timestamp)}</span>
          )}
        </div>

        <MessageActions
          onEdit={role === 'user' ? handleEdit : undefined}
          onBranch={role === 'user' ? handleBranch : undefined}
          onDelete={handleDelete}
          onCopy={handleCopy}
          onResend={role === 'assistant' ? handleResend : undefined}
          onSave={handleSave}
          onSaveBranch={handleSaveBranch}
          onCancel={handleCancel}
          isEditing={editingState}
          editMode={editMode}
          copied={copied}
        />
      </div>

      {/* Reasoning / thinking block */}
      {typeof thinking === 'string' && thinking.trim().length > 0 && (
        <div className='mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-neutral-900'>
          <div className='mb-2 flex items-center justify-between'>
            <div className='text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300'>
              Reasoning
            </div>
            <Button
              type='button'
              onClick={() => setShowThinking(s => !s)}
              className='ml-2 text-xs px-2 py-1 border-1 border-amber-300 text-amber-800 dark:text-amber-300 dark:border-amber-900/60 hover:bg-amber-100 dark:hover:bg-neutral-800'
              size='smaller'
              variant='outline'
              aria-expanded={showThinking}
              aria-controls={`reasoning-content-${id}`}
            >
              {showThinking ? 'Hide' : 'Show'}
            </Button>
          </div>
          {showThinking && (
            <div id={`reasoning-content-${id}`} className='prose max-w-none dark:prose-invert w-full text-sm'>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{ pre: PreRenderer }}>
                {thinking}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* Message content */}
      <div className='prose max-w-none dark:prose-invert w-full text-base'>
        {editingState ? (
          <TextArea
            value={editContent}
            onChange={setEditContent}
            placeholder='Edit your message...'
            minRows={2}
            maxLength={20000}
            autoFocus
            width='w-full'
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (editMode === 'branch') {
                  handleSaveBranch()
                } else {
                  handleSave()
                }
              } else if (e.key === 'Escape') {
                e.preventDefault()
                handleCancel()
              }
            }}
          />
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{ pre: PreRenderer }}
          >
            {content}
          </ReactMarkdown>
        )}
      </div>

      {/* Artifacts (images) */}
      {Array.isArray(artifacts) && artifacts.length > 0 && (
        <div className='mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
          {artifacts.map((dataUrl, idx) => (
            <div
              key={`${id}-artifact-${idx}`}
              className='relative rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900'
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dataUrl}
                alt={`attachment-${idx}`}
                className='w-full h-64 object-contain bg-neutral-100 dark:bg-neutral-800'
                loading='lazy'
              />
              {editingState && editMode === 'branch' && (
                <button
                  type='button'
                  title='Remove image'
                  onClick={() => handleDeleteArtifact(idx)}
                  className='absolute top-2 right-2 z-10 p-1.5 rounded-md bg-neutral-800/70 text-white hover:bg-neutral-700'
                >
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit instructions */}
      {editingState && (
        <div className='mt-2 text-xs text-gray-500'>
          Press Enter to save, Shift+Enter for new line, Escape to cancel
        </div>
      )}

      {modelName && <div className='mt-2 text-[16px] text-gray-500 flex justify-end'>{modelName}</div>}
    </div>
  )
}
