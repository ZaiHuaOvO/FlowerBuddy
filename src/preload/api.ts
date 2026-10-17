import {
  IPC_CHANNELS,
  isWindowView,
  type AppInfo,
  type AppSettingsPatch,
  type BubbleApi,
  type BubblePayload,
  type MenuApi,
  type ModuleId,
  type ModuleSummary,
  type PetApi,
  type PetSettingsPatch,
  type PetViewState,
  type PublicConfig,
  type SecurityStatus,
  type SettingsApi,
  type WindowView
} from '../shared/api'

/** The only part of ipcRenderer the bridge may use. */
export interface IpcBridge {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
  on(channel: string, listener: (payload: unknown) => void): () => void
}

export interface ExposedBridge {
  key: string
  value: object
}

const BRIDGE_KEYS = {
  pet: 'petApi',
  menu: 'menuApi',
  bubble: 'bubbleApi',
  settings: 'settingsApi'
} as const

export function createBridge(view: string, ipc: IpcBridge): ExposedBridge | null {
  if (!isWindowView(view)) {
    return null
  }
  return { key: BRIDGE_KEYS[view], value: createApi(view, ipc) }
}

function createApi(view: WindowView, ipc: IpcBridge): object {
  switch (view) {
    case 'pet':
      return createPetApi(ipc)
    case 'menu':
      return createMenuApi(ipc)
    case 'bubble':
      return createBubbleApi(ipc)
    case 'settings':
      return createSettingsApi(ipc)
  }
}

function createPetApi(ipc: IpcBridge): PetApi {
  return {
    getState: async () => (await ipc.invoke(IPC_CHANNELS.petGetState)) as PetViewState,
    beginDrag: async () => {
      await ipc.invoke(IPC_CHANNELS.petBeginDrag)
    },
    dragMove: async () => {
      await ipc.invoke(IPC_CHANNELS.petDragMove)
    },
    endDrag: async () => {
      await ipc.invoke(IPC_CHANNELS.petEndDrag)
    },
    openMenu: async () => {
      await ipc.invoke(IPC_CHANNELS.petOpenMenu)
    },
    onStateChanged: (callback) =>
      ipc.on(IPC_CHANNELS.petStateChanged, (payload) => callback(payload as PetViewState))
  }
}

function createMenuApi(ipc: IpcBridge): MenuApi {
  return {
    runAction: async (actionId: string) => {
      await ipc.invoke(IPC_CHANNELS.menuRunAction, actionId)
    },
    openSettings: async () => {
      await ipc.invoke(IPC_CHANNELS.menuOpenSettings)
    },
    hidePet: async () => {
      await ipc.invoke(IPC_CHANNELS.menuHidePet)
    },
    quit: async () => {
      await ipc.invoke(IPC_CHANNELS.menuQuit)
    },
    close: async () => {
      await ipc.invoke(IPC_CHANNELS.menuClose)
    }
  }
}

function createBubbleApi(ipc: IpcBridge): BubbleApi {
  return {
    onUpdate: (callback) =>
      ipc.on(IPC_CHANNELS.bubbleUpdate, (payload) => callback(payload as BubblePayload)),
    dismiss: async () => {
      await ipc.invoke(IPC_CHANNELS.bubbleDismiss)
    }
  }
}

function createSettingsApi(ipc: IpcBridge): SettingsApi {
  return {
    getAppInfo: async () => (await ipc.invoke(IPC_CHANNELS.appInfo)) as AppInfo,
    getConfig: async () => (await ipc.invoke(IPC_CHANNELS.configGet)) as PublicConfig,
    saveAppSettings: async (patch: AppSettingsPatch) =>
      (await ipc.invoke(IPC_CHANNELS.settingsSaveApp, patch)) as PublicConfig,
    savePetSettings: async (patch: PetSettingsPatch) =>
      (await ipc.invoke(IPC_CHANNELS.settingsSavePet, patch)) as PublicConfig,
    importPetImage: async () =>
      (await ipc.invoke(IPC_CHANNELS.settingsImportPet)) as PublicConfig | null,
    resetPetPosition: async () =>
      (await ipc.invoke(IPC_CHANNELS.settingsResetPosition)) as PublicConfig,
    getModules: async () => (await ipc.invoke(IPC_CHANNELS.modulesList)) as ModuleSummary[],
    setModuleEnabled: async (moduleId: ModuleId, enabled: boolean) =>
      (await ipc.invoke(IPC_CHANNELS.modulesSetEnabled, {
        moduleId,
        enabled
      })) as ModuleSummary[],
    getSecurityStatus: async () =>
      (await ipc.invoke(IPC_CHANNELS.securityStatus)) as SecurityStatus,
    getStartupNotice: async () => (await ipc.invoke(IPC_CHANNELS.startupNotice)) as string | null
  }
}
