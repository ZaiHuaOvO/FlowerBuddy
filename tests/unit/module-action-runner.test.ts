import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModuleActionRunner } from '../../src/main/actions/module-action-runner'
import { AppError } from '../../src/main/shared/errors'
import type { BubblePayload, ModuleActionResult } from '../../src/shared/api'

function createHarness(
  runAction: (actionId: string) => Promise<ModuleActionResult> = async () => ({
    state: 'success',
    message: '完成'
  })
) {
  const presenter = {
    showBubble: vi.fn((payload: BubblePayload) => {
      void payload
      return Promise.resolve()
    }),
    dismissBubble: vi.fn()
  }
  const moduleManager = {
    getAction: vi.fn(() => ({ action: { loadingMessage: '加载中' } })),
    runAction: vi.fn(runAction)
  }
  const runner = new ModuleActionRunner({
    moduleManager,
    presenter,
    isPetVisible: () => true
  })
  return { runner, presenter, moduleManager }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ModuleActionRunner', () => {
  it('shows loading then the action result', async () => {
    const { runner, presenter } = createHarness()

    await runner.run('website-check:run-all')

    expect(presenter.showBubble).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ state: 'loading', message: '加载中', autoHide: false })
    )
    expect(presenter.showBubble).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ state: 'success', message: '完成' })
    )
    expect(presenter.dismissBubble).not.toHaveBeenCalled()
  })

  it('shows an error bubble when the action fails', async () => {
    const { runner, presenter } = createHarness(async () => {
      throw new AppError('REMOTE_SERVICE_ERROR', 'action failed')
    })

    await runner.run('website-check:run-all')

    expect(presenter.showBubble).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'error', message: 'action failed' })
    )
  })

  it('shows an error bubble when the action id is unknown', async () => {
    const { runner, presenter, moduleManager } = createHarness()
    moduleManager.getAction.mockImplementation(() => {
      throw new AppError('UNKNOWN_ACTION', 'unknown action')
    })

    await runner.run('missing')

    expect(moduleManager.runAction).not.toHaveBeenCalled()
    expect(presenter.showBubble).toHaveBeenCalledTimes(1)
    expect(presenter.showBubble.mock.calls[0]?.[0]).toMatchObject({ state: 'error' })
  })

  it('times out and ignores a late action result', async () => {
    let resolveAction: ((result: ModuleActionResult) => void) | undefined
    const { runner, presenter } = createHarness(
      () =>
        new Promise<ModuleActionResult>((resolve) => {
          resolveAction = resolve
        })
    )

    const pending = runner.run('website-check:run-all')
    await vi.advanceTimersByTimeAsync(0)
    expect(presenter.showBubble).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(45000)
    expect(presenter.showBubble).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'error', message: '请求超时，请稍后重试' })
    )

    resolveAction?.({ state: 'success', message: 'late' })
    await pending
    expect(presenter.showBubble).toHaveBeenCalledTimes(2)
  })

  it('dismisses the previous bubble when a new action starts', async () => {
    let resolveFirst: ((result: ModuleActionResult) => void) | undefined
    let calls = 0
    const { runner, presenter } = createHarness(() => {
      calls += 1
      if (calls === 1) {
        return new Promise<ModuleActionResult>((resolve) => {
          resolveFirst = resolve
        })
      }
      return Promise.resolve({ state: 'success', message: 'second' })
    })

    const pending = runner.run('website-check:run-all')
    await vi.advanceTimersByTimeAsync(0)
    const firstRequestId = presenter.showBubble.mock.calls[0]?.[0]?.requestId

    const second = runner.run('website-check:run-all')
    await vi.advanceTimersByTimeAsync(0)
    expect(presenter.dismissBubble).toHaveBeenCalledWith(firstRequestId)

    resolveFirst?.({ state: 'success', message: 'late' })
    await pending
    await second
  })

  it('ignores an in-flight result after the bubble is dismissed', async () => {
    let resolveAction: ((result: ModuleActionResult) => void) | undefined
    const { runner, presenter } = createHarness(
      () =>
        new Promise<ModuleActionResult>((resolve) => {
          resolveAction = resolve
        })
    )

    const pending = runner.run('website-check:run-all')
    await vi.advanceTimersByTimeAsync(0)
    const requestId = presenter.showBubble.mock.calls[0]?.[0]?.requestId
    runner.dismiss(requestId as string)

    resolveAction?.({ state: 'success', message: 'late' })
    await pending
    expect(presenter.showBubble).toHaveBeenCalledTimes(1)
  })

  it('does not show a background bubble while hidden or while an action runs', async () => {
    const hidden = createHarness()
    const hiddenRunner = new ModuleActionRunner({
      moduleManager: hidden.moduleManager,
      presenter: hidden.presenter,
      isPetVisible: () => false
    })
    await hiddenRunner.showBackground('mail')
    expect(hidden.presenter.showBubble).not.toHaveBeenCalled()

    const visible = createHarness()
    await visible.runner.showBackground('mail')
    expect(visible.presenter.showBubble).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'success', message: 'mail' })
    )
  })

  it('marks persistent background bubbles so the renderer keeps them', async () => {
    const { runner, presenter } = createHarness()

    await runner.showPersistentBackground('备忘提醒')
    expect(presenter.showBubble).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'success', message: '备忘提醒', persistent: true })
    )
  })

  it('reuses a supplied id so repeated reminders update one bubble', async () => {
    const { runner, presenter } = createHarness()

    await runner.showPersistentBackground('该喝水啦！', 'interval-reminder:r1')
    await runner.showPersistentBackground('该喝水啦！', 'interval-reminder:r1')

    expect(presenter.showBubble.mock.calls[0]?.[0]?.requestId).toBe('interval-reminder:r1')
    expect(presenter.showBubble.mock.calls[1]?.[0]?.requestId).toBe('interval-reminder:r1')
  })
})
