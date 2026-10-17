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

export type ModuleId = 'dates' | 'gmail' | 'esa' | 'deepseek' | 'website-check'

export type ModuleStatus = 'ready' | 'not-configured' | 'auth-expired' | 'not-implemented'

export interface ModulesSettings {
  dates: { enabled: boolean }
  gmail: { enabled: boolean; pollIntervalMinutes: number; notifyNewMail: boolean }
  esa: { enabled: boolean; siteId: string }
  deepseek: { enabled: boolean }
  websiteCheck: { enabled: boolean; defaultTimeoutMs: number }
}

export interface ModuleSummary {
  id: ModuleId
  name: string
  description: string
  enabled: boolean
  configured: boolean
  implemented: boolean
  status: ModuleStatus
  statusLabel: string
}

export interface MenuActionSummary {
  id: string
  label: string
  moduleId: ModuleId
}

export interface ModuleActionDefinition {
  id: string
  label: string
  loadingMessage: string
}

export interface ModuleActionResult {
  state: 'success' | 'empty' | 'error'
  message: string
}

export type DateRecurrence = 'none' | 'yearly'
export type DateCategory = 'birthday' | 'anniversary' | 'overtime' | 'custom'

export interface DateEventInput {
  title: string
  date: string
  recurrence: DateRecurrence
  category: DateCategory
  notifyDaysBefore?: number[]
}

export interface DateEventPatch {
  title?: string
  date?: string
  recurrence?: DateRecurrence
  category?: DateCategory
  notifyDaysBefore?: number[]
  enabled?: boolean
}

export interface DateEventSummary {
  id: string
  title: string
  date: string
  recurrence: DateRecurrence
  category: DateCategory
  notifyDaysBefore: number[]
  enabled: boolean
  createdAt: string
  updatedAt: string
  daysUntil: number | null
  occurrence: string | null
  upcoming: boolean
}

export type WebsiteCheckErrorKind =
  'none' | 'http-error' | 'timeout' | 'network' | 'tls' | 'invalid-url' | 'cancelled'

export interface WebsiteCheckResult {
  ok: boolean
  status: number | null
  durationMs: number
  finalUrl: string
  errorKind: WebsiteCheckErrorKind
  message: string
  checkedAt: string
}

export interface WebsiteCheckInput {
  name: string
  url: string
  timeoutMs: number
  pollingIntervalMinutes: number | null
  enabled?: boolean
}

export interface WebsiteCheckPatch {
  name?: string
  url?: string
  timeoutMs?: number
  pollingIntervalMinutes?: number | null
  enabled?: boolean
}

export interface WebsiteCheckConfig {
  id: string
  name: string
  url: string
  enabled: boolean
  timeoutMs: number
  pollingIntervalMinutes: number | null
  lastResult: WebsiteCheckResult | null
  createdAt: string
  updatedAt: string
}

export interface SecurityStatus {
  encryptionAvailable: boolean
  message: string | null
}

export interface PublicConfig {
  schemaVersion: number
  app: AppSettings
  pet: PetSettings
  modules: ModulesSettings
}

export type AppErrorCode =
  | 'NOT_CONFIGURED'
  | 'AUTH_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'INVALID_RESPONSE'
  | 'REMOTE_SERVICE_ERROR'
  | 'CANCELLED'
  | 'UNKNOWN'
  | 'INVALID_INPUT'
  | 'UNTRUSTED_SENDER'
  | 'SECRET_STORAGE_UNAVAILABLE'
  | 'CONFIG_ERROR'
  | 'UNKNOWN_ACTION'
  | 'MODULE_DISABLED'
  | 'NOT_FOUND'

export interface PublicError {
  code: AppErrorCode
  message: string
  retryable: boolean
}

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: PublicError }

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
  startupNotice: 'app:get-startup-notice',
  settingsSaveApp: 'settings:save-app',
  settingsSavePet: 'settings:save-pet',
  settingsImportPet: 'settings:import-pet',
  settingsResetPosition: 'settings:reset-position',
  modulesList: 'modules:list',
  modulesSetEnabled: 'modules:set-enabled',
  securityStatus: 'security:status',
  datesList: 'dates:list',
  datesCreate: 'dates:create',
  datesUpdate: 'dates:update',
  datesDelete: 'dates:delete',
  datesSetEnabled: 'dates:set-enabled',
  websitesList: 'websites:list',
  websitesCreate: 'websites:create',
  websitesUpdate: 'websites:update',
  websitesDelete: 'websites:delete',
  websitesSetEnabled: 'websites:set-enabled',
  websitesCheck: 'websites:check',
  websitesCheckAll: 'websites:check-all',
  menuGetActions: 'menu:get-actions',
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
  getActions(): Promise<MenuActionSummary[]>
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
  getModules(): Promise<ModuleSummary[]>
  setModuleEnabled(moduleId: ModuleId, enabled: boolean): Promise<ModuleSummary[]>
  getSecurityStatus(): Promise<SecurityStatus>
  getStartupNotice(): Promise<string | null>
  listDateEvents(): Promise<DateEventSummary[]>
  createDateEvent(input: DateEventInput): Promise<DateEventSummary[]>
  updateDateEvent(id: string, patch: DateEventPatch): Promise<DateEventSummary[]>
  deleteDateEvent(id: string): Promise<DateEventSummary[]>
  setDateEventEnabled(id: string, enabled: boolean): Promise<DateEventSummary[]>
  listWebsiteChecks(): Promise<WebsiteCheckConfig[]>
  createWebsiteCheck(input: WebsiteCheckInput): Promise<WebsiteCheckConfig[]>
  updateWebsiteCheck(id: string, patch: WebsiteCheckPatch): Promise<WebsiteCheckConfig[]>
  deleteWebsiteCheck(id: string): Promise<WebsiteCheckConfig[]>
  setWebsiteCheckEnabled(id: string, enabled: boolean): Promise<WebsiteCheckConfig[]>
  checkWebsite(id: string): Promise<WebsiteCheckConfig[]>
  checkAllWebsites(): Promise<WebsiteCheckConfig[]>
}
