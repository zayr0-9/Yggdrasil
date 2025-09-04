// src/components/Button.tsx
import React from 'react'

type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'children' | 'onClick' | 'type' | 'disabled'
> & {
  className?: string
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'outline2'
  size?: 'smaller' | 'small' | 'medium' | 'large'
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  rounded?: 'full' | 'lg' | 'none'
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  rounded = 'lg',
  ...rest
}) => {
  // Base styles that all buttons share
  const baseStyles =
    'inline-flex items-center justify-center gap-1 font-medium leading-none transition-colors duration-200 focus:outline-none'

  // Variant styles define the color scheme
  const variantStyles = {
    primary:
      'bg-indigo-400 text-white hover:bg-indigo-500 dark:bg-yPink-200 dark:hover:bg-yPink-300 focus:ring-1 dark:focus:ring-yPink-300',
    secondary:
      'bg-indigo-300 hover:bg-indigo-400 dark:bg-secondary-500 text-neutral-50 dark:text-white dark:hover:bg-secondary-600 focus:ring-1 dark:focus:ring-secondary-400 dark:focus:secondary-500',
    outline: 'border-2 border-neutral-300 text-neutral-300 hover:bg-blue-50',
    outline2: ' text-neutral-300 dark:hover:bg-neutral-700',
    danger:
      'bg-rose-400 dark:bg-yPink-700 dark:border-2 dark:border-yPink-200 text-white dark:hover:bg-yPink-600 hover:bg-rose-500 focus:ring-red-500',
  }

  // Size styles control padding and text size
  const sizeStyles = {
    smaller: 'px-1.5 py-1 text-xs',
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-3 py-2 text-base',
    large: 'px-4 py-3 text-lg',
  }

  // Disabled styles override other styles when button is disabled
  const disabledStyles = 'opacity-50 cursor-not-allowed'

  // Combine all styles based on props
  const buttonClasses = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${disabled ? disabledStyles : ''}
    ${className}
    ${rounded === 'full' ? 'rounded-full' : rounded === 'lg' ? 'rounded-lg' : 'rounded-none'}
  `.trim()

  return (
    <button type={type} className={`${buttonClasses}`} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  )
}
