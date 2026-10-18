/**
 * Types and channel names shared between the main process, the preload bridge
 * and the renderer. Nothing here may contain credentials.
 */

export type WindowView = 'pet' | 'menu' | 'bubble' | 'settings' | 'memo-card'

export const PET_ASSET_SCHEME = 'flowerbuddy-pet'
export const MEMO_IMAGE_SCHEME = 'flowerbuddy-memo'

/** URL served by the main-process pet asset protocol. */
export function petAssetUrl(assetId: string): string {
  return `${PET_ASSET_SCHEME}://asset/${encodeURIComponent(assetId)}`
}

/** URL served by the main-process memo image protocol. */
export function memoImageUrl(imageId: string): string {
  return `${MEMO_IMAGE_SCHEME}://image/${encodeURIComponent(imageId)}`
}

export function isWindowView(value: string): value is WindowView {
  return (
    value === 'pet' ||
    value === 'menu' ||
    value === 'bubble' ||
    value === 'settings' ||
    value === 'memo-card'
  )
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
  launchAtLogin: boolean
  memoShortcut: string
  moduleOrder: ModuleId[]
  showPetOnStartup: boolean
}

export interface AppSettingsPatch {
  alwaysOnTop?: boolean
  bounceAnimation?: boolean
  bubbleDurationMs?: number
  launchAtLogin?: boolean
  memoShortcut?: string
  moduleOrder?: ModuleId[]
  showPetOnStartup?: boolean
}

export interface PetSettings {
  assetId: string
  scale: number
  position: { x: number; y: number } | null
}

export interface PetSettingsPatch {
  scale?: number
}

export type ModuleId = 'memo' | 'gmail' | 'esa' | 'deepseek' | 'website-check'

export type ModuleStatus = 'ready' | 'not-configured' | 'auth-expired' | 'not-implemented'

export interface ModulesSettings {
  memo: { enabled: boolean }
  gmail: {
    enabled: boolean
    pollIntervalMinutes: number
    notifyNewMail: boolean
    hideSubject: boolean
  }
  esa: { enabled: boolean; siteId: string; refreshIntervalMinutes: number | null }
  deepseek: { enabled: boolean; refreshIntervalMinutes: number | null }
  websiteCheck: { enabled: boolean; defaultTimeoutMs: number }
}

export interface GmailSettingsPatch {
  pollIntervalMinutes?: number
  notifyNewMail?: boolean
  hideSubject?: boolean
}

export interface GmailStateView {
  /** OAuth Client ID and Secret are saved. */
  clientConfigured: boolean
  /** A refresh token exists; polling and checks are available. */
  configured: boolean
  emailAddress: string
  authExpired: boolean
}

export interface GmailPollSummary {
  newMessages: number
  baselineReestablished: boolean
}

export type RefreshableModuleId = 'deepseek' | 'esa'

export interface DeepSeekBalanceInfo {
  currency: string
  totalBalance: string
  grantedBalance: string
  toppedUpBalance: string
}

export interface DeepSeekBalance {
  isAvailable: boolean
  balances: DeepSeekBalanceInfo[]
  fetchedAt: string
}

export interface EsaTraffic {
  bytes: number
  samplingRate: number | null
  intervalSeconds: number | null
  startTime: string
  endTime: string
  fetchedAt: string
}

