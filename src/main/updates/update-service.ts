import type { UpdateStatus } from '../../shared/api'

export interface UpdateAdapter {
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  quitAndInstall(): void
  onChecking(listener: () => void): void
  onAvailable(listener: (version: string) => void): void
  onNotAvailable(listener: () => void): void
  onProgress(listener: (percent: number) => void): void
  onDownloaded(listener: (version: string) => void): void
  onError(listener: (message: string) => void): void
}

export interface UpdateServiceOptions {
  adapter: UpdateAdapter | null
  supported: boolean
  unsupportedMessage: string
  onError?: (message: string) => void
}

const ERROR_MESSAGE = '更新失败，请稍后重试或手动下载新版本。'

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(value)))
}

export class UpdateService {
  private readonly listeners = new Set<(status: UpdateStatus) => void>()
  private readonly adapter: UpdateAdapter | null
  private readonly active: boolean
  private status: UpdateStatus

  constructor(private readonly options: UpdateServiceOptions) {
    this.adapter = options.adapter
    this.active = options.supported && options.adapter !== null
    this.status = this.active
      ? { state: 'idle', version: null, percent: null, message: null }
      : {
          state: 'unsupported',
          version: null,
          percent: null,
          message: options.unsupportedMessage
        }

    if (this.active && this.adapter) {
      this.adapter.onChecking(() => {
        this.set({ state: 'checking', version: null, percent: null, message: null })
      })
      this.adapter.onAvailable((version) => {
        this.set({ state: 'available', version, percent: null, message: null })
      })
      this.adapter.onNotAvailable(() => {
        this.set({ state: 'not-available', version: null, percent: null, message: null })
      })
      this.adapter.onProgress((percent) => {
        this.set({
          state: 'downloading',
          version: this.status.version,
          percent: clampPercent(percent),
          message: null
        })
      })
      this.adapter.onDownloaded((version) => {
        this.set({ state: 'downloaded', version, percent: 100, message: null })
      })
      this.adapter.onError((message) => {
        this.options.onError?.(message)
        this.fail()
      })
    }
  }

  getStatus(): UpdateStatus {
    return { ...this.status }
  }

  onChange(listener: (status: UpdateStatus) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async check(): Promise<UpdateStatus> {
    if (!this.active || !this.adapter) {
      return this.getStatus()
    }
    if (this.status.state === 'checking' || this.status.state === 'downloading') {
      return this.getStatus()
    }
    this.set({ state: 'checking', version: null, percent: null, message: null })
    try {
      await this.adapter.checkForUpdates()
    } catch (error) {
      this.options.onError?.(String(error))
      this.fail()
    }
    return this.getStatus()
  }

  async download(): Promise<UpdateStatus> {
    if (!this.active || !this.adapter || this.status.state !== 'available') {
      return this.getStatus()
    }
    this.set({
      state: 'downloading',
      version: this.status.version,
      percent: 0,
      message: null
    })
    try {
      await this.adapter.downloadUpdate()
    } catch (error) {
      this.options.onError?.(String(error))
      this.fail()
    }
    return this.getStatus()
  }

  install(): void {
    if (!this.active || !this.adapter || this.status.state !== 'downloaded') {
      return
    }
    this.adapter.quitAndInstall()
  }

  private fail(): void {
    this.set({
      state: 'error',
      version: this.status.version,
      percent: null,
      message: ERROR_MESSAGE
    })
  }

  private set(status: UpdateStatus): void {
    this.status = status
    for (const listener of this.listeners) {
      listener(this.getStatus())
    }
  }
}
