import type { ReactNode } from 'react'
import { Button } from './Button'

export type EmptyIllustration =
  | 'cash-flow'
  | 'goals'
  | 'transactions'
  | 'budget-celebration'
  | 'debt-payoff'

const ILLUSTRATION_SRC: Record<EmptyIllustration, string> = {
  'cash-flow': '/illustrations/empty-cash-flow.png',
  goals: '/illustrations/empty-goals.png',
  transactions: '/illustrations/empty-transactions.png',
  'budget-celebration': '/illustrations/budget-celebration.png',
  'debt-payoff': '/illustrations/debt-payoff-milestone.png',
}

/** Shared presentation so every empty/completion illustration reads at the same visual scale. */
export const EMPTY_ILLUSTRATION_CLASS = 'h-auto w-full max-w-sm object-contain'

/** Intrinsic sizes for layout stability (CLS). */
export const ILLUSTRATION_DIM: Record<
  EmptyIllustration,
  { width: number; height: number; className: string }
> = {
  'cash-flow': {
    width: 1280,
    height: 720,
    className: EMPTY_ILLUSTRATION_CLASS,
  },
  goals: {
    width: 1200,
    height: 1200,
    className: EMPTY_ILLUSTRATION_CLASS,
  },
  transactions: {
    width: 1280,
    height: 720,
    className: EMPTY_ILLUSTRATION_CLASS,
  },
  'budget-celebration': {
    width: 1200,
    height: 1200,
    className: EMPTY_ILLUSTRATION_CLASS,
  },
  'debt-payoff': {
    width: 1280,
    height: 720,
    className: EMPTY_ILLUSTRATION_CLASS,
  },
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-16 w-full" />
      ))}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  illustration,
}: {
  title: string
  description: string
  action?: ReactNode
  /** Optional decorative art for sparse empty / completion states. */
  illustration?: EmptyIllustration
}) {
  const dim = illustration ? ILLUSTRATION_DIM[illustration] : null
  return (
    <div className="card flex flex-col items-start gap-3 p-6 text-left">
      {illustration && dim ? (
        <img
          src={ILLUSTRATION_SRC[illustration]}
          alt=""
          width={dim.width}
          height={dim.height}
          className={dim.className}
          decoding="async"
        />
      ) : null}
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="text-sm text-[var(--muted)]">{description}</p>
      {action}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="card border-danger/30 p-6" role="alert">
      <h3 className="font-display text-base font-semibold text-danger">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
      {onRetry ? (
        <div className="mt-4">
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions}
    </header>
  )
}

export function MoneyText({
  minor,
  className = '',
  signed = false,
  negativeIndicator = false,
}: {
  minor: number
  className?: string
  signed?: boolean
  negativeIndicator?: boolean
}) {
  const negative = minor < 0
  const formatted = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Math.abs(minor) / 100)

  let display = formatted
  if (signed && minor > 0) display = `+${formatted}`
  if (minor < 0) display = `−${formatted}`

  return (
    <span className={className}>
      {negative && negativeIndicator ? (
        <span className="mr-1 inline-block" aria-hidden="true">
          ▼
        </span>
      ) : null}
      <span className="sr-only">
        {minor < 0 ? 'Negative ' : minor > 0 && signed ? 'Positive ' : ''}
      </span>
      {display}
    </span>
  )
}
