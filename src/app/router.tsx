import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { LoadingSkeleton } from '@/components/ui/States'
import { RouteErrorBoundary } from '@/app/RouteErrorBoundary'

const LoginPage = lazy(() =>
  import('@/features/auth/AuthPages').then((m) => ({ default: m.LoginPage })),
)

const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const TransactionsPage = lazy(() =>
  import('@/features/transactions/TransactionsPage').then((m) => ({
    default: m.TransactionsPage,
  })),
)
const AccountsPage = lazy(() =>
  import('@/features/accounts/AccountsPage').then((m) => ({ default: m.AccountsPage })),
)
const BudgetsPage = lazy(() =>
  import('@/features/budgets/BudgetsPage').then((m) => ({ default: m.BudgetsPage })),
)
const RecurringPage = lazy(() =>
  import('@/features/recurring/RecurringPage').then((m) => ({ default: m.RecurringPage })),
)
const GoalsPage = lazy(() =>
  import('@/features/goals/GoalsPage').then((m) => ({ default: m.GoalsPage })),
)
const DebtsPage = lazy(() =>
  import('@/features/debts/DebtsPage').then((m) => ({ default: m.DebtsPage })),
)
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingSkeleton />}>{children}</Suspense>
}

function Protected({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/app" replace /> },
  {
    path: '/login',
    element: (
      <Lazy>
        <LoginPage />
      </Lazy>
    ),
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/app',
    element: (
      <Protected>
        <AppShell />
      </Protected>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: (
          <Lazy>
            <DashboardPage />
          </Lazy>
        ),
      },
      {
        path: 'transactions',
        element: (
          <Lazy>
            <TransactionsPage />
          </Lazy>
        ),
      },
      {
        path: 'accounts',
        element: (
          <Lazy>
            <AccountsPage />
          </Lazy>
        ),
      },
      {
        path: 'budgets',
        element: (
          <Lazy>
            <BudgetsPage />
          </Lazy>
        ),
      },
      {
        path: 'recurring',
        element: (
          <Lazy>
            <RecurringPage />
          </Lazy>
        ),
      },
      {
        path: 'goals',
        element: (
          <Lazy>
            <GoalsPage />
          </Lazy>
        ),
      },
      {
        path: 'debts',
        element: (
          <Lazy>
            <DebtsPage />
          </Lazy>
        ),
      },
      {
        path: 'reports',
        element: (
          <Lazy>
            <ReportsPage />
          </Lazy>
        ),
      },
      {
        path: 'settings',
        element: (
          <Lazy>
            <SettingsPage />
          </Lazy>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/app" replace /> },
])
