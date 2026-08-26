import { describe, expect, it } from 'vitest'
import { getErrorMessage } from '@/lib/errors'

/**
 * Contract for pages that depend on multiple queries: aggregate loading/error
 * and retry every dependency (no empty selectors from partial failure).
 */
function aggregatePageState(deps: Array<{ isLoading: boolean; error: unknown }>) {
  return {
    isLoading: deps.some((d) => d.isLoading),
    error: deps.find((d) => d.error)?.error ?? null,
  }
}

describe('dependent query aggregation contract', () => {
  it('surfaces the first dependency error for transactions-style pages', () => {
    const txs = { isLoading: false, error: null }
    const accounts = { isLoading: false, error: new Error('accounts down') }
    const categories = { isLoading: false, error: null }
    const state = aggregatePageState([txs, accounts, categories])
    expect(state.isLoading).toBe(false)
    expect(getErrorMessage(state.error)).toMatch(/accounts down/)
  })

  it('stays loading until every dependency settles', () => {
    const state = aggregatePageState([
      { isLoading: false, error: null },
      { isLoading: true, error: null },
      { isLoading: false, error: null },
    ])
    expect(state.isLoading).toBe(true)
  })
})
