import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskScheduler } from '../../src/main/scheduler/task-scheduler'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('task scheduler', () => {
  it('runs tasks on the configured interval', async () => {
    const scheduler = new TaskScheduler()
    let runs = 0

    scheduler.start({
      id: 'tick',
      owner: 'module',
      intervalMs: 1000,
      run: async () => {
        runs += 1
      }
    })

    await vi.advanceTimersByTimeAsync(999)
    expect(runs).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(runs).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(runs).toBe(2)

    scheduler.stopAll()
  })

  it('never overlaps runs of the same task', async () => {
    const scheduler = new TaskScheduler()
    let runs = 0
    const control: { release: (() => void) | null } = { release: null }

    scheduler.start({
      id: 'slow',
      owner: 'module',
      intervalMs: 100,
      run: async () => {
        runs += 1
        await new Promise<void>((resolve) => {
          control.release = resolve
        })
      }
    })

    await vi.advanceTimersByTimeAsync(100)
    expect(runs).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(runs).toBe(1)

    control.release?.()
    await vi.advanceTimersByTimeAsync(100)
    expect(runs).toBe(2)

    scheduler.stopAll()
  })

  it('aborts the current run and stops rescheduling', async () => {
    const scheduler = new TaskScheduler()
    let aborted = false

    scheduler.start({
      id: 'abortable',
      owner: 'module',
      intervalMs: 100,
      run: (signal) =>
        new Promise<void>(() => {
          signal.addEventListener('abort', () => {
            aborted = true
          })
        })
    })

    await vi.advanceTimersByTimeAsync(100)
    scheduler.stop('abortable')

    expect(aborted).toBe(true)
    expect(scheduler.getTaskIds()).toEqual([])
  })

  it('backs off after failures and resets after success', async () => {
    const scheduler = new TaskScheduler()
    let attempts = 0

    scheduler.start({
      id: 'flaky',
      owner: 'module',
      intervalMs: 100,
      run: async () => {
        attempts += 1
        if (attempts <= 2) {
          throw new Error('boom')
        }
      }
    })

    await vi.advanceTimersByTimeAsync(100)
    expect(attempts).toBe(1)

    await vi.advanceTimersByTimeAsync(199)
    expect(attempts).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(attempts).toBe(2)

    await vi.advanceTimersByTimeAsync(399)
    expect(attempts).toBe(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(attempts).toBe(3)

    await vi.advanceTimersByTimeAsync(100)
    expect(attempts).toBe(4)

    scheduler.stopAll()
  })

  it('supports immediate runs and runNow', async () => {
    const scheduler = new TaskScheduler()
    let runs = 0
    const task = {
      id: 'now',
      owner: 'module',
      intervalMs: 1000,
      run: async () => {
        runs += 1
      }
    }

    scheduler.start({ ...task, runImmediately: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(runs).toBe(1)

    await scheduler.runNow('now')
    expect(runs).toBe(2)

    scheduler.stopAll()
  })

  it('reschedules from now after system resume', async () => {
    const scheduler = new TaskScheduler()
    let runs = 0

    scheduler.start({
      id: 'resume',
      owner: 'module',
      intervalMs: 1000,
      run: async () => {
        runs += 1
      }
    })

    await vi.advanceTimersByTimeAsync(500)
    scheduler.handleResume()

    await vi.advanceTimersByTimeAsync(999)
    expect(runs).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(runs).toBe(1)

    scheduler.stopAll()
  })

  it('stops all tasks belonging to one module', async () => {
    const scheduler = new TaskScheduler()

    scheduler.start({ id: 'a', owner: 'dates', intervalMs: 100, run: async () => {} })
    scheduler.start({ id: 'b', owner: 'dates', intervalMs: 100, run: async () => {} })
    scheduler.start({ id: 'c', owner: 'gmail', intervalMs: 100, run: async () => {} })

    scheduler.stopByOwner('dates')
    expect(scheduler.getTaskIds()).toEqual(['c'])

    scheduler.stopAll()
  })

  it('rejects duplicate task ids and invalid intervals', () => {
    const scheduler = new TaskScheduler()
    scheduler.start({ id: 'x', owner: 'm', intervalMs: 100, run: async () => {} })

    expect(() =>
      scheduler.start({ id: 'x', owner: 'm', intervalMs: 100, run: async () => {} })
    ).toThrow()
    expect(() =>
      scheduler.start({ id: 'y', owner: 'm', intervalMs: 0, run: async () => {} })
    ).toThrow()

    scheduler.stopAll()
  })
})
