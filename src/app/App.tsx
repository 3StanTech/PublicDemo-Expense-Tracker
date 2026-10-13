import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { useRemoteChangeRefresh } from '@/features/data/hooks'
import { createQueryClient } from '@/lib/query-client'
import { router } from './router'
import { useState } from 'react'

/** Keeps query results in step with changes that arrive from the demo service. */
function RemoteChangeRefresh() {
  useRemoteChangeRefresh()
  return null
}

export function App() {
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RemoteChangeRefresh />
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
