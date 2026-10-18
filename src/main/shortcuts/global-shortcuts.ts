import { globalShortcut } from 'electron'

/** Registers one global shortcut at a time and restores the previous one on conflict. */
export class GlobalShortcutManager {
  private current: string | null = null
  private callback: (() => void) | null = null

  register(accelerator: string, callback: () => void): boolean {
    const next = accelerator.trim()
    if (next === this.current) {
      this.callback = callback
      return true
    }

    const previous = this.current
    const previousCallback = this.callback
    this.unregisterCurrent()
    this.callback = callback

    if (!next) {
      return true
    }

    let registered: boolean
    try {
      registered = globalShortcut.register(next, callback)
    } catch {
      registered = false
    }
    if (registered) {
      this.current = next
      return true
    }

    if (previous && previousCallback) {
      try {
        if (globalShortcut.register(previous, previousCallback)) {
          this.current = previous
          this.callback = previousCallback
        } else {
          this.current = null
          this.callback = null
        }
      } catch {
        this.current = null
        this.callback = null
      }
    }
    return false
  }

  dispose(): void {
    this.unregisterCurrent()
    this.callback = null
  }

  private unregisterCurrent(): void {
    if (!this.current) {
      return
    }
    try {
      globalShortcut.unregister(this.current)
    } catch {
      // Best effort.
    }
    this.current = null
  }
}
