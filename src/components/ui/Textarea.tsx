import type { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
}

export function Textarea({ label, error, id, className = '', ...rest }: TextareaProps) {
  const areaId = id ?? rest.name ?? label.replace(/\s+/g, '-').toLowerCase()
  return (
    <div className="w-full">
      <label className="label" htmlFor={areaId}>
        {label}
      </label>
      <textarea
        id={areaId}
        className={`textarea ${error ? 'border-danger' : ''} ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${areaId}-error` : undefined}
        {...rest}
      />
      {error ? (
        <p id={`${areaId}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
