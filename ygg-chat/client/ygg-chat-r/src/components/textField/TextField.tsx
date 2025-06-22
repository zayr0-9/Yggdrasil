// src/components/TextField.tsx
import React, { useState } from 'react';

interface TextFieldProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'number';
  disabled?: boolean;
  error?: string;
  helperText?: string;
  required?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  disabled = false,
  error,
  helperText,
  required = false,
  size = 'medium'
}) => {
  // We'll use internal state if no value/onChange is provided (uncontrolled component)
  const [internalValue, setInternalValue] = useState('');
  
  // Determine if this is a controlled or uncontrolled component
  const isControlled = value !== undefined;
  const inputValue = isControlled ? value : internalValue;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    if (isControlled && onChange) {
      onChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };
  
  // Base input styles that apply to all text fields
  const baseInputStyles = 'w-full border rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1';
  
  // Size variants control padding and text size
  const sizeStyles = {
    small: 'px-3 py-1.5 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-5 py-3 text-lg'
  };
  
  // State-based styles change based on error state and disabled state
  const stateStyles = error 
    ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500';
    
  const disabledStyles = disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white';
  
  // Combine all input styles
  const inputClasses = `
    ${baseInputStyles}
    ${sizeStyles[size]}
    ${stateStyles}
    ${disabledStyles}
  `.trim();
  
  // Label styles with required indicator
  const labelStyles = 'block text-sm font-medium text-gray-700 mb-1';
  
  return (
    <div className="w-full">
      {/* Label section - only show if label is provided */}
      {label && (
        <label className={labelStyles}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {/* Input field */}
      <input
        type={type}
        value={inputValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={inputClasses}
      />
      
      {/* Helper text or error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {!error && helperText && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
};