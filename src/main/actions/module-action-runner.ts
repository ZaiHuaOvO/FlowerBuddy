import { randomUUID } from 'node:crypto'
import type { BubblePayload, ModuleActionResult } from '../../shared/api'
import { toPublicError } from '../shared/errors'

const MODULE_ACTION_TIMEOUT_MS = 45000

export interface BubblePresenter {
  showBubble(payload: BubblePayload): Promise<void>
  hideBubble(): void
}

export interface ModuleActionSource {
  getAction(actionId: string): { action: { loadingMessage: string } }
  runAction(actionId: string): Promise<ModuleActionResult>
}

export interface ModuleActionRunnerOptions {
  moduleManager: ModuleActionSource
  presenter: BubblePresenter
  getBubbleDurationMs: () => number
  isPetVisible: () => boolean
}

/**
 * Owns the request id, timeout and hide timers for menu actions and the
 * background bubble. A newer request always invalidates an older result.
 */
export class ModuleActionRunner {
  private currentRequestId: string | null = null
  private safetyTimer: ReturnType<typeof setTimeout> | null = null
  private hideTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: ModuleActionRunnerOptions) {}

  async run(actionId: string): Promise<void> {
    this.clearTimers()
    const requestId = randomUUID()
    this.currentRequestId = requestId

    let loadingMessage: string
    try {
      loadingMessage = this.options.moduleManager.getAction(actionId).action.loadingMessage
    } catch (error) {
      const publicError = toPublicError(error)
      await this.showBubble({ state: 'error', message: publicError.message, requestId })
      this.scheduleBubbleHide()
      return
    }

    await this.showBubble({ state: 'loading', message: loadingMessage, requestId })
    if (this.currentRequestId !== requestId) {
      return
    }

    this.safetyTimer = setTimeout(() => {
      this.safetyTimer = null
      if (this.currentRequestId !== requestId) {
        return
      }
      this.currentRequestId = null
      void this.showBubble({
        state: 'error',
        message: '请求超时，请稍后重试',
        requestId
      })
      this.scheduleBubbleHide()
    }, MODULE_ACTION_TIMEOUT_MS)

    try {
      const result = await this.options.moduleManager.runAction(actionId)
      if (this.currentRequestId !== requestId) {
        return
      }
      this.clearSafetyTimer()
      await this.showBubble({ state: result.state, message: result.message, requestId })
      this.scheduleBubbleHide()
    } catch (error) {
      if (this.currentRequestId !== requestId) {
        return
      }
      this.clearSafetyTimer()
      const publicError = toPublicError(error)
      await this.showBubble({ state: 'error', message: publicError.message, requestId })
      this.scheduleBubbleHide()
    }
  }

  async showBackground(message: string): Promise<void> {
    if (this.currentRequestId !== null || !this.options.isPetVisible()) {
      return
    }
    await this.showBubble({
      state: 'success',
      message,
      requestId: randomUUID()
    })
    this.scheduleBubbleHide()
  }

  dismiss(): void {
    this.currentRequestId = null
    this.clearTimers()
    this.options.presenter.hideBubble()
  }

  dispose(): void {
    this.clearTimers()
  }

  private showBubble(payload: BubblePayload): Promise<void> {
    return this.options.presenter.showBubble(payload)
  }

  private scheduleBubbleHide(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer)
    }
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null
      this.options.presenter.hideBubble()
      this.currentRequestId = null
    }, this.options.getBubbleDurationMs())
  }

  private clearSafetyTimer(): void {
    if (this.safetyTimer !== null) {
      clearTimeout(this.safetyTimer)
      this.safetyTimer = null
    }
  }

  private clearTimers(): void {
    this.clearSafetyTimer()
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer)
      this.hideTimer = null
    }
  }
}
