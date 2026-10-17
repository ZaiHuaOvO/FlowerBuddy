import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { IpcResult } from '../shared/api'
import { createBridge } from './api'
import type { IpcBridge } from './api'

function unwrapResult<T>(result: unknown): T {
  if (typeof result !== 'object' || result === null || !('ok' in result)) {
    throw new Error('主进程返回了无效响应')
  }
  const envelope = result as IpcResult<T>
  if (!envelope.ok) {
    // contextBridge drops custom Error properties, so reject with a plain
    // serializable object that still carries the code and retryable flag.
    throw { ...envelope.error }
  }
  return envelope.value
}

const bridge: IpcBridge = {
  invoke: async (channel, ...args) => unwrapResult(await ipcRenderer.invoke(channel, ...args)),
  on: (channel, listener) => {
    const wrapped = (_event: IpcRendererEvent, payload: unknown): void => {
      listener(payload)
    }
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  }
}

const viewArgument = process.argv.find((argument) => argument.startsWith('--fb-view='))
const view = viewArgument ? viewArgument.slice('--fb-view='.length) : 'pet'

const exposed = createBridge(view, bridge)
if (!exposed) {
  throw new Error(`Unknown renderer view: ${view}`)
}

contextBridge.exposeInMainWorld(exposed.key, exposed.value)
