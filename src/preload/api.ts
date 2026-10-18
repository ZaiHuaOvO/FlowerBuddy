import {
  IPC_CHANNELS,
  isWindowView,
  type AppInfo,
  type AppSettingsPatch,
  type BubbleApi,
  type BubbleStackPayload,
  type MemoCardApi,
  type MemoCardEdge,
  type MemoCardState,
  type MemoImageInfo,
  type MemoInput,
  type MemoPatch,
  type MemoSummary,
  type DeepSeekBalance,
  type EsaCredentialsInput,
  type EsaTraffic,
  type GmailPollSummary,
  type GmailSettingsPatch,
  type GmailStateView,
  type MenuActionSummary,
  type MenuApi,
  type MenuPresentation,
  type ModuleId,
  type ModuleSummary,
  type PetApi,
  type PetSettingsPatch,
  type PetViewState,
  type PublicConfig,
  type RefreshableModuleId,
  type SecurityStatus,
  type SettingsApi,
  type WebsiteCheckConfig,
  type WebsiteCheckInput,
  type WebsiteCheckPatch,
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
  settings: 'settingsApi',
  'memo-card': 'memoCardApi'
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
    case 'memo-card':
      return createMemoCardApi(ipc)
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
    getActions: async () => (await ipc.invoke(IPC_CHANNELS.menuGetActions)) as MenuActionSummary[],
    ready: async () => (await ipc.invoke(IPC_CHANNELS.menuReady)) as MenuPresentation,
    opened: async () => {
      await ipc.invoke(IPC_CHANNELS.menuOpened)
    },
    onPresentation: (callback) =>
      ipc.on(IPC_CHANNELS.menuPresentation, (payload) => callback(payload as MenuPresentation)),
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
      ipc.on(IPC_CHANNELS.bubbleUpdate, (payload) => callback(payload as BubbleStackPayload)),
    dismiss: async (id: string) => {
      await ipc.invoke(IPC_CHANNELS.bubbleDismiss, { id })
    },
    setHeight: async (height: number) => {
      await ipc.invoke(IPC_CHANNELS.bubbleSetHeight, { height })
    }
  }
}

