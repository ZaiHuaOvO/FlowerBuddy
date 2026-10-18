import { describe, expect, it } from 'vitest'
import {
  fetchEsaTraffic,
  formatBytes,
  formatTrafficResult,
  type EsaClientLike,
  type EsaResponseBodyLike
} from '../../src/main/modules/esa/esa-service'

const CREDENTIALS = {
  accessKeyId: 'test-access-key-id',
  accessKeySecret: 'test-access-key-secret',
  siteId: 'site-123',
  ranges: ['last24h'] as Array<'last24h' | 'last7d' | 'last30d'>
}

function clientReturning(
  body: EsaResponseBodyLike,
  capture?: (request: unknown) => void
): EsaClientLike {
  return {
    async describeSiteTimeSeriesDataWithOptions(request) {
      capture?.(request)
      return { body }
    }
  }
}

describe('ESA traffic service', () => {
  it('queries Traffic/ALL for the selected rolling range', async () => {
    const now = new Date(2026, 9, 17, 12, 30, 0)
    let captured: Record<string, unknown> | undefined

    const traffic = await fetchEsaTraffic({
      ...CREDENTIALS,
      now: () => now,
      clientFactory: () =>
        clientReturning(
          {
            summarizedData: [{ fieldName: 'Traffic', value: 1536 }],
            samplingRate: 100,
            interval: 300
          },
          (request) => {
            captured = (request as { toMap(): Record<string, unknown> }).toMap()
          }
        )
    })

    expect(captured?.SiteId).toBe('site-123')
    expect(captured?.Fields).toEqual([{ Dimension: ['ALL'], FieldName: 'Traffic' }])
    expect(captured?.StartTime).toBe(new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
    expect(captured?.EndTime).toBe(now.toISOString())
    expect(traffic.ranges).toHaveLength(1)
    expect(traffic.ranges[0]).toMatchObject({
      key: 'last24h',
      label: '过去 24 小时',
      bytes: 1536,
      samplingRate: 100,
      intervalSeconds: 300
    })
  })

  it('queries multiple selected ranges and sums Traffic entries', async () => {
    const now = new Date(2026, 9, 17, 12, 30, 0)
    const requests: Array<Record<string, unknown>> = []
    let call = 0
    const traffic = await fetchEsaTraffic({
      ...CREDENTIALS,
      ranges: ['last24h', 'last7d', 'last30d'],
      now: () => now,
      clientFactory: () => ({
        async describeSiteTimeSeriesDataWithOptions(request) {
          requests.push((request as { toMap(): Record<string, unknown> }).toMap())
          call += 1
          return {
            body: {
              summarizedData: [
                { fieldName: 'Traffic', value: 100 * call },
                { fieldName: 'Traffic', value: 50 },
                { fieldName: 'Requests', value: 9 }
              ]
            }
          }
        }
      })
    })

    expect(requests).toHaveLength(3)
    expect(traffic.ranges.map((range) => range.key)).toEqual(['last24h', 'last7d', 'last30d'])
    expect(traffic.ranges.map((range) => range.bytes)).toEqual([150, 250, 350])
    expect(traffic.ranges.every((range) => range.samplingRate === null)).toBe(true)
  })

  it('rejects responses without a Traffic aggregate', async () => {
    await expect(
      fetchEsaTraffic({
        ...CREDENTIALS,
        clientFactory: () => clientReturning({ summarizedData: [] })
      })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })

    await expect(
      fetchEsaTraffic({
        ...CREDENTIALS,
        clientFactory: () =>
          clientReturning({ summarizedData: [{ fieldName: 'Traffic', value: 'NaN' }] })
      })
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('rejects an empty range selection', async () => {
    await expect(fetchEsaTraffic({ ...CREDENTIALS, ranges: [] })).rejects.toMatchObject({
      code: 'INVALID_INPUT'
    })
  })

  it('maps invalid credentials and permission errors', async () => {
    const unauthorized: EsaClientLike = {
      async describeSiteTimeSeriesDataWithOptions() {
        const error = new Error('invalid') as Error & {
          code: string
          statusCode: number
        }
        error.code = 'InvalidAccessKeyId.NotFound'
        error.statusCode = 404
        throw error
      }
    }
    await expect(
      fetchEsaTraffic({ ...CREDENTIALS, clientFactory: () => unauthorized })
    ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })

    const forbidden: EsaClientLike = {
      async describeSiteTimeSeriesDataWithOptions() {
        const error = new Error('denied') as Error & {
          code: string
          statusCode: number
        }
        error.code = 'Forbidden.Ram'
        error.statusCode = 403
        throw error
      }
    }
    await expect(
      fetchEsaTraffic({ ...CREDENTIALS, clientFactory: () => forbidden })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' })
  })

  it('maps throttling and server errors', async () => {
    const throttled: EsaClientLike = {
      async describeSiteTimeSeriesDataWithOptions() {
        const error = new Error('slow down') as Error & {
          code: string
          statusCode: number
        }
        error.code = 'Throttling.User'
        error.statusCode = 429
        throw error
      }
    }
    await expect(
      fetchEsaTraffic({ ...CREDENTIALS, clientFactory: () => throttled })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', retryable: true })

    const unavailable: EsaClientLike = {
      async describeSiteTimeSeriesDataWithOptions() {
        const error = new Error('down') as Error & { statusCode: number }
        error.statusCode = 503
        throw error
      }
    }
    await expect(
      fetchEsaTraffic({ ...CREDENTIALS, clientFactory: () => unavailable })
    ).rejects.toMatchObject({ code: 'REMOTE_SERVICE_ERROR', retryable: true })
  })

  it('requires credentials and a SiteId', async () => {
    await expect(fetchEsaTraffic({ ...CREDENTIALS, accessKeySecret: '' })).rejects.toMatchObject({
      code: 'NOT_CONFIGURED'
    })
    await expect(fetchEsaTraffic({ ...CREDENTIALS, siteId: '  ' })).rejects.toMatchObject({
      code: 'NOT_CONFIGURED'
    })
  })

  it('formats bytes and multi-range traffic results', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(10 * 1024)).toBe('10.0 KB')
    expect(formatBytes(1024 ** 3)).toBe('1.00 GB')

    const result = formatTrafficResult({
      ranges: [
        {
          key: 'last24h',
          label: '过去 24 小时',
          bytes: 1536,
          samplingRate: 100,
          intervalSeconds: 300,
          startTime: '2026-10-16T12:30:00.000Z',
          endTime: '2026-10-17T12:30:00.000Z'
        },
        {
          key: 'last7d',
          label: '过去 7 天',
          bytes: 2048,
          samplingRate: null,
          intervalSeconds: null,
          startTime: '2026-10-10T12:30:00.000Z',
          endTime: '2026-10-17T12:30:00.000Z'
        }
      ],
      fetchedAt: '2026-10-17T12:30:00.000Z'
    })
    expect(result.state).toBe('success')
    expect(result.message).toContain('过去 24 小时：1.50 KB')
    expect(result.message).toContain('过去 7 天：2.00 KB')
  })
})
