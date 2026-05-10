import React, { useEffect, useRef } from 'react';
import { autoResize } from '@Utils/dom/autoResize';

// ─── InputTextarea ──────────────────────────────────────────────────────────
// Auto-growing textarea built on top of the same `input-modern` styling.
// Calls `autoResize` on mount and after every value change so the content
// height is always in sync.

/**
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   placeholder?: string,
 *   className?: string,
 *   disabled?: boolean,
 *   minRows?: number,
 *   autoGrow?: boolean,
 * } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>} props
 */
const InputTextarea = React.forwardRef(function InputTextarea(
  {
    value,
    onChange,
    placeholder,
    className = '',
    disabled,
    minRows = 2,
    autoGrow = true,
    ...rest
  },
  ref,
) {
  const innerRef = useRef(null);

  // Sync external/internal refs.
  useEffect(() => {
    if (typeof ref === 'function') ref(innerRef.current);
    else if (ref) ref.current = innerRef.current;
  }, [ref]);

  // Re-measure on every value change.
  useEffect(() => {
    if (autoGrow) autoResize(innerRef.current);
  }, [value, autoGrow]);

  return (
    <textarea
      ref={innerRef}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      rows={minRows}
      onChange={(e) => onChange(e.target.value)}
      className={`input-modern resize-none ${className}`}
      {...rest}
    />
  );
});

export default InputTextarea;
