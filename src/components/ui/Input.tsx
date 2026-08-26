import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className = '', ...rest },
  ref,
) {
  const inputId = id ?? rest.name ?? label.replace(/\s+/g, '-').toLowerCase()
  return (
    <div className="w-full">
      <label className="label" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={`input ${error ? 'border-danger' : ''} ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...rest}
      />
      {hint && !error ? (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${inputId}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
})
