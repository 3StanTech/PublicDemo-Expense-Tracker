import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { profileFormSchema } from '@/schemas/forms'
import { useAuth } from '@/features/auth/AuthProvider'
import { useProfile } from '@/features/data/hooks'
import { updateProfile } from '@/features/data/repositories'
import { resetDemoData } from '@/demo/reset'
import { PageHeader, LoadingSkeleton } from '@/components/ui/States'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getErrorMessage } from '@/lib/errors'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import type { z } from 'zod'

const moreLinks = [
  { to: '/app/accounts', label: 'Accounts & categories' },
  { to: '/app/recurring', label: 'Recurring rules' },
  { to: '/app/debts', label: 'Debts' },
  { to: '/app/reports', label: 'Reports & export' },
]

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const profile = useProfile()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [message, setMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  type ProfileInput = z.infer<typeof profileFormSchema>
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileFormSchema),
    values: {
      displayName: profile.data?.displayName ?? '',
    },
  })

  async function onSubmit(values: ProfileInput) {
    setProfileError(null)
    setMessage(null)
    try {
      await updateProfile(values.displayName?.trim() || null)
      await qc.invalidateQueries({ queryKey: queryKeys.profile })
      setMessage('Profile saved.')
    } catch (e) {
      setProfileError(getErrorMessage(e))
    }
  }

  async function handleLock() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function handleResetDemo() {
    setResetError(null)
    setResetting(true)
    try {
      await resetDemoData()
    } catch (e) {
      setResetting(false)
      setResetError(getErrorMessage(e, 'Could not reset demo data'))
    }
  }

  return (
    <div>
      <PageHeader title="Settings" description="Profile, demo controls, and lock." />

      <nav className="mb-6 md:hidden" aria-label="More destinations">
        <ul className="card divide-y divide-[var(--line)]">
          {moreLinks.map((l) => (
            <li key={l.to}>
              <Link className="flex min-h-11 items-center px-4 py-3 text-sm font-medium" to={l.to}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="card p-4" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="mb-3 text-base font-semibold">
          Profile
        </h2>
        <p className="mb-3 text-sm text-[var(--muted)]">{user?.email ?? 'demo@local'}</p>
        {profile.isLoading ? (
          <LoadingSkeleton rows={3} />
        ) : (
          <form className="max-w-md space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
            <Input
              label="Display name"
              error={form.formState.errors.displayName?.message}
              {...form.register('displayName')}
            />
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Currency</dt>
                <dd className="font-medium">{profile.data?.currency ?? 'PHP'}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Locale</dt>
                <dd className="font-medium">{profile.data?.locale ?? 'en-PH'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[var(--muted)]">Timezone</dt>
                <dd className="font-medium">{profile.data?.timezone ?? 'Asia/Manila'}</dd>
              </div>
            </dl>
            {profile.error ? (
              <p className="text-sm text-[var(--muted)]" role="status">
                Demo profile store is still loading locally — defaults shown above.
              </p>
            ) : null}
            {message ? (
              <p className="text-sm text-primary-800" role="status">
                {message}
              </p>
            ) : null}
            {profileError ? (
              <p className="field-error" role="alert">
                {profileError}
              </p>
            ) : null}
            <Button type="submit" disabled={form.formState.isSubmitting || Boolean(profile.error)}>
              Save profile
            </Button>
          </form>
        )}
      </section>

      <section className="card mt-4 p-4" aria-labelledby="session-heading">
        <h2 id="session-heading" className="mb-3 text-base font-semibold">
          Session
        </h2>
        <Button variant="danger" onClick={() => void handleLock()}>
          Lock demo
        </Button>
      </section>

      <section className="card mt-4 p-4" aria-labelledby="demo-data-heading">
        <h2 id="demo-data-heading" className="mb-2 text-base font-semibold">
          Demo data
        </h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Restores the fictional sample budget on this device. Changes you made in this browser are
          discarded.
        </p>
        {resetError ? (
          <p className="mb-3 field-error" role="alert">
            {resetError}
          </p>
        ) : null}
        <Button variant="danger" disabled={resetting} onClick={() => void handleResetDemo()}>
          {resetting ? 'Resetting…' : 'Reset demo data'}
        </Button>
      </section>

      <section className="card mt-4 p-4" aria-labelledby="about-heading">
        <h2 id="about-heading" className="mb-2 text-base font-semibold">
          About Fundsicles
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Public local-only demo. Fictional PHP sample data is persisted only in this browser — not
          on a hosted account. Integer-centavo math, no bank sync, no shared households. The PIN
          entry gate ships in the client and is not security.
        </p>
      </section>
    </div>
  )
}
