import { describe, expect, it, vi } from 'vitest'
import { createBridge, type IpcBridge } from '../../src/preload/api'
import { IPC_CHANNELS } from '../../src/shared/api'

function createFakeBridge() {
  const invocations: Array<{ channel: string; args: unknown[] }> = []
  const subscriptions: Array<{
    channel: string
    listener: (payload: unknown) => void
    unsubscribe: () => void
  }> = []

  const bridge: IpcBridge = {
    invoke: async (channel, ...args) => {
      invocations.push({ channel, args })
      return { ok: true }
    },
    on: (channel, listener) => {
      const unsubscribe = vi.fn()
      subscriptions.push({ channel, listener, unsubscribe })
      return unsubscribe
    }
  }

  return { bridge, invocations, subscriptions }
}

describe('preload bridge surface', () => {
  it('exposes only the pet api in the pet window', () => {
    const { bridge } = createFakeBridge()
    const exposed = createBridge('pet', bridge)

    expect(exposed?.key).toBe('petApi')
    expect(Object.keys(exposed?.value ?? {}).sort()).toEqual([
      'beginDrag',
      'dragMove',
      'endDrag',
      'getState',
      'onStateChanged',
      'openMenu'
    ])
  })

  it('exposes only the settings api in the settings window', () => {
    const { bridge } = createFakeBridge()
    const exposed = createBridge('settings', bridge)

    expect(exposed?.key).toBe('settingsApi')
    expect(Object.keys(exposed?.value ?? {}).sort()).toEqual([
      'addMemoImage',
      'checkAllWebsites',
      'checkForUpdates',
      'checkWebsite',
      'clearDeepSeekKey',
      'clearEsaCredentials',
      'completeMemo',
      'createIntervalReminder',
      'createMemo',
      'createWebsiteCheck',
      'deleteIntervalReminder',
      'deleteMemo',
      'deletePetImage',
      'deleteWebsiteCheck',
      'discardMemoImages',
      'downloadUpdate',
      'fetchDeepSeekBalance',
      'fetchEsaTraffic',
      'getAppInfo',
      'getConfig',
      'getModules',
      'getSecurityStatus',
      'getStartupNotice',
      'getUpdateStatus',
      'importPetImage',
      'installUpdate',
      'listIntervalReminders',
      'listMemos',
      'listPetImages',
      'listWebsiteChecks',
      'onMemosChanged',
      'onNavigate',
      'onOpenMemoComposer',
      'onUpdateStatus',
      'openExternal',
      'renamePetImage',
      'resetPetPosition',
      'saveAppSettings',
      'saveDeepSeekKey',
      'saveEsaCredentials',
      'savePetSettings',
      'selectPetAsset',
      'setEsaDisplayRanges',
      'setIntervalReminderEnabled',
      'setMemoAnchorNew',
      'setMemoAnchored',
      'setModuleEnabled',
      'setModuleRefreshInterval',
      'setWebsiteCheckEnabled',
      'settingsUiReady',
      'uncompleteMemo',
      'updateIntervalReminder',
      'updateMemo',
      'updateWebsiteCheck'
    ])
  })

  it('exposes narrow apis for the menu and bubble windows', () => {
    const { bridge } = createFakeBridge()
    expect(createBridge('menu', bridge)?.key).toBe('menuApi')
    expect(createBridge('bubble', bridge)?.key).toBe('bubbleApi')
    expect(createBridge('memo-card', bridge)?.key).toBe('memoCardApi')
  })

  it('forwards menu presentation calls', async () => {
    const { bridge, invocations, subscriptions } = createFakeBridge()
    const menu = createBridge('menu', bridge)?.value as {
      ready(): Promise<unknown>
      opened(): Promise<void>
      openFunctions(): Promise<void>
      onPresentation(callback: (presentation: unknown) => void): () => void
    }

    await menu.ready()
    expect(invocations[0]).toEqual({ channel: IPC_CHANNELS.menuReady, args: [] })

    await menu.opened()
    expect(invocations[1]).toEqual({ channel: IPC_CHANNELS.menuOpened, args: [] })

    await menu.openFunctions()
    expect(invocations[2]).toEqual({ channel: IPC_CHANNELS.menuOpenFunctions, args: [] })

    const received: unknown[] = []
    menu.onPresentation((presentation) => received.push(presentation))
    expect(subscriptions[0]?.channel).toBe(IPC_CHANNELS.menuPresentation)
    subscriptions[0]?.listener({ phase: 'open', placement: 'above', token: 1 })
    expect(received).toEqual([{ phase: 'open', placement: 'above', token: 1 }])
  })

  it('forwards memo card lock, composer, and mouse-through calls', async () => {
    const { bridge, invocations } = createFakeBridge()
    const card = createBridge('memo-card', bridge)?.value as {
      setLocked(id: string, locked: boolean): Promise<void>
      openComposer(): Promise<void>
      setIgnoreMouse(id: string, ignore: boolean): Promise<void>
    }
    const id = '3f1c2a56-8b9d-4a1e-9f0c-123456789abc'

    await card.setLocked(id, true)
    expect(invocations[0]).toEqual({
      channel: IPC_CHANNELS.memosSetLocked,
      args: [{ id, locked: true }]
    })

    await card.openComposer()
    expect(invocations[1]).toEqual({ channel: IPC_CHANNELS.memoCardOpenComposer, args: [] })

    await card.setIgnoreMouse(id, false)
    expect(invocations[2]).toEqual({
      channel: IPC_CHANNELS.memoCardSetIgnoreMouse,
      args: [{ id, ignore: false }]
    })
  })

  it('refuses unknown views', () => {
    const { bridge } = createFakeBridge()
    expect(createBridge('devtools', bridge)).toBeNull()
    expect(createBridge('', bridge)).toBeNull()
  })

  it('does not leak Node.js or Electron primitives', () => {
    const { bridge } = createFakeBridge()
    for (const view of ['pet', 'menu', 'bubble', 'settings', 'memo-card']) {
      const value = createBridge(view, bridge)?.value as Record<string, unknown>
      for (const name of ['ipcRenderer', 'require', 'process', 'fs', 'shell', 'invoke', 'on']) {
        expect(name in value).toBe(false)
      }
    }
  })

  it('uses fixed channels and forwards only the declared arguments', async () => {
    const { bridge, invocations } = createFakeBridge()
    const pet = createBridge('pet', bridge)?.value as {
      openMenu(): Promise<void>
      getState(): Promise<unknown>
    }

    await pet.openMenu()
    expect(invocations[0]).toEqual({ channel: IPC_CHANNELS.petOpenMenu, args: [] })

    await pet.getState()
    expect(invocations[1]?.channel).toBe(IPC_CHANNELS.petGetState)
    expect(invocations[1]?.args).toEqual([])
  })

  it('passes settings patches through the fixed channel', async () => {
    const { bridge, invocations } = createFakeBridge()
    const settings = createBridge('settings', bridge)?.value as {
      saveAppSettings(patch: { alwaysOnTop: boolean }): Promise<unknown>
    }

    await settings.saveAppSettings({ alwaysOnTop: true })
    expect(invocations).toEqual([
      { channel: IPC_CHANNELS.settingsSaveApp, args: [{ alwaysOnTop: true }] }
    ])
  })

  it('passes pet image list, selection and deletion through fixed channels', async () => {
    const { bridge, invocations } = createFakeBridge()
    const settings = createBridge('settings', bridge)?.value as {
      listPetImages(): Promise<unknown>
      selectPetAsset(assetId: string): Promise<unknown>
      deletePetImage(assetId: string): Promise<unknown>
      renamePetImage(assetId: string, name: string): Promise<unknown>
    }
    const assetId = '3f1c2a56-8b9d-4a1e-9f0c-123456789abc'

    await settings.listPetImages()
    await settings.selectPetAsset('preset-cat-pair')
    await settings.selectPetAsset(assetId)
    await settings.deletePetImage(assetId)
    await settings.renamePetImage(assetId, '小棕')
    expect(invocations).toEqual([
      { channel: IPC_CHANNELS.settingsListPetImages, args: [] },
      {
        channel: IPC_CHANNELS.settingsSelectPetAsset,
        args: [{ assetId: 'preset-cat-pair' }]
      },
      { channel: IPC_CHANNELS.settingsSelectPetAsset, args: [{ assetId }] },
      { channel: IPC_CHANNELS.settingsDeletePetImage, args: [{ assetId }] },
      { channel: IPC_CHANNELS.settingsRenamePetImage, args: [{ assetId, name: '小棕' }] }
    ])
  })

  it('subscribes and unsubscribes to main-process pushes', () => {
    const { bridge, subscriptions } = createFakeBridge()
    const pet = createBridge('pet', bridge)?.value as {
      onStateChanged(callback: (state: unknown) => void): () => void
    }
    const received: unknown[] = []

    const unsubscribe = pet.onStateChanged((state) => received.push(state))
    expect(subscriptions[0]?.channel).toBe(IPC_CHANNELS.petStateChanged)

    subscriptions[0]?.listener({ bounceAnimation: false })
    expect(received).toEqual([{ bounceAnimation: false }])

    unsubscribe()
    expect(subscriptions[0]?.unsubscribe).toHaveBeenCalledOnce()
  })
})
