import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')

function headerMapFromVercel(json: {
  headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
}): Record<string, string> {
  const block = json.headers?.find((h) => h.source === '/(.*)')
  if (!block) throw new Error('vercel.json missing catch-all headers')
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
  it('emits identical anti-framing and baseline SPA headers on Vercel and Netlify', () => {
    const vercel = headerMapFromVercel(
      JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8')) as {
        headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
      },
    )
    const netlify = headerMapFromNetlify(readFileSync(resolve(root, 'netlify.toml'), 'utf8'))

    const expected = {
      'Content-Security-Policy': "frame-ancestors 'none'",
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'X-Robots-Tag': 'noindex, nofollow',
    }

    for (const [key, value] of Object.entries(expected)) {
      expect(vercel[key], `vercel ${key}`).toBe(value)
      expect(netlify[key], `netlify ${key}`).toBe(value)
    }
  })
})
