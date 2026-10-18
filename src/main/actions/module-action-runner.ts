import { randomUUID } from 'node:crypto'
import type { BubblePayload, ModuleActionResult } from '../../shared/api'
import { toPublicError } from '../shared/errors'

const MODULE_ACTION_TIMEOUT_MS = 45000

export interface BubblePresenter {
  showBubble(payload: BubblePayload): Promise<void>
  dismissBubble(id: string): void
}

export interface ModuleActionSource {
  getAction(actionId: string): { action: { loadingMessage: string } }
  runAction(actionId: string): Promise<ModuleActionResult>
}

export interface ModuleActionRunnerOptions {
  moduleManager: ModuleActionSource
  presenter: BubblePresenter
  isPetVisible: () => boolean
}

/**
 * Owns the request id and timeout for menu actions. The bubble presenter keeps
 * the visible stack and handles per-bubble auto-hide.
 */
export class ModuleActionRunner {
  private currentRequestId: string | null = null
  private safetyTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly options: ModuleActionRunnerOptions) {}

  async run(actionId: string): Promise<void> {
    this.clearSafetyTimer()
    if (this.currentRequestId) {
      this.options.presenter.dismissBubble(this.currentRequestId)
    }
    const requestId = randomUUID()
    this.currentRequestId = requestId

    let loadingMessage: string
    try {
      loadingMessage = this.options.moduleManager.getAction(actionId).action.loadingMessage
    } catch (error) {
      const publicError = toPublicError(error)
      await this.showBubble({ state: 'error', message: publicError.message, requestId })
      return
    }

    await this.showBubble({
      state: 'loading',
      message: loadingMessage,
      requestId,
      autoHide: false
    })
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
    }, MODULE_ACTION_TIMEOUT_MS)

    try {
      const result = await this.options.moduleManager.runAction(actionId)
      if (this.currentRequestId !== requestId) {
        return
      }
      this.clearSafetyTimer()
      await this.showBubble({
        state: result.state,
        message: result.message,
        requestId,
        ...(result.emphasis ? { emphasis: result.emphasis } : {})
      })
    } catch (error) {
      if (this.currentRequestId !== requestId) {
        return
      }
      this.clearSafetyTimer()
      const publicError = toPublicError(error)
      await this.showBubble({ state: 'error', message: publicError.message, requestId })
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
  }

  async showPersistentBackground(message: string, id?: string): Promise<void> {
    await this.showBubble({
      state: 'success',
      message,
      requestId: id ?? randomUUID(),
      persistent: true
    })
  }

  /** A manually dismissed bubble must not be revived by a late result. */
  dismiss(id: string): void {
    if (this.currentRequestId === id) {
      this.currentRequestId = null
      this.clearSafetyTimer()
    }
  }

  dispose(): void {
    this.clearSafetyTimer()
  }

  private showBubble(payload: BubblePayload): Promise<void> {
    return this.options.presenter.showBubble(payload)
  }

  private clearSafetyTimer(): void {
    if (this.safetyTimer !== null) {
      clearTimeout(this.safetyTimer)
      this.safetyTimer = null
    }
  }
}
