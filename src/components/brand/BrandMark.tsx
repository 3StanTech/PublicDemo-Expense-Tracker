type BrandMarkSize = 'sm' | 'md' | 'lg'

const sizeMap: Record<BrandMarkSize, string> = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
}

/**
 * Fundsicles brand mark: mint tile, coral pig (#FC8468), dual cheeks,
 * yellow coin slot, blank gold coin — legible at 16px.
 */
export function BrandMark({
  size = 'md',
  className = '',
  title,
}: {
  size?: BrandMarkSize
  className?: string
  /** When set, mark is meaningful; otherwise decorative. */
  title?: string
}) {
  const decorative = !title
  return (
    <svg
      className={`${sizeMap[size]} shrink-0 ${className}`.trim()}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden={decorative ? true : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" rx="8" fill="#5EEAD4" />
      {/* Pig body — matches welcome-scene wallet coral */}
      <ellipse cx="16" cy="18.5" rx="9.5" ry="8.2" fill="#FC8468" />
      {/* Ears */}
      <ellipse cx="9.8" cy="12.2" rx="2.4" ry="2.8" fill="#FC8468" />
      <ellipse cx="9.8" cy="12.2" rx="1.2" ry="1.5" fill="#E85A5A" />
      <ellipse cx="22.2" cy="12.2" rx="2.4" ry="2.8" fill="#FC8468" />
      <ellipse cx="22.2" cy="12.2" rx="1.2" ry="1.5" fill="#E85A5A" />
      {/* Yellow coin slot */}
      <rect x="10" y="9" width="12" height="4" rx="2" fill="#FBBF24" />
      <rect x="12" y="10.2" width="8" height="1.6" rx="0.8" fill="#1C1917" />
      {/* Blank gold coin (no glyph) */}
      <circle cx="20.5" cy="8.5" r="3.4" fill="#F59E0B" />
      <circle cx="20.5" cy="8.5" r="2.2" fill="#FBBF24" />
      {/* Face */}
      <path
        d="M12.4 17.2c0.5 0.7 1.2 0.7 1.7 0"
        stroke="#1C1917"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M17.9 17.2c0.5 0.7 1.2 0.7 1.7 0"
        stroke="#1C1917"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M13.2 20.2c1.3 1.5 4.3 1.5 5.6 0"
        stroke="#1C1917"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Matching coral blush on both cheeks */}
      <circle cx="9.8" cy="20.2" r="2.1" fill="#FB7185" />
      <circle cx="22.2" cy="20.2" r="2.1" fill="#FB7185" />
    </svg>
  )
}
