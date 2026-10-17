import { IPC_CHANNELS, type AppInfo, type PetApi } from '../shared/api'

/** The only part of ipcRenderer the bridge may use. */
export interface IpcInvoker {
  invoke(channel: string): Promise<unknown>
}

export function createPetApi(invoker: IpcInvoker): PetApi {
  return {
    getAppInfo: async (): Promise<AppInfo> => {
      const info = await invoker.invoke(IPC_CHANNELS.appInfo)
      return info as AppInfo
    }
  }
}
