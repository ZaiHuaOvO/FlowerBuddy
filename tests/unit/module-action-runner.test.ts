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
    hideBubble: vi.fn()
  }
  const moduleManager = {
    getAction: vi.fn(() => ({ action: { loadingMessage: '加载中' } })),
    runAction: vi.fn(runAction)
  }
  const runner = new ModuleActionRunner({
    moduleManager,
    presenter,
    getBubbleDurationMs: () => 5000,
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
  it('shows loading then the action result and hides after the duration', async () => {
    const { runner, presenter } = createHarness()

    await runner.run('dates:upcoming')

    expect(presenter.showBubble).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ state: 'loading', message: '加载中' })
    )
    expect(presenter.showBubble).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ state: 'success', message: '完成' })
    )
    expect(presenter.hideBubble).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5000)
    expect(presenter.hideBubble).toHaveBeenCalledTimes(1)
  })

  it('shows an error bubble when the action fails', async () => {
    const { runner, presenter } = createHarness(async () => {
      throw new AppError('REMOTE_SERVICE_ERROR', 'action failed')
    })

    await runner.run('dates:upcoming')

    expect(presenter.showBubble).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: 'error', message: 'action failed' })
    )
    await vi.advanceTimersByTimeAsync(5000)
    expect(presenter.hideBubble).toHaveBeenCalledTimes(1)
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

    const pending = runner.run('dates:upcoming')
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

  it('dismiss cancels timers and ignores an in-flight result', async () => {
    let resolveAction: ((result: ModuleActionResult) => void) | undefined
    const { runner, presenter } = createHarness(
      () =>
        new Promise<ModuleActionResult>((resolve) => {
          resolveAction = resolve
        })
    )

    const pending = runner.run('dates:upcoming')
    await vi.advanceTimersByTimeAsync(0)
    runner.dismiss()
    expect(presenter.hideBubble).toHaveBeenCalledTimes(1)

    resolveAction?.({ state: 'success', message: 'late' })
    await pending
    expect(presenter.showBubble).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60000)
    expect(presenter.hideBubble).toHaveBeenCalledTimes(1)
  })

  it('does not show a background bubble while hidden or while an action runs', async () => {
    const hidden = createHarness()
    hidden.runner = new ModuleActionRunner({
      moduleManager: hidden.moduleManager,
      presenter: hidden.presenter,
      getBubbleDurationMs: () => 5000,
      isPetVisible: () => false
    })
    await hidden.runner.showBackground('mail')
    expect(hidden.presenter.showBubble).not.toHaveBeenCalled()

    const visible = createHarness()
    await visible.runner.showBackground('mail')
    expect(visible.presenter.showBubble).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'success', message: 'mail' })
    )
  })
})
