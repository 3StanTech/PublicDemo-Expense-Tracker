import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LoginPage } from './AuthPages'
import { DEMO_PIN } from './demoAuth'

const authMock = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  user: null as null | { id: string; email?: string },
  loading: false,
  configured: true,
  session: null as null | { unlocked: true },
}))

vi.mock('./AuthProvider', () => ({
  useAuth: () => ({
    signIn: authMock.signIn,
    signOut: authMock.signOut,
    user: authMock.user,
    loading: authMock.loading,
    configured: authMock.configured,
    session: authMock.session,
  }),
}))

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<div>App home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PIN login page', () => {
  beforeEach(() => {
    authMock.user = null
    authMock.loading = false
    authMock.configured = true
    authMock.session = null
    authMock.signIn.mockReset()
  })

  it('renders exact login heading, subtitle, and brand tagline', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'Make your money make sense' })).toBeInTheDocument()
    expect(
      screen.getByText('Unlock this public demo to explore the sample budget.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Your money, made clear.').length).toBeGreaterThan(0)
    expect(screen.getByText('Fundsicles')).toBeInTheDocument()
  })

  it('shows Demo PIN field, Continue button, and presentation-only disclosure', () => {
    renderLogin()
    expect(screen.getByLabelText('Demo PIN')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`PIN ${DEMO_PIN}`))).toBeInTheDocument()
    expect(
      screen.getByText(/presentation demo|entry gate, not authentication/i),
    ).toBeInTheDocument()
  })

  it('auth hero is full-bleed width on mobile and constrained on large screens', () => {
    renderLogin()
    const hero = screen.getByRole('img', {
      name: /open wallet with stylized bills and coins/i,
    })
    expect(hero.getAttribute('src')).toContain('auth-hero.png')
    expect(hero.className).toContain('w-full')
    expect(hero.className).toContain('max-w-none')
    expect(hero.className).toContain('lg:max-w-md')
    expect(hero.className).not.toMatch(/max-w-xs/)
    const brand = screen.getByRole('region', { name: 'Brand' })
    expect(brand.className).not.toMatch(/(^|\s)px-6(\s|$)/)
    expect(brand.className).toContain('lg:px-10')
  })

  it('unlocks with the demo PIN and navigates to /app', async () => {
    const user = userEvent.setup()
    authMock.signIn.mockResolvedValue(undefined)
    renderLogin()
    await user.type(screen.getByLabelText('Demo PIN'), DEMO_PIN)
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => {
      expect(authMock.signIn).toHaveBeenCalledWith(DEMO_PIN)
    })
    await waitFor(() => {
      expect(screen.getByText('App home')).toBeInTheDocument()
    })
  })

  it('shows an error for a wrong PIN and stays on the gate', async () => {
    const user = userEvent.setup()
    authMock.signIn.mockRejectedValue(new Error("That PIN didn't work. Try again."))
    renderLogin()
    await user.type(screen.getByLabelText('Demo PIN'), '000000')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/That PIN didn't work/i)
    })
    expect(screen.queryByText('App home')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Demo PIN')).toBeInTheDocument()
  })

  it('redirects to /app when already unlocked', () => {
    authMock.user = { id: 'demo', email: 'demo@local' }
    authMock.session = { unlocked: true }
    renderLogin()
    expect(screen.getByText('App home')).toBeInTheDocument()
    expect(screen.queryByLabelText('Demo PIN')).not.toBeInTheDocument()
  })
})
