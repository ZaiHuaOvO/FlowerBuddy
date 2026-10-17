import { describe, expect, it } from 'vitest'
import {
  fetchDeepSeekBalance,
  formatCurrencyAmount
} from '../../src/main/modules/deepseek/deepseek-service'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

const BALANCE_BODY = {
  is_available: true,
  balance_infos: [
    {
      currency: 'CNY',
      total_balance: '110.00',
      granted_balance: '10.00',
      topped_up_balance: '100.00'
    },
    {
      currency: 'USD',
      total_balance: '5.50',
      granted_balance: '0.00',
      topped_up_balance: '5.50'
    }
  ]
}

describe('DeepSeek balance service', () => {
  it('parses multi-currency balances from the official response shape', async () => {
    const balance = await fetchDeepSeekBalance('sk-test', {
      fetchImpl: (async () => jsonResponse(BALANCE_BODY)) as unknown as typeof fetch,
      now: () => new Date('2026-10-17T04:00:00.000Z')
    })

    expect(balance.isAvailable).toBe(true)
    expect(balance.balances).toHaveLength(2)
    expect(balance.balances[0]).toEqual({
      currency: 'CNY',
      totalBalance: '110.00',
      grantedBalance: '10.00',
      toppedUpBalance: '100.00'
    })
    expect(balance.balances[1]?.currency).toBe('USD')
    expect(balance.fetchedAt).toBe('2026-10-17T04:00:00.000Z')
  })

  it('sends the key only in the Authorization header', async () => {
    let captured: RequestInit | undefined
    await fetchDeepSeekBalance('sk-test-key', {
      fetchImpl: (async (_url: string, init?: RequestInit) => {
        captured = init
        return jsonResponse(BALANCE_BODY)
      }) as unknown as typeof fetch
    })

    const headers = captured?.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer sk-test-key')
    expect(headers.accept).toBe('application/json')
  })

  it('maps 401 to AUTH_REQUIRED', async () => {
    await expect(
      fetchDeepSeekBalance('bad-key', {
        fetchImpl: (async () => new Response('', { status: 401 })) as unknown as typeof fetch
      })
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })
  })

  it('maps 429 to RATE_LIMITED', async () => {
    await expect(
      fetchDeepSeekBalance('sk-test', {
        fetchImpl: (async () => new Response('', { status: 429 })) as unknown as typeof fetch
      })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', retryable: true })
  })

  it('maps 5xx to REMOTE_SERVICE_ERROR', async () => {
    await expect(
      fetchDeepSeekBalance('sk-test', {
        fetchImpl: (async () => new Response('', { status: 503 })) as unknown as typeof fetch
      })
    ).rejects.toMatchObject({ code: 'REMOTE_SERVICE_ERROR', retryable: true })
  })

  it('rejects invalid JSON and unexpected structures', async () => {
    await expect(
      fetchDeepSeekBalance('sk-test', {
        fetchImpl: (async () =>
          new Response('not json', { status: 200 })) as unknown as typeof fetch
      })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })

    await expect(
      fetchDeepSeekBalance('sk-test', {
        fetchImpl: (async () =>
          jsonResponse({ is_available: true, balance_infos: 'nope' })) as unknown as typeof fetch
      })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('maps network failures to NETWORK_ERROR', async () => {
    await expect(
      fetchDeepSeekBalance('sk-test', {
        fetchImpl: (async () => {
          throw new TypeError('fetch failed')
        }) as unknown as typeof fetch
      })
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true })
  })

  it('maps timeouts to TIMEOUT', async () => {
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'))
        })
      })) as unknown as typeof fetch

    await expect(
      fetchDeepSeekBalance('sk-test', { fetchImpl, timeoutMs: 10 })
    ).rejects.toMatchObject({ code: 'TIMEOUT', retryable: true })
  })

  it('formats CNY and USD amounts', () => {
    expect(formatCurrencyAmount('CNY', '110.00')).toContain('110')
    expect(formatCurrencyAmount('USD', '5.5')).toContain('5.5')
    expect(formatCurrencyAmount('XYZ', 'not-a-number')).toBe('XYZ not-a-number')
  })
})
