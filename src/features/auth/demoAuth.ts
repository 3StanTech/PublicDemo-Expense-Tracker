export const DEMO_PIN = '123456'
export const DEMO_UNLOCK_KEY = 'fundsicles-demo-unlocked'

/** Fixed demo identity so hooks that check `user` keep working. */
export const DEMO_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'demo@local',
} as const

export function verifyDemoPin(pin: string): boolean {
  return pin === DEMO_PIN
}

export function readDemoUnlocked(): boolean {
  try {
    return sessionStorage.getItem(DEMO_UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDemoUnlocked(value: boolean): void {
  try {
    if (value) sessionStorage.setItem(DEMO_UNLOCK_KEY, '1')
    else sessionStorage.removeItem(DEMO_UNLOCK_KEY)
  } catch {
    // Safari private mode can throw; in-memory unlock still works for this mount.
  }
}
