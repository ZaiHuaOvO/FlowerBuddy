/**
 * Types and channel names shared between the main process, the preload bridge
 * and the renderer. Nothing here may contain credentials.
 */

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

export const IPC_CHANNELS = {
  appInfo: 'app:get-info'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

export interface PetApi {
  getAppInfo(): Promise<AppInfo>
}
