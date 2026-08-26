import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { BrandMark } from '@/components/brand/BrandMark'
import { DemoBanner } from '@/components/DemoBanner'

const mainNav = [
  { to: '/app', label: 'Home', end: true, icon: '⌂' },
  { to: '/app/transactions', label: 'Transactions', icon: '⇄' },
  { to: '/app/budgets', label: 'Budgets', icon: '▦' },
  { to: '/app/goals', label: 'Goals', icon: '◎' },
]

const moreNav = [
  { to: '/app/accounts', label: 'Accounts' },
  { to: '/app/recurring', label: 'Recurring' },
  { to: '/app/debts', label: 'Debts' },
  { to: '/app/reports', label: 'Reports' },
  { to: '/app/settings', label: 'Settings' },
]

function linkClass({ isActive }: { isActive: boolean }) {
  return [
    'flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary-50 text-primary-800'
      : 'text-[var(--muted)] hover:bg-stone-100 hover:text-[var(--fg)]',
  ].join(' ')
}

export function AppShell() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleLock() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell pt-9 md:flex md:flex-row">
      <DemoBanner />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-12 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className="hidden w-60 shrink-0 border-r border-[var(--line)] bg-white md:flex md:flex-col"
        aria-label="Primary"
      >
        <div className="border-b border-[var(--line)] px-4 py-5">
          <div className="flex items-center gap-2.5">
            <BrandMark size="sm" />
            <div>
              <p className="font-display text-lg font-bold text-primary-700">Fundsicles</p>
              <p className="text-xs text-[var(--muted)]">Your money, made clear.</p>
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
          {mainNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
            More
          </p>
          {moreNav.map((item) => (
            <NavLink key={item.to} to={item.to} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[var(--line)] p-3">
          <p className="truncate px-2 text-xs text-[var(--muted)]">
            {user?.email ?? 'demo@local'}
          </p>
          <p className="truncate px-2 text-[10px] text-stone-400">Demo user</p>
          <Button variant="ghost" className="mt-1 w-full justify-start" onClick={handleLock}>
            Lock demo
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-9 z-20 flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg)]/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <BrandMark size="sm" />
            <p className="font-display text-base font-bold text-primary-700">Fundsicles</p>
          </div>
          <NavLink to="/app/settings" className="text-sm font-medium text-[var(--muted)]">
            More
          </NavLink>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 md:px-8 md:py-8"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white/95 backdrop-blur md:hidden"
        aria-label="Mobile"
      >
        <ul className="grid grid-cols-5">
          {mainNav.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
                    isActive ? 'text-primary-700' : 'text-[var(--muted)]',
                  ].join(' ')
                }
              >
                <span className="text-base" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            </li>
          ))}
          <li>
            <NavLink
              to="/app/settings"
              className={({ isActive }) =>
                [
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium',
                  isActive ? 'text-primary-700' : 'text-[var(--muted)]',
                ].join(' ')
              }
            >
              <span className="text-base" aria-hidden="true">
                ···
              </span>
              More
            </NavLink>
          </li>
        </ul>
      </nav>
    </div>
  )
}
