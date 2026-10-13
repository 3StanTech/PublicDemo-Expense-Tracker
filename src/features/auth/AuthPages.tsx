import { useState } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { pinSchema, type PinInput } from '@/schemas/forms'
import { useAuth } from './AuthProvider'
import { DEMO_PIN } from './demoAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getErrorMessage } from '@/lib/errors'
import { BrandMark } from '@/components/brand/BrandMark'

const AUTH_TAGLINE = 'Your money, made clear.'

/** Mobile: full-bleed edge-to-edge. Desktop: constrained beside the form. */
export const AUTH_HERO_IMG_CLASS =
  'auth-hero-illustration mt-6 h-auto w-full max-w-none object-contain object-center lg:mt-10 lg:max-w-md'

function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-dvh overflow-x-hidden lg:grid lg:grid-cols-2">
      {/* Brand / hero — no horizontal padding on mobile so the image can go edge-to-edge */}
      <section
        className="auth-panel flex flex-col items-center justify-center py-8 lg:min-h-dvh lg:px-10 lg:py-12"
        aria-label="Brand"
      >
        <div className="flex w-full flex-col items-center lg:max-w-md lg:items-start">
          <div className="flex w-full items-center justify-center gap-2.5 px-6 text-center lg:justify-start lg:px-0 lg:text-left">
            <BrandMark size="md" />
            <div>
              <p className="font-display text-lg font-semibold text-primary-700">Fundsicles</p>
              <p className="text-xs text-[var(--muted)] sm:text-sm">{AUTH_TAGLINE}</p>
            </div>
          </div>
          <img
            src="/illustrations/auth-hero.png"
            alt="Open wallet with stylized bills and coins on a soft mint cloud"
            width={1280}
            height={720}
            className={AUTH_HERO_IMG_CLASS}
            decoding="async"
          />
        </div>
      </section>

      {/* Form panel */}
      <section className="flex flex-col justify-center px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 text-center lg:text-left">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
          </div>
          <div className="card p-6">{children}</div>
        </div>
      </section>
    </main>
  )
}

export function LoginPage() {
  const { signIn, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<PinInput>({
    resolver: zodResolver(pinSchema),
    defaultValues: { pin: '' },
  })

  if (!loading && user) return <Navigate to="/app" replace />

  async function onSubmit(values: PinInput) {
    setServerError(null)
    try {
      await signIn(values.pin)
      navigate(from, { replace: true })
    } catch (e) {
      setServerError(getErrorMessage(e, 'Could not unlock demo'))
      form.setValue('pin', '')
    }
  }

  return (
    <AuthLayout
      title="Make your money make sense"
      subtitle="Unlock this public demo to explore the sample budget."
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Input
          label="Demo PIN"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          pattern="[0-9]*"
          className="text-center tracking-[0.3em]"
          hint={`Public demo — PIN ${DEMO_PIN} ships in the client and is not security.`}
          error={form.formState.errors.pin?.message}
          {...form.register('pin')}
        />
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
          This is a presentation demo with fictional PHP sample data; your changes are saved to a
          private demo space for this browser. The PIN is an entry gate, not authentication — anyone
          can read it from the shipped client.
        </p>
        {serverError ? (
          <p className="field-error" role="alert">
            {serverError}
          </p>
        ) : null}
        <Button type="submit" fullWidth disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Unlocking…' : 'Continue'}
        </Button>
      </form>
    </AuthLayout>
  )
}
