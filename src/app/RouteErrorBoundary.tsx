import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/lib/errors'

export function RouteErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()

  let title = 'Something went wrong'
  let message = getErrorMessage(error)

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`
    message = typeof error.data === 'string' ? error.data : message
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6">
      <div className="card p-6" role="alert">
        <p className="text-sm font-semibold text-primary-700">Fundsicles</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-[var(--muted)]">{message}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => navigate('/app')}>Go home</Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    </main>
  )
}
