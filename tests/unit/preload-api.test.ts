import { describe, expect, it, vi } from 'vitest'
import { createPetApi } from '../../src/preload/api'
import { IPC_CHANNELS } from '../../src/shared/api'

describe('preload bridge surface', () => {
  it('exposes exactly the declared methods', () => {
    const api = createPetApi({ invoke: vi.fn() })
    expect(Object.keys(api).sort()).toEqual(['getAppInfo'])
  })

  it('uses the fixed app info channel and passes no extra arguments', async () => {
    const invoke = vi.fn().mockResolvedValue({ version: '0.1.0' })
    const api = createPetApi({ invoke })

    await api.getAppInfo()

    expect(invoke).toHaveBeenCalledTimes(1)
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.appInfo)
    expect(invoke.mock.calls[0]).toHaveLength(1)
  })

  it('does not leak Node.js or Electron primitives', () => {
    const api = createPetApi({ invoke: vi.fn() }) as unknown as Record<string, unknown>

    for (const name of ['ipcRenderer', 'require', 'process', 'fs', 'shell', 'invoke']) {
      expect(name in api).toBe(false)
    }
  })

  it('propagates rejections instead of hiding them', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('UNTRUSTED_SENDER'))
    const api = createPetApi({ invoke })

    await expect(api.getAppInfo()).rejects.toThrow('UNTRUSTED_SENDER')
  })
})
