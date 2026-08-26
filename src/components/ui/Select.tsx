import type { SelectHTMLAttributes } from 'react'

interface Option {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: Option[]
  error?: string
  placeholder?: string
}

export function Select({
  label,
  options,
  error,
  placeholder,
  id,
  className = '',
  ...rest
}: SelectProps) {
  const selectId = id ?? rest.name ?? label.replace(/\s+/g, '-').toLowerCase()
  return (
    <div className="w-full">
      <label className="label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className={`select ${error ? 'border-danger' : ''} ${className}`.trim()}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...rest}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
