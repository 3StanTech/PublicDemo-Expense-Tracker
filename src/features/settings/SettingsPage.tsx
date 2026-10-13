import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { profileFormSchema } from '@/schemas/forms'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDemoSync, useProfile } from '@/features/data/hooks'
import { updateProfile } from '@/features/data/repositories'
import { resetDemoData } from '@/demo/reset'
import { PageHeader, LoadingSkeleton } from '@/components/ui/States'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/Dialog'
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
  const sync = useDemoSync()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [message, setMessage] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

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

  function openResetDialog() {
    setResetError(null)
    setConfirmReset(true)
  }

  // Stable so the dialog's focus handling does not re-run on every render.
  const closeResetDialog = useCallback(() => {
    if (resetting) return
    setConfirmReset(false)
    setResetError(null)
  }, [resetting])

  async function handleResetDemo() {
    setResetError(null)
    setResetting(true)
    try {
      // Clears the saved changes on the demo service, then reloads the page.
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
                Demo profile is still loading — defaults shown above.
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
          Removes the changes saved in this browser&apos;s private demo space and restores the
          fictional sample budget.
        </p>
        <Button
          variant="danger"
          disabled={!sync.ready || resetting}
          aria-describedby={sync.ready ? undefined : 'reset-unavailable'}
          onClick={openResetDialog}
        >
          {resetting ? 'Resetting…' : 'Reset demo data'}
        </Button>
        {sync.ready ? null : (
          <p id="reset-unavailable" className="mt-2 text-sm text-[var(--muted)]">
            {sync.status.state === 'error'
              ? 'Reset is unavailable until the demo service reconnects.'
              : 'Reset is available once your demo space has loaded.'}
          </p>
        )}
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Reset demo data?"
        message="This removes every change saved in this browser's private demo space and reloads the page with the fictional sample data."
        confirmLabel="Reset demo data"
        onConfirm={() => void handleResetDemo()}
        onClose={closeResetDialog}
        loading={resetting}
        error={resetError}
      />

      <section className="card mt-4 p-4" aria-labelledby="about-heading">
        <h2 id="about-heading" className="mb-2 text-base font-semibold">
          About Fundsicles
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Public demo. Every visitor starts from the same fictional PHP sample data; your changes
          are saved to a private, anonymous demo space for this browser — not a real account.
          Integer-centavo math, no bank sync, no shared households. The PIN entry gate ships in the
          client and is not security.
        </p>
      </section>
    </div>
  )
}