export interface EsaCredentialsInput {
  accessKeyId: string
  accessKeySecret: string
  siteId: string
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

export type MenuPlacement = 'above' | 'below'

export interface MenuPresentation {
  phase: 'open' | 'close'
  placement: MenuPlacement
  /** Increases on every open so the renderer can replay its entry animation. */
  token: number
  /** Close was immediate, so the renderer can drop its panel without a fade. */
  instant: boolean
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

export interface MemoImageInfo {
  id: string
  width: number
  height: number
}

export interface MemoSummary {
  id: string
  text: string
  images: MemoImageInfo[]
  reminderAt: string | null
  completed: boolean
  completedAt: string | null
  anchored: boolean
  createdAt: string
  updatedAt: string
}

export interface MemoInput {
  text: string
  images: MemoImageInfo[]
  reminderAt: string | null
}

export interface MemoPatch {
  text?: string
  images?: MemoImageInfo[]
  reminderAt?: string | null
}

export type MemoCardEdge = 'nw' | 'ne' | 'sw' | 'se'

export interface MemoCardState {
  id: string
  text: string
  images: MemoImageInfo[]
  reminderAt: string | null
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
  memosList: 'memos:list',
  memosCreate: 'memos:create',
  memosUpdate: 'memos:update',
  memosDelete: 'memos:delete',
  memosComplete: 'memos:complete',
  memosUncomplete: 'memos:uncomplete',
  memosSetAnchored: 'memos:set-anchored',
  memosAddImage: 'memos:add-image',
  memosDiscardImages: 'memos:discard-images',
  memosChanged: 'memos:changed',
  settingsOpenMemoComposer: 'settings:open-memo-composer',
  settingsUiReady: 'settings:ui-ready',
  websitesList: 'websites:list',
  websitesCreate: 'websites:create',
  websitesUpdate: 'websites:update',
  websitesDelete: 'websites:delete',
  websitesSetEnabled: 'websites:set-enabled',
  websitesCheck: 'websites:check',
  websitesCheckAll: 'websites:check-all',
  deepseekSaveKey: 'deepseek:save-key',
  deepseekClearKey: 'deepseek:clear-key',
  deepseekBalance: 'deepseek:balance',
  esaSaveCredentials: 'esa:save-credentials',
  esaClearCredentials: 'esa:clear-credentials',
  esaTraffic: 'esa:traffic',
  gmailSaveClient: 'gmail:save-client',
  gmailConnect: 'gmail:connect',
  gmailDisconnect: 'gmail:disconnect',
  gmailState: 'gmail:state',
  gmailCheck: 'gmail:check',
  gmailSettings: 'gmail:update-settings',
  moduleRefreshInterval: 'modules:set-refresh-interval',
  menuGetActions: 'menu:get-actions',
  menuOpened: 'menu:opened',
  menuPresentation: 'menu:presentation',
  menuReady: 'menu:ready',
  petGetState: 'pet:get-state',
  petStateChanged: 'pet:state-changed',
  petBeginDrag: 'pet:begin-drag',
  petDragMove: 'pet:drag-move',
  petEndDrag: 'pet:end-drag',
  petOpenMenu: 'pet:open-menu',
  memoCardGetState: 'memo-card:get-state',
  memoCardStateChanged: 'memo-card:state-changed',
  memoCardBeginDrag: 'memo-card:begin-drag',
  memoCardDragMove: 'memo-card:drag-move',
  memoCardEndDrag: 'memo-card:end-drag',
  memoCardBeginResize: 'memo-card:begin-resize',
  memoCardResizeMove: 'memo-card:resize-move',
  memoCardEndResize: 'memo-card:end-resize',
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
  ready(): Promise<MenuPresentation>
  opened(): Promise<void>
  onPresentation(callback: (presentation: MenuPresentation) => void): () => void
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

export interface MemoCardApi {
  getState(id: string): Promise<MemoCardState>
  onStateChanged(callback: (state: MemoCardState) => void): () => void
  beginDrag(id: string): Promise<void>
  dragMove(id: string): Promise<void>
  endDrag(id: string): Promise<void>
  beginResize(id: string, edge: MemoCardEdge): Promise<void>
  resizeMove(id: string): Promise<void>
  endResize(id: string): Promise<void>
  complete(id: string): Promise<void>
  unanchor(id: string): Promise<void>
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
  listMemos(): Promise<MemoSummary[]>
  createMemo(input: MemoInput): Promise<MemoSummary[]>
  updateMemo(id: string, patch: MemoPatch): Promise<MemoSummary[]>
  deleteMemo(id: string): Promise<MemoSummary[]>
  completeMemo(id: string): Promise<MemoSummary[]>
  uncompleteMemo(id: string): Promise<MemoSummary[]>
  setMemoAnchored(id: string, anchored: boolean): Promise<MemoSummary[]>
  addMemoImage(data: ArrayBuffer): Promise<MemoImageInfo>
  discardMemoImages(ids: string[]): Promise<void>
  onMemosChanged(callback: () => void): () => void
  onOpenMemoComposer(callback: () => void): () => void
  settingsUiReady(): Promise<void>
  listWebsiteChecks(): Promise<WebsiteCheckConfig[]>
  createWebsiteCheck(input: WebsiteCheckInput): Promise<WebsiteCheckConfig[]>
  updateWebsiteCheck(id: string, patch: WebsiteCheckPatch): Promise<WebsiteCheckConfig[]>
  deleteWebsiteCheck(id: string): Promise<WebsiteCheckConfig[]>
  setWebsiteCheckEnabled(id: string, enabled: boolean): Promise<WebsiteCheckConfig[]>
  checkWebsite(id: string): Promise<WebsiteCheckConfig[]>
  checkAllWebsites(): Promise<WebsiteCheckConfig[]>
  saveDeepSeekKey(apiKey: string): Promise<ModuleSummary[]>
  clearDeepSeekKey(): Promise<ModuleSummary[]>
  fetchDeepSeekBalance(): Promise<DeepSeekBalance>
  saveEsaCredentials(input: EsaCredentialsInput): Promise<ModuleSummary[]>
  clearEsaCredentials(): Promise<ModuleSummary[]>
  fetchEsaTraffic(): Promise<EsaTraffic>
  saveGmailClient(clientId: string, clientSecret: string): Promise<ModuleSummary[]>
  connectGmail(): Promise<{ modules: ModuleSummary[]; emailAddress: string }>
  disconnectGmail(): Promise<ModuleSummary[]>
  getGmailState(): Promise<GmailStateView>
  checkGmailNow(): Promise<GmailPollSummary>
  updateGmailSettings(patch: GmailSettingsPatch): Promise<PublicConfig>
  setModuleRefreshInterval(
    moduleId: RefreshableModuleId,
    minutes: number | null
  ): Promise<PublicConfig>
}
