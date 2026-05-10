import React from 'react';

// ─── InputCore ──────────────────────────────────────────────────────────────
// Plain text input wrapped with the project's modern styling. For modal-
// specific labelled inputs use `ModalField`. Forwarded ref makes it composable
// with form helpers and the `useEscapeBlur` global hook.

/**
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   placeholder?: string,
 *   icon?: React.ComponentType<any>,
 *   className?: string,
 *   disabled?: boolean,
 * } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>} props
 */
const InputCore = React.forwardRef(function InputCore(
  { value, onChange, placeholder, icon: Icon, className = '', disabled, ...rest },
  ref,
) {
  return (
    <div className={`relative ${className}`}>
      {Icon ? (
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 pointer-events-none" />
      ) : null}
      <input
        ref={ref}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`input-modern ${Icon ? 'pl-9' : ''}`}
        {...rest}
      />
    </div>
  );
});

export default InputCore;
