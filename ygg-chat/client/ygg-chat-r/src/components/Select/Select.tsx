import React, { useEffect, useMemo, useRef, useState } from 'react'

export type SelectOption = { value: string; label?: string }

interface SelectProps {
  value?: string
  options: Array<string | SelectOption>
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export const Select: React.FC<SelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select...'
  ,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [openUp, setOpenUp] = useState(false)
  const [listMaxHeight, setListMaxHeight] = useState<number | undefined>(undefined)

  const normOptions: SelectOption[] = useMemo(
    () =>
      options.map(o => (typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: o.label ?? o.value })),
    [options]
  )

  const selected = useMemo(() => normOptions.find(o => o.value === value) || null, [normOptions, value])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      if (listRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Compute dropdown placement and size
  useEffect(() => {
    if (!open) return
    const compute = () => {
      const btn = btnRef.current
      if (!btn || typeof window === 'undefined') return
      const rect = btn.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      // Decide direction: prefer up if below space is tight and above has more room
      const shouldOpenUp = spaceBelow < 200 && spaceAbove > spaceBelow
      setOpenUp(shouldOpenUp)
      const available = (shouldOpenUp ? spaceAbove : spaceBelow) - 8 // 8px margin
      // Cap to a reasonable range for usability
      const maxH = Math.max(160, Math.min(360, available))
      setListMaxHeight(Number.isFinite(maxH) ? maxH : 280)
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true) // capture scrolls from ancestors
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [open])

  // Keyboard navigation
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      setOpen(true)
      setActiveIndex(Math.max(0, normOptions.findIndex(o => o.value === value)))
      return
    }
    if (!open) return

    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => (i + 1) % normOptions.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => (i - 1 + normOptions.length) % normOptions.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const opt = normOptions[activeIndex]
      if (opt) {
        onChange(opt.value)
        setOpen(false)
      }
      return
    }
  }

  const handleSelect = (val: string) => {
    if (disabled) return
    onChange(val)
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        className={`w-full inline-flex items-center justify-between gap-2 px-3 py-2 rounded bg-neutral-50 dark:bg-gray-700 text-stone-800 dark:text-stone-200 border border-neutral-200/70 dark:border-neutral-700 shadow-sm hover:bg-neutral-100 dark:hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen(o => !o)}
        onKeyDown={onKeyDown}
        disabled={disabled}
      >
        <span className="truncate text-left flex-1">
          {selected ? selected.label : <span className="text-neutral-500 dark:text-neutral-400">{placeholder}</span>}
        </span>
        <i className={`bx bx-chevron-down transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          className={`absolute z-50 w-full left-0 ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'} rounded-lg overflow-auto thin-scrollbar border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl`}
          style={{ maxHeight: listMaxHeight }}
        >
          {normOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">No options</div>
          ) : (
            normOptions.map((opt, idx) => {
              const isSelected = value === opt.value
              const isActive = idx === activeIndex
              return (
                <button
                  type="button"
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors
                    ${isActive ? 'bg-neutral-100 dark:bg-neutral-700' : ''}
                    ${isSelected ? 'font-medium' : ''}
                    text-stone-800 dark:text-stone-100`}
                >
                  {opt.label}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
