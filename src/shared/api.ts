/**
 * Types and channel names shared between the main process, the preload bridge
 * and the renderer. Nothing here may contain credentials.
 */

export type WindowView = 'pet' | 'menu' | 'bubble' | 'settings'

export function isWindowView(value: string): value is WindowView {
  return value === 'pet' || value === 'menu' || value === 'bubble' || value === 'settings'
}

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
  packaged: boolean
}

export interface AppSettings {
  alwaysOnTop: boolean
  bounceAnimation: boolean
  bubbleDurationMs: number
}

export interface AppSettingsPatch {
  alwaysOnTop?: boolean
  bounceAnimation?: boolean
  bubbleDurationMs?: number
}

export interface PetSettings {
  assetId: string
  scale: number
  position: { x: number; y: number } | null
}

export interface PetSettingsPatch {
  scale?: number
}

export interface PublicConfig {
  schemaVersion: number
  app: AppSettings
  pet: PetSettings
}

export interface PetAssetInfo {
  assetId: string
  width: number
  height: number
  url: string
}

export interface PetViewState {
  asset: PetAssetInfo
  bounceAnimation: boolean
}

export type BubbleState = 'idle' | 'loading' | 'success' | 'empty' | 'error'

export interface BubblePayload {
  state: BubbleState
  message: string
  requestId: string | null
}

export const IPC_CHANNELS = {
  appInfo: 'app:get-info',
  configGet: 'config:get-public',
  settingsSaveApp: 'settings:save-app',
  settingsSavePet: 'settings:save-pet',
  settingsImportPet: 'settings:import-pet',
  settingsResetPosition: 'settings:reset-position',
  petGetState: 'pet:get-state',
  petStateChanged: 'pet:state-changed',
  petBeginDrag: 'pet:begin-drag',
  petDragMove: 'pet:drag-move',
  petEndDrag: 'pet:end-drag',
  petOpenMenu: 'pet:open-menu',
  menuRunAction: 'menu:run-action',
  menuOpenSettings: 'menu:open-settings',
  menuHidePet: 'menu:hide-pet',
  menuQuit: 'menu:quit',
  menuClose: 'menu:close',
  bubbleUpdate: 'bubble:update',
  bubbleDismiss: 'bubble:dismiss'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface PetApi {
  getState(): Promise<PetViewState>
  beginDrag(): Promise<void>
  dragMove(): Promise<void>
  endDrag(): Promise<void>
  openMenu(): Promise<void>
  onStateChanged(callback: (state: PetViewState) => void): () => void
}

export interface MenuApi {
  runAction(actionId: string): Promise<void>
  openSettings(): Promise<void>
  hidePet(): Promise<void>
  quit(): Promise<void>
  close(): Promise<void>
}

export interface BubbleApi {
  onUpdate(callback: (payload: BubblePayload) => void): () => void
  dismiss(): Promise<void>
}

export interface SettingsApi {
  getAppInfo(): Promise<AppInfo>
  getConfig(): Promise<PublicConfig>
  saveAppSettings(patch: AppSettingsPatch): Promise<PublicConfig>
  savePetSettings(patch: PetSettingsPatch): Promise<PublicConfig>
  importPetImage(): Promise<PublicConfig | null>
  resetPetPosition(): Promise<PublicConfig>
}
