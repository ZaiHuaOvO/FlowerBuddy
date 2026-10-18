import { afterEach, describe, expect, it, vi } from 'vitest'
import { GmailModule } from '../../src/main/modules/gmail/gmail-module'
import type { GmailService } from '../../src/main/modules/gmail/gmail-service'
import {
  createEmptyGmailState,
  type GmailMessageSummary,
  type GmailState
} from '../../src/main/modules/gmail/types'
import { TaskScheduler } from '../../src/main/scheduler/task-scheduler'
import { AppError } from '../../src/main/shared/errors'
import type { LoggerLike } from '../../src/main/shared/logger'

const logger: LoggerLike = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const MESSAGE: GmailMessageSummary = {
  id: 'm1',
  from: 'a@example.com',
  subject: 'Hello',
  date: 'Fri, 17 Oct 2026 12:00:00 +0800'
}

function createService(state: Partial<GmailState> = {}, poll?: GmailService['poll']): GmailService {
  const fullState = { ...createEmptyGmailState(), ...state }
  return {
    isConfigured: vi.fn(() => true),
    getState: vi.fn(() => fullState),
    getStateView: vi.fn(() => ({
      configured: true,
      emailAddress: fullState.emailAddress,
      authExpired: fullState.authExpired
    })),
    poll:
      poll ??
      (async () => ({
        summary: { newMessages: 0, baselineReestablished: false },
        messages: []
      })),
    checkNow: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    saveClientCredentials: vi.fn(),
    flush: vi.fn()
  } as unknown as GmailService
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Gmail module', () => {
  it('reports configured, unconfigured and expired states', () => {
    const configured = new GmailModule({
      service: createService(),
      pollIntervalMinutes: () => 3
    })
    expect(configured.getStatus()).toBe('ready')

    const expired = new GmailModule({
      service: createService({ authExpired: true }),
      pollIntervalMinutes: () => 3
    })
    expect(expired.getStatus()).toBe('auth-expired')

    const unconfiguredService = createService()
    ;(unconfiguredService.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const unconfigured = new GmailModule({
      service: unconfiguredService,
      pollIntervalMinutes: () => 3
    })
    expect(unconfigured.getStatus()).toBe('not-configured')
  })

  it('summarizes manual checks with privacy-safe text', async () => {
    const empty = new GmailModule({
      service: createService({}, async () => ({
        summary: { newMessages: 0, baselineReestablished: false },
        messages: []
      })),
      pollIntervalMinutes: () => 3
    })
    await expect(empty.runAction('gmail:check')).resolves.toEqual({
      state: 'empty',
      message: '没有新邮件'
    })

    const received = new GmailModule({
      service: createService({}, async () => ({
        summary: { newMessages: 2, baselineReestablished: false },
        messages: [MESSAGE, MESSAGE]
      })),
      pollIntervalMinutes: () => 3
    })
    await expect(received.runAction('gmail:check')).resolves.toEqual({
      state: 'success',
      message: '收到 2 封新邮件'
    })

    const baseline = new GmailModule({
      service: createService({}, async () => ({
        summary: { newMessages: 0, baselineReestablished: true },
        messages: []
      })),
      pollIntervalMinutes: () => 3
    })
    const result = await baseline.runAction('gmail:check')
    expect(result.state).toBe('empty')
    expect(result.message).toContain('同步基线')
  })

  it('polls in the background and forwards new messages to the handler', async () => {
    vi.useFakeTimers()
    const poll = vi.fn(async () => ({
      summary: { newMessages: 1, baselineReestablished: false },
      messages: [MESSAGE]
    }))
    const module = new GmailModule({
      service: createService({}, poll),
      pollIntervalMinutes: () => 3
    })
    const scheduler = new TaskScheduler({ logger })
    const handler = vi.fn()
    module.setNewMailHandler(handler)

    module.start({ scheduler, logger, notify: () => {} })
    expect(scheduler.getTaskIds()).toEqual(['gmail:poll'])

    await vi.advanceTimersByTimeAsync(3 * 60 * 1000)
    expect(poll).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith([MESSAGE])

    module.stop()
    expect(scheduler.getTaskIds()).toEqual([])
  })

  it('stops polling when Gmail asks for re-authentication', async () => {
    vi.useFakeTimers()
    const poll = vi.fn(async () => {
      throw new AppError('AUTH_EXPIRED', 'Gmail 授权已失效，请重新连接')
    })
    const module = new GmailModule({
      service: createService({}, poll),
      pollIntervalMinutes: () => 1
    })
    const scheduler = new TaskScheduler({ logger })
    module.start({ scheduler, logger, notify: () => {} })

    await vi.advanceTimersByTimeAsync(60 * 1000)
    expect(poll).toHaveBeenCalledTimes(1)
    expect(scheduler.getTaskIds()).toEqual([])
  })
})
