import { describe, expect, it, vi } from 'vitest'
import { UpdateService, type UpdateAdapter } from '../../src/main/updates/update-service'

function createAdapter() {
  const calls = { check: 0, download: 0, install: 0 }
  const listeners: {
    checking: () => void
    available: (version: string) => void
    notAvailable: () => void
    progress: (percent: number) => void
    downloaded: (version: string) => void
    error: (message: string) => void
  } = {
    checking: vi.fn(),
    available: vi.fn(),
    notAvailable: vi.fn(),
    progress: vi.fn(),
    downloaded: vi.fn(),
    error: vi.fn()
  }
  const adapter: UpdateAdapter = {
    checkForUpdates: async () => {
      calls.check += 1
    },
    downloadUpdate: async () => {
      calls.download += 1
    },
    quitAndInstall: () => {
      calls.install += 1
    },
    onChecking: (listener) => {
      listeners.checking = listener
    },
    onAvailable: (listener) => {
      listeners.available = listener
    },
    onNotAvailable: (listener) => {
      listeners.notAvailable = listener
    },
    onProgress: (listener) => {
      listeners.progress = listener
    },
    onDownloaded: (listener) => {
      listeners.downloaded = listener
    },
    onError: (listener) => {
      listeners.error = listener
    }
  }
  return { adapter, listeners, calls }
}

describe('update service', () => {
  it('stays unsupported when the platform cannot update', async () => {
    const service = new UpdateService({
      adapter: null,
      supported: false,
      unsupportedMessage: '便携版请手动下载新版本。'
    })

    expect(service.getStatus()).toMatchObject({
      state: 'unsupported',
      message: '便携版请手动下载新版本。'
    })
    await service.check()
    expect(service.getStatus().state).toBe('unsupported')
  })

  it('moves from checking to available, downloads, and installs', async () => {
    const { adapter, listeners, calls } = createAdapter()
    const service = new UpdateService({
      adapter,
      supported: true,
      unsupportedMessage: ''
    })

    const changes: string[] = []
    service.onChange((status) => changes.push(status.state))

    await service.check()
    expect(calls.check).toBe(1)
    expect(service.getStatus().state).toBe('checking')

    listeners.available('0.2.0')
    expect(service.getStatus()).toMatchObject({ state: 'available', version: '0.2.0' })

    const downloading = service.download()
    expect(service.getStatus()).toMatchObject({ state: 'downloading', percent: 0 })
    listeners.progress(42)
    expect(service.getStatus()).toMatchObject({ state: 'downloading', percent: 42 })
    listeners.downloaded('0.2.0')
    await downloading
    expect(service.getStatus()).toMatchObject({
      state: 'downloaded',
      version: '0.2.0',
      percent: 100
    })
    expect(calls.download).toBe(1)

    service.install()
    expect(calls.install).toBe(1)
    expect(changes).toContain('available')
    expect(changes).toContain('downloaded')
  })

  it('reports errors and refuses to install before a download', () => {
    const { adapter, listeners, calls } = createAdapter()
    const errors: string[] = []
    const service = new UpdateService({
      adapter,
      supported: true,
      unsupportedMessage: '',
      onError: (message) => errors.push(message)
    })

    service.install()
    expect(calls.install).toBe(0)

    listeners.error('network down')
    expect(errors).toEqual(['network down'])
    expect(service.getStatus().state).toBe('error')
    expect(service.getStatus().message).toContain('手动下载')
  })
})
