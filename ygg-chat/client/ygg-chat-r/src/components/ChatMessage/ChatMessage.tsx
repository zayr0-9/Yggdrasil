import React, { useState } from 'react'
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
  timestamp?: Date
  onEdit?: (id: string, newContent: string) => void
  onBranch?: (id: string, newContent: string) => void
  onDelete?: (id: string) => void
  onCopy?: (content: string) => void
  isEditing?: boolean
  width: ChatMessageWidth
  className?: string
}

interface MessageActionsProps {
  onEdit?: () => void
  onBranch?: () => void
  onDelete?: () => void
  onCopy?: () => void
  onSave?: () => void
  onCancel?: () => void
  onSaveBranch?: () => void
  isEditing: boolean
  editMode?: 'edit' | 'branch'
}

const MessageActions: React.FC<MessageActionsProps> = ({ onEdit, onBranch, onDelete, onCopy, onSave, onCancel, onSaveBranch, isEditing, editMode = 'edit' }) => {
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
            className='p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-gray-700 transition-colors duration-150'
            title='Copy message'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
              />
            </svg>
          </button>
          {onEdit && (
            <button
              onClick={onBranch}
              className='p-1.5 rounded-md text-gray-400 hover:text-yellow-400 hover:bg-gray-700 transition-colors duration-150'
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
          {onDelete && (
            <button
              onClick={onDelete}
              className='p-1.5 rounded-md text-gray-400 hover:text-red-400 hover:bg-gray-700 transition-colors duration-150'
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
  timestamp,
  onEdit,
  onBranch,
  onDelete,
  onCopy,
  isEditing = false,
  width = 'w-3/5',
}) => {
  const [editingState, setEditingState] = useState(isEditing)
  const [editContent, setEditContent] = useState(content)
  const [editMode, setEditMode] = useState<'edit' | 'branch'>('edit')

  const handleEdit = () => {
    setEditingState(true)
    setEditContent(content)
    setEditMode('edit')
  }

  const handleBranch = () => {
    setEditingState(true)
    setEditContent(content)
    setEditMode('branch')
  }

  const handleSave = () => {
    if (onEdit && editContent.trim() !== content) {
      onEdit(id, editContent.trim())
    }
    setEditingState(false)
  }

  const handleSaveBranch = () => {
    if (onBranch && editContent.trim() !== content) {
      onBranch(id, editContent.trim())
    }
    setEditingState(false)
  }

  const handleCancel = () => {
    setEditContent(content)
    setEditingState(false)
    setEditMode('edit')
  }

  const handleCopy = async () => {
    if (onCopy) {
      onCopy(content)
    } else {
      try {
        await navigator.clipboard.writeText(content)
      } catch (err) {
        console.error('Failed to copy message:', err)
      }
    }
  }

  const handleDelete = () => {
    if (onDelete) {
      onDelete(id)
    }
  }

  const getRoleStyles = () => {
    switch (role) {
      case 'user':
        return {
          container: 'bg-gray-800 border-l-4 border-l-blue-500',
          role: 'text-blue-400',
          roleText: 'User',
        }
      case 'assistant':
        return {
          container: 'bg-gray-850 border-l-4 border-l-green-500',
          role: 'text-green-400',
          roleText: 'Assistant',
        }
      case 'system':
        return {
          container: 'bg-gray-800 border-l-4 border-l-purple-500',
          role: 'text-purple-400',
          roleText: 'System',
        }
      default:
        return {
          container: 'bg-gray-800 border-l-4 border-l-gray-500',
          role: 'text-gray-400',
          roleText: 'Unknown',
        }
    }
  }

  const styles = getRoleStyles()

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      className={`group rounded-lg p-4 mb-4 ${styles.container} ${width} transition-all duration-200 hover:bg-opacity-80`}
    >
      {/* Header with role and actions */}
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <span className={`text-sm font-semibold ${styles.role}`}>{styles.roleText}</span>
          {timestamp && <span className='text-xs text-gray-500'>{formatTimestamp(timestamp)}</span>}
        </div>

        <MessageActions
          onEdit={role === 'user' ? handleEdit : undefined}
          onBranch={role === 'user' ? handleBranch : undefined}
          onDelete={handleDelete}
          onCopy={handleCopy}
          onSave={handleSave}
          onSaveBranch={handleSaveBranch}
          onCancel={handleCancel}
          isEditing={editingState}
          editMode={editMode}
        />
      </div>

      {/* Message content */}
      <div className='text-gray-100 w-full'>
        {editingState ? (
          <TextArea
            value={editContent}
            onChange={setEditContent}
            placeholder='Edit your message...'
            minRows={2}
            maxLength={2000}
            autoFocus
            width='w-full'
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                handleSave()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                handleCancel()
              }
            }}
          />
        ) : (
          <div className='whitespace-pre-wrap leading-relaxed w-full'>{content}</div>
        )}
      </div>

      {/* Edit instructions */}
      {editingState && <div className='mt-2 text-xs text-gray-500'>Press Ctrl+Enter to save, Escape to cancel</div>}
    </div>
  )
}
