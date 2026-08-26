import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEMO_USER,
  readDemoUnlocked,
  verifyDemoPin,
  writeDemoUnlocked,
} from './demoAuth'

export type DemoUser = {
  id: string
  email: string
}

export type DemoSession = {
  unlocked: true
}

interface AuthContextValue {
  session: DemoSession | null
  user: DemoUser | null
  loading: boolean
  /** Always true for the local demo — no hosted credentials required. */
  configured: boolean
  signIn: (pin: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(readDemoUnlocked)

  const signIn = useCallback(async (pin: string) => {
    if (!verifyDemoPin(pin)) {
      throw new Error("That PIN didn't work. Try again.")
    }
    writeDemoUnlocked(true)
    setUnlocked(true)
  }, [])

  const signOut = useCallback(async () => {
    writeDemoUnlocked(false)
    setUnlocked(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session: unlocked ? { unlocked: true } : null,
      user: unlocked ? { id: DEMO_USER.id, email: DEMO_USER.email } : null,
      loading: false,
      configured: true,
      signIn,
      signOut,
    }),
    [unlocked, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
