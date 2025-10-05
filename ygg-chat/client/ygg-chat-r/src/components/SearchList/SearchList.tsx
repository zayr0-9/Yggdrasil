import React, { useEffect, useRef, useState } from 'react'
import { TextField } from '..'

export type SearchResultItem = {
  conversationId: number
  messageId: string
  content: string
}

type Variant = 'neutral' | 'secondary'

export interface SearchListProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  results: SearchResultItem[]
  loading?: boolean
  onResultClick: (conversationId: number, messageId: string) => void
  placeholder?: string
  className?: string
  dropdownVariant?: Variant
}

const variantBorderClass: Record<Variant, string> = {
  neutral: 'dark:border-neutral-600',
  secondary: 'dark:border-secondary-600',
}

const SearchList: React.FC<SearchListProps> = ({
  value,
  onChange,
  onSubmit,
  results,
  loading = false,
  onResultClick,
  placeholder = 'Search messages...',
  className = '',
  dropdownVariant = 'neutral',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLUListElement | null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit()
      setIsOpen(true)
    }
  }

  const handleSearchClick = () => {
    if (value.trim()) {
      onSubmit()
      setIsOpen(true)
    }
  }

  const borderVariantClass = variantBorderClass[dropdownVariant]

  return (
    <div className={`relative ${className}`}>
      <TextField
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={handleEnterKey as any}
        showSearchIcon
        onSearchClick={handleSearchClick}
      />

      {isOpen &&
        (loading ? (
          <div className='absolute z-10 left-0 right-0 bg-indigo-50 dark:bg-secondary-800 p-4 text-sm'>
            Searching...
          </div>
        ) : (
          results.length > 0 && (
            <ul
              ref={dropdownRef}
              className={`absolute z-10 left-0 right-0 max-h-230 overflow-y-auto bg-slate-50 border border-indigo-100 ${borderVariantClass} rounded shadow-lg dark:bg-neutral-700 thin-scrollbar`}
              style={{ colorScheme: 'dark' }}
            >
              {results.map(res => (
                <li
                  key={`${res.conversationId}-${res.messageId}`}
                  className='p-3 hover:bg-indigo-100 dark:bg-secondary-700 dark:hover:bg-secondary-800 cursor-pointer text-sm dark:text-neutral-200'
                  onClick={() => {
                    onResultClick(res.conversationId, res.messageId)
                    setIsOpen(false)
                  }}
                >
                  <div className='font-semibold text-base text-indigo-600 dark:text-yBrown-50'>
                    Conv {res.conversationId}
                  </div>
                  <div className='mt-1 pl-2 text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-words max-h-48 overflow-hidden'>
                    {res.content}
                  </div>
                </li>
              ))}
            </ul>
          )
        ))}
    </div>
  )
}

export default SearchList