function createMemoCardApi(ipc: IpcBridge): MemoCardApi {
  return {
    getState: async (id: string) =>
      (await ipc.invoke(IPC_CHANNELS.memoCardGetState, { id })) as MemoCardState,
    onStateChanged: (callback) =>
      ipc.on(IPC_CHANNELS.memoCardStateChanged, (payload) => callback(payload as MemoCardState)),
    beginDrag: async (id: string) => {
      await ipc.invoke(IPC_CHANNELS.memoCardBeginDrag, { id })
    },
    dragMove: async (id: string) => {
      await ipc.invoke(IPC_CHANNELS.memoCardDragMove, { id })
    },
    endDrag: async (id: string) => {
      await ipc.invoke(IPC_CHANNELS.memoCardEndDrag, { id })
    },
    beginResize: async (id: string, edge: MemoCardEdge) => {
      await ipc.invoke(IPC_CHANNELS.memoCardBeginResize, { id, edge })
    },
    resizeMove: async (id: string) => {
      await ipc.invoke(IPC_CHANNELS.memoCardResizeMove, { id })
    },
    endResize: async (id: string) => {
      await ipc.invoke(IPC_CHANNELS.memoCardEndResize, { id })
    },
    complete: async (id: string) => {
      await ipc.invoke(IPC_CHANNELS.memosComplete, { id })
    },
    unanchor: async (id: string) => {
      await ipc.invoke(IPC_CHANNELS.memosSetAnchored, { id, anchored: false })
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
    getStartupNotice: async () => (await ipc.invoke(IPC_CHANNELS.startupNotice)) as string | null,
    listMemos: async () => (await ipc.invoke(IPC_CHANNELS.memosList)) as MemoSummary[],
    createMemo: async (input: MemoInput) =>
      (await ipc.invoke(IPC_CHANNELS.memosCreate, input)) as MemoSummary[],
    updateMemo: async (id: string, patch: MemoPatch) =>
      (await ipc.invoke(IPC_CHANNELS.memosUpdate, { id, patch })) as MemoSummary[],
    deleteMemo: async (id: string) =>
      (await ipc.invoke(IPC_CHANNELS.memosDelete, { id })) as MemoSummary[],
    completeMemo: async (id: string) =>
      (await ipc.invoke(IPC_CHANNELS.memosComplete, { id })) as MemoSummary[],
    uncompleteMemo: async (id: string) =>
      (await ipc.invoke(IPC_CHANNELS.memosUncomplete, { id })) as MemoSummary[],
    setMemoAnchored: async (id: string, anchored: boolean) =>
      (await ipc.invoke(IPC_CHANNELS.memosSetAnchored, { id, anchored })) as MemoSummary[],
    addMemoImage: async (data: ArrayBuffer) =>
      (await ipc.invoke(IPC_CHANNELS.memosAddImage, { data })) as MemoImageInfo,
    discardMemoImages: async (ids: string[]) => {
      await ipc.invoke(IPC_CHANNELS.memosDiscardImages, { ids })
    },
    setMemoAnchorNew: async (enabled: boolean) =>
      (await ipc.invoke(IPC_CHANNELS.memosSetAnchorNew, { enabled })) as PublicConfig,
    onMemosChanged: (callback) => ipc.on(IPC_CHANNELS.memosChanged, () => callback()),
    onOpenMemoComposer: (callback) =>
      ipc.on(IPC_CHANNELS.settingsOpenMemoComposer, () => callback()),
    settingsUiReady: async () => {
      await ipc.invoke(IPC_CHANNELS.settingsUiReady)
    },
    listWebsiteChecks: async () =>
      (await ipc.invoke(IPC_CHANNELS.websitesList)) as WebsiteCheckConfig[],
    createWebsiteCheck: async (input: WebsiteCheckInput) =>
      (await ipc.invoke(IPC_CHANNELS.websitesCreate, input)) as WebsiteCheckConfig[],
    updateWebsiteCheck: async (id: string, patch: WebsiteCheckPatch) =>
      (await ipc.invoke(IPC_CHANNELS.websitesUpdate, {
        id,
        patch
      })) as WebsiteCheckConfig[],
    deleteWebsiteCheck: async (id: string) =>
      (await ipc.invoke(IPC_CHANNELS.websitesDelete, { id })) as WebsiteCheckConfig[],
    setWebsiteCheckEnabled: async (id: string, enabled: boolean) =>
      (await ipc.invoke(IPC_CHANNELS.websitesSetEnabled, {
        id,
        enabled
      })) as WebsiteCheckConfig[],
    checkWebsite: async (id: string) =>
      (await ipc.invoke(IPC_CHANNELS.websitesCheck, { id })) as WebsiteCheckConfig[],
    checkAllWebsites: async () =>
      (await ipc.invoke(IPC_CHANNELS.websitesCheckAll)) as WebsiteCheckConfig[],
    saveDeepSeekKey: async (apiKey: string) =>
      (await ipc.invoke(IPC_CHANNELS.deepseekSaveKey, {
        apiKey
      })) as ModuleSummary[],
    clearDeepSeekKey: async () =>
      (await ipc.invoke(IPC_CHANNELS.deepseekClearKey)) as ModuleSummary[],
    fetchDeepSeekBalance: async () =>
      (await ipc.invoke(IPC_CHANNELS.deepseekBalance)) as DeepSeekBalance,
    saveEsaCredentials: async (input: EsaCredentialsInput) =>
      (await ipc.invoke(IPC_CHANNELS.esaSaveCredentials, input)) as ModuleSummary[],
    clearEsaCredentials: async () =>
      (await ipc.invoke(IPC_CHANNELS.esaClearCredentials)) as ModuleSummary[],
    fetchEsaTraffic: async () => (await ipc.invoke(IPC_CHANNELS.esaTraffic)) as EsaTraffic,
    saveGmailClient: async (clientId: string, clientSecret: string) =>
      (await ipc.invoke(IPC_CHANNELS.gmailSaveClient, {
        clientId,
        clientSecret
      })) as ModuleSummary[],
    connectGmail: async () =>
      (await ipc.invoke(IPC_CHANNELS.gmailConnect)) as {
        modules: ModuleSummary[]
        emailAddress: string
      },
    disconnectGmail: async () =>
      (await ipc.invoke(IPC_CHANNELS.gmailDisconnect)) as ModuleSummary[],
    getGmailState: async () => (await ipc.invoke(IPC_CHANNELS.gmailState)) as GmailStateView,
    checkGmailNow: async () => (await ipc.invoke(IPC_CHANNELS.gmailCheck)) as GmailPollSummary,
    updateGmailSettings: async (patch: GmailSettingsPatch) =>
      (await ipc.invoke(IPC_CHANNELS.gmailSettings, patch)) as PublicConfig,
    setModuleRefreshInterval: async (moduleId: RefreshableModuleId, minutes: number | null) =>
      (await ipc.invoke(IPC_CHANNELS.moduleRefreshInterval, {
        moduleId,
        minutes
      })) as PublicConfig
  }
}
