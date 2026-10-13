import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')

type FirebaseHosting = {
  hosting?: {
    headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
    rewrites?: Array<{ source: string; destination: string }>
  }
}

function headerMapFromFirebase(json: FirebaseHosting): Record<string, string> {
  const block = json.hosting?.headers?.find((h) => h.source === '**')
  if (!block) throw new Error('firebase.json missing catch-all hosting headers')
  return Object.fromEntries(block.headers.map((h) => [h.key, h.value]))
}

function headerMapFromNetlify(toml: string): Record<string, string> {
  const valuesIdx = toml.indexOf('[headers.values]')
  if (valuesIdx < 0) throw new Error('netlify.toml missing [headers.values]')
  const body = toml.slice(valuesIdx + '[headers.values]'.length)
  const map: Record<string, string> = {}
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('[')) break
    const m = trimmed.match(/^([A-Za-z0-9-]+)\s*=\s*"(.*)"\s*$/)
    if (m) map[m[1]!] = m[2]!
  }
  return map
}

describe('host security headers parity', () => {
  it('emits the same anti-framing and baseline SPA headers on Firebase Hosting and Netlify', () => {
    const firebaseJson = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8')) as FirebaseHosting
    const firebase = headerMapFromFirebase(firebaseJson)
    const netlify = headerMapFromNetlify(readFileSync(resolve(root, 'netlify.toml'), 'utf8'))

    const expected = {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'X-Robots-Tag': 'noindex, nofollow',
    }

    for (const [key, value] of Object.entries(expected)) {
      expect(firebase[key], `firebase ${key}`).toBe(value)
      expect(netlify[key], `netlify ${key}`).toBe(value)
    }

    // Firebase carries the full app CSP; both hosts forbid framing.
    expect(firebase['Content-Security-Policy']).toContain("frame-ancestors 'none'")
    expect(netlify['Content-Security-Policy']).toBe("frame-ancestors 'none'")
    expect(firebaseJson.hosting?.rewrites).toContainEqual({ source: '**', destination: '/index.html' })
  })
})
