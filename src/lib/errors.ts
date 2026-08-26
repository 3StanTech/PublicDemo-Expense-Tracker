export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === 'string' && msg) return msg
  }
  return fallback
}

export function isAuthError(error: unknown): boolean {
  const msg = getErrorMessage(error).toLowerCase()
  return (
    msg.includes('jwt') ||
    msg.includes('not authenticated') ||
    msg.includes('session') ||
    msg.includes('invalid refresh token') ||
    msg.includes('auth session missing')
  )
}
