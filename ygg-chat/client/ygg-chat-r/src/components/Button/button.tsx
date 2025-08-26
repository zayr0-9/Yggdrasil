// src/components/Button.tsx
import React from 'react'

interface ButtonProps {
  className?: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'danger'
  size?: 'smaller' | 'small' | 'medium' | 'large'
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  ...rest
}) => {
  // Base styles that all buttons share
  const baseStyles =
    'inline-flex items-center justify-center gap-1 font-medium rounded-lg leading-none transition-colors duration-200 focus:outline-none'

  // Variant styles define the color scheme
  const variantStyles = {
    primary:
      'bg-indigo-400 text-white hover:bg-indigo-500 dark:bg-sky-900 dark:hover:bg-sky-800 focus:ring-1 dark:focus:ring-sky-700',
    secondary:
      'bg-indigo-300 hover:bg-indigo-400 dark:bg-gray-600 text-neutral-50 dark:text-white dark:hover:bg-gray-700 focus:ring-1 dark:focus:gray-500 dark:focus:opacity-50',
    outline: 'border-2 border-neutral-300 text-blue-600 hover:bg-blue-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  }

  // Size styles control padding and text size
  const sizeStyles = {
    smaller: 'px-1.5 py-1 text-xs',
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg',
  }

  // Disabled styles override other styles when button is disabled
  const disabledStyles = 'opacity-50 cursor-not-allowed'

  // Combine all styles based on props
  const buttonClasses = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${disabled ? disabledStyles : ''}
  `.trim()

  return (
    <button
      type={type}
      className={`${buttonClasses} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  )
}
