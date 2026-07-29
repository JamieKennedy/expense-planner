import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './api'

describe('apiRequest', () => {
  afterEach(() => {
    document.cookie = 'expense-csrf=; Max-Age=0; Path=/'
    vi.unstubAllGlobals()
  })

  it('sends the double-submit CSRF cookie on mutations', async () => {
    document.cookie = 'expense-csrf=csrf-value; Path=/'
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Current account' }),
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const request = fetchMock.mock.calls[0]
    const init = request?.[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('X-CSRF-Token')).toBe('csrf-value')
    expect(init.credentials).toBe('include')
  })
})
