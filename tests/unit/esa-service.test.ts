import { describe, expect, it } from 'vitest'
import {
  fetchEsaTraffic,
  formatBytes,
  formatTrafficResult,
  todayRangeUtc,
  type EsaClientLike,
  type EsaResponseBodyLike
} from '../../src/main/modules/esa/esa-service'

const CREDENTIALS = {
  accessKeyId: 'test-access-key-id',
  accessKeySecret: 'test-access-key-secret',
  siteId: 'site-123'
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
  it('queries Traffic/ALL for the local natural day in UTC', async () => {
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
            interval: 300,
            startTime: new Date(2026, 9, 17).toISOString(),
            endTime: now.toISOString()
          },
          (request) => {
            captured = (request as { toMap(): Record<string, unknown> }).toMap()
          }
        )
    })

    expect(captured?.SiteId).toBe('site-123')
    expect(captured?.Fields).toEqual([{ Dimension: ['ALL'], FieldName: 'Traffic' }])
    expect(captured?.StartTime).toBe(new Date(2026, 9, 17).toISOString())
    expect(captured?.EndTime).toBe(now.toISOString())
    expect(traffic.bytes).toBe(1536)
    expect(traffic.samplingRate).toBe(100)
    expect(traffic.intervalSeconds).toBe(300)
  })

  it('sums multiple Traffic entries and tolerates a missing sampling rate', async () => {
    const traffic = await fetchEsaTraffic({
      ...CREDENTIALS,
      clientFactory: () =>
        clientReturning({
          summarizedData: [
            { fieldName: 'Traffic', value: 100 },
            { fieldName: 'Traffic', value: 200 },
            { fieldName: 'Requests', value: 9 }
          ]
        })
    })

    expect(traffic.bytes).toBe(300)
    expect(traffic.samplingRate).toBeNull()
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

  it('accepts a one-second range at local midnight', () => {
    const midnight = new Date(2026, 9, 17, 0, 0, 0)
    const range = todayRangeUtc(midnight)
    expect(new Date(range.endTime).getTime()).toBeGreaterThan(new Date(range.startTime).getTime())
  })

  it('formats bytes and traffic results', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(1536)).toBe('1.50 KB')
    expect(formatBytes(10 * 1024)).toBe('10.0 KB')
    expect(formatBytes(1024 ** 3)).toBe('1.00 GB')

    const result = formatTrafficResult({
      bytes: 1536,
      samplingRate: 100,
      intervalSeconds: 300,
      startTime: new Date(2026, 9, 17).toISOString(),
      endTime: new Date(2026, 9, 17, 12, 30).toISOString(),
      fetchedAt: new Date(2026, 9, 17, 12, 30).toISOString()
    })
    expect(result.state).toBe('success')
    expect(result.message).toContain('今日流量')
    expect(result.message).toContain('1.50 KB')
    expect(result.message).toContain('采样率 100%')
  })
})
